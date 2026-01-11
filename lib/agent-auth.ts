import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function authenticateAgent(req: NextRequest) {
    const token = req.headers.get('X-Agent-Token');

    if (!token) {
        return null;
    }

    // Find DedicatedNode by token
    const node = await prisma.dedicatedNode.findFirst({
        where: {
            tokenSecret: token
        }
    });

    return node;
}
