import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/baremetal/console/session/[id]
 * Get console session status
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const consoleSession = await prisma.consoleSession.findUnique({
            where: { id },
            include: {
                server: { select: { hostname: true } },
                agentNode: { select: { address: true, port: true } }
            }
        });

        if (!consoleSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Check access
        const isAdmin = session.user.role === 'ADMIN';
        const isOwner = consoleSession.userId === session.user.id;
        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(consoleSession);
    } catch (error) {
        console.error('[CONSOLE_SESSION_ID_GET]', error);
        return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
    }
}

/**
 * DELETE /api/baremetal/console/session/[id]
 * Stop a console session
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const consoleSession = await prisma.consoleSession.findUnique({
            where: { id },
            include: {
                agentNode: { select: { address: true, port: true, tokenSecret: true } }
            }
        });

        if (!consoleSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Check access
        const isAdmin = session.user.role === 'ADMIN';
        const isOwner = consoleSession.userId === session.user.id;
        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Call Agent to stop container
        if (consoleSession.agentNode && consoleSession.status === 'ACTIVE') {
            const agentUrl = `http://${consoleSession.agentNode.address}:${consoleSession.agentNode.port}/console/session/${consoleSession.token}`;

            try {
                await fetch(agentUrl, {
                    method: 'DELETE',
                    headers: {
                        'X-Agent-Secret': consoleSession.agentNode.tokenSecret
                    }
                });
            } catch (err) {
                console.warn('Failed to notify agent of session stop:', err);
            }
        }

        // Update session status
        await prisma.consoleSession.update({
            where: { id },
            data: {
                status: 'TERMINATED',
                terminatedAt: new Date()
            }
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('[CONSOLE_SESSION_ID_DELETE]', error);
        return NextResponse.json({ error: 'Failed to stop session' }, { status: 500 });
    }
}
