
import { prisma } from "@/lib/db";

export type EventType = 'POWER' | 'PXE' | 'INSTALL' | 'CONSOLE' | 'INVENTORY' | 'ERROR';

export async function logDedicatedEvent(
    serverId: string,
    type: EventType,
    message: string,
    payload?: any
) {
    try {
        await prisma.dedicatedEvent.create({
            data: {
                serverId,
                type,
                message,
                payloadJson: payload ? payload : undefined,
            },
        });
    } catch (error) {
        console.error("Failed to log DedicatedEvent:", error);
    }
}
