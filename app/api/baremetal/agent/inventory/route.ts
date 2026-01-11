import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAgent } from '@/lib/agent-auth';

export async function POST(req: NextRequest) {
    const node = await authenticateAgent(req);
    if (!node) return new NextResponse('Unauthorized', { status: 401 });

    try {
        const data = await req.json();
        // Expected Format: lshw -json output (Array or Object)
        // We look for serial numbers or MAC addresses to match servers

        // This is a simplified handler. Real lshw parsing is complex.
        // We assume the agent sends a simplified object for now or we just log it.

        // TODO: Parse lshw JSON and update `DedicatedHardware` table.

        return NextResponse.json({ success: true });
    } catch (e) {
        return new NextResponse('Bad Request', { status: 400 });
    }
}
