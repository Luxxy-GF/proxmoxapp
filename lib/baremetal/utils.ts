import { prisma } from "@/lib/db";

// Revised Event Types matching enterprise standards
export const DedicatedLogType = {
    POWER: 'POWER',       // Power control actions (On/Off/Reboot)
    INSTALL: 'INSTALL',   // OS Installation / Reinstall flow
    RESCUE: 'RESCUE',     // Rescue mode toggle
    NETWORK: 'NETWORK',   // Network changes (IP/RDNS)
    HARDWARE: 'HARDWARE', // Hardware changes or inventory scans
    SYSTEM: 'SYSTEM',     // Auto-detected state changes (Online/Offline)
    ERROR: 'ERROR',       // Critical failures (IPMI auth, Install failure)
} as const;

export type DedicatedEventType = typeof DedicatedLogType[keyof typeof DedicatedLogType] | string;
export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR';

/**
 * Logs a meaningful activity event for the user.
 * 
 * RULES:
 * 1. Do NOT log polling or status checks.
 * 2. Only log state changes or user actions.
 * 3. Use concise, professional wording (Tenantos-style).
 */
export async function logDedicatedEvent(
    serverId: string,
    type: DedicatedEventType,
    message: string,
    payload?: any,
    severity: LogSeverity = 'INFO'
) {
    try {
        await prisma.dedicatedEvent.create({
            data: {
                serverId,
                type,
                message,
                payloadJson: payload ? payload : undefined,
                severity,
            },
        });
    } catch (error) {
        console.error("Failed to log DedicatedEvent:", error);
    }
}
