import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ sessionId: string; path: string[] }>;
}

/**
 * GET /api/baremetal/console/proxy/[sessionId]/[...path]
 * Proxy requests to console container
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { sessionId, path } = await params;
    const token = req.nextUrl.searchParams.get('token');

    // Validate session
    const consoleSession = await prisma.consoleSession.findUnique({
        where: { id: sessionId },
        include: {
            agentNode: { select: { address: true, port: true } }
        }
    });

    if (!consoleSession) {
        return new NextResponse('Session not found', { status: 404 });
    }

    // Validate token
    if (consoleSession.token !== token) {
        return new NextResponse('Invalid token', { status: 403 });
    }

    // Check expiry
    if (consoleSession.expiresAt < new Date()) {
        return new NextResponse('Session expired', { status: 410 });
    }

    // Check status
    if (!['STARTING', 'ACTIVE'].includes(consoleSession.status)) {
        return new NextResponse('Session not active', { status: 410 });
    }

    // Build container URL
    if (!consoleSession.containerPort || !consoleSession.agentNode) {
        return new NextResponse('Container not ready', { status: 503 });
    }

    const containerUrl = `http://${consoleSession.agentNode.address}:${consoleSession.containerPort}/${path.join('/')}`;

    try {
        // Proxy the request
        const proxyResponse = await fetch(containerUrl, {
            headers: {
                'Host': `localhost:${consoleSession.containerPort}`
            }
        });

        // Copy response headers
        const headers = new Headers();
        proxyResponse.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        return new NextResponse(proxyResponse.body, {
            status: proxyResponse.status,
            headers
        });
    } catch (error) {
        console.error('[CONSOLE_PROXY_GET]', error);
        return new NextResponse('Failed to connect to console', { status: 502 });
    }
}
