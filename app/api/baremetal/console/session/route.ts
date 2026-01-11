import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { decrypt } from '@/lib/encryption';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/baremetal/console/session
 * Start a new console session
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { serverId, consoleType = 'java' } = body;

        if (!serverId) {
            return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
        }

        // Verify user has access to this server
        const server = await prisma.dedicatedServer.findUnique({
            where: { id: serverId },
            include: {
                dedicatedNode: true,
                assignments: {
                    where: {
                        connection: {
                            type: 'IPMI'
                        }
                    },
                    include: {
                        connection: true
                    }
                }
            }
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Check if user owns server or is admin
        const isAdmin = session.user.role === 'ADMIN';
        const isOwner = server.userId === session.user.id;
        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!server.dedicatedNode) {
            return NextResponse.json({ error: 'Server has no agent node assigned' }, { status: 400 });
        }

        // Get IPMI credentials from connection assignment
        // Since we filtered in the query, the first assignment should be the IPMI one
        const ipmiAssignment = server.assignments[0];
        if (!ipmiAssignment || !ipmiAssignment.connection) {
            return NextResponse.json({ error: 'No IPMI connection configured' }, { status: 400 });
        }

        let credentials;
        try {
            if (ipmiAssignment.connection.encryptedConfig) {
                const decrypted = decrypt(ipmiAssignment.connection.encryptedConfig);
                credentials = JSON.parse(decrypted);
            } else {
                return NextResponse.json({ error: 'IPMI configuration is missing' }, { status: 400 });
            }
        } catch (e) {
            console.error('Failed to decrypt/parse IPMI config', e);
            return NextResponse.json({ error: 'Invalid IPMI configuration' }, { status: 500 });
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

        // Create session in database
        const consoleSession = await prisma.consoleSession.create({
            data: {
                serverId,
                userId: session.user.id,
                agentNodeId: server.dedicatedNode.id,
                consoleType,
                token,
                expiresAt,
                status: 'STARTING'
            }
        });

        // Build request to Agent
        const agentUrl = `http://${server.dedicatedNode.address}:${server.dedicatedNode.port}/console/session`;

        const agentRequest = {
            serverId,
            consoleType,
            token,
            expiresAt: expiresAt.toISOString(),
            credentials: {
                host: credentials.host,
                username: credentials.user || credentials.username, // Handle both 'user' and 'username' keys
                password: credentials.pass || credentials.password, // Handle 'pass' and 'password'
                port: credentials.port || 623
            }
        };

        // Call Agent to start container
        const agentResponse = await fetch(agentUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-Secret': server.dedicatedNode.tokenSecret
            },
            body: JSON.stringify(agentRequest)
        });

        if (!agentResponse.ok) {
            const error = await agentResponse.text();
            await prisma.consoleSession.update({
                where: { id: consoleSession.id },
                data: { status: 'TERMINATED' }
            });
            return NextResponse.json({ error: `Agent error: ${error}` }, { status: 502 });
        }

        const agentResult = await agentResponse.json();

        // Update session with container info
        await prisma.consoleSession.update({
            where: { id: consoleSession.id },
            data: {
                containerId: agentResult.containerId,
                containerPort: agentResult.containerPort,
                status: agentResult.status === 'active' ? 'ACTIVE' : 'STARTING'
            }
        });

        // Return console URL (direct connection to Agent container)
        // jlesage/baseimage-gui serves noVNC at root path, not /vnc.html
        const consoleUrl = `http://${server.dedicatedNode.address}:${agentResult.containerPort}/`;

        return NextResponse.json({
            sessionId: consoleSession.id,
            token,
            consoleUrl,
            expiresAt,
            status: agentResult.status
        });

    } catch (error) {
        console.error('[CONSOLE_SESSION_POST]', error);
        return NextResponse.json({ error: 'Failed to start console session' }, { status: 500 });
    }
}

/**
 * GET /api/baremetal/console/session
 * List user's active console sessions
 */
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const sessions = await prisma.consoleSession.findMany({
            where: {
                userId: session.user.id,
                status: { in: ['STARTING', 'ACTIVE'] },
                expiresAt: { gt: new Date() }
            },
            include: {
                server: { select: { hostname: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(sessions);
    } catch (error) {
        console.error('[CONSOLE_SESSION_GET]', error);
        return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
    }
}
