import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAgent } from '@/lib/agent-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const node = await authenticateAgent(req);
    if (!node) return new NextResponse('Unauthorized', { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { type, state, log, installId, token } = body;

    try {
        // Handle different job types
        if (type === 'pxe_install_state' || installId || token) {
            // Update PXEInstall state by ID or token
            const whereClause = installId ? { id: installId } : token ? { token } : null;

            if (!whereClause) {
                return NextResponse.json({ error: 'Missing installId or token' }, { status: 400 });
            }

            // Verify the install belongs to a server assigned to this node
            const install = await prisma.pXEInstall.findFirst({
                where: {
                    ...whereClause,
                    server: {
                        dedicatedNodeId: node.id
                    }
                }
            });

            if (!install) {
                return NextResponse.json({ error: 'Install not found or not assigned to this node' }, { status: 404 });
            }

            // Update the install state
            if (state) {
                await prisma.pXEInstall.update({
                    where: { id: install.id },
                    data: {
                        state,
                        lastCallbackAt: new Date(),
                        ...(state === 'DONE' || state === 'FAILED' ? { finishedAt: new Date() } : {}),
                        ...(log ? { logText: log } : {})
                    }
                });
            }

            return NextResponse.json({ success: true, installId: install.id });
        }

        // Generic job completion (future: other job types)
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[AGENT_JOB_POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
