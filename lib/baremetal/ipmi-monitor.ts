import { prisma } from "@/lib/db";
import { runIpmiCommand, IpmiCredentials } from "./ipmi";
import { decrypt } from "./encryption";
import { MetricType } from "@prisma/client";

interface ParsedMetric {
    type: MetricType;
    label: string;
    value: number;
    unit: string;
}

/**
 * Polls IPMI for a specific server and stores metrics in DB.
 */
export async function pollServerMetrics(serverId: string) {
    // 1. Fetch Server & Creds
    const server = await prisma.dedicatedServer.findUnique({
        where: { id: serverId },
        include: {
            assignments: {
                where: { connection: { type: 'IPMI', enabled: true } },
                include: { connection: true }
            }
        }
    });

    if (!server) return; // Should not happen if called correctly

    const ipmiAssignment = server.assignments[0];
    if (!ipmiAssignment || !ipmiAssignment.connection.encryptedConfig) {
        // No IPMI, skip
        return;
    }

    let creds: IpmiCredentials;
    try {
        const decrypted = decrypt(ipmiAssignment.connection.encryptedConfig);
        const config = JSON.parse(decrypted);
        creds = { host: config.host, user: config.user, pass: config.pass };
    } catch (e) {
        console.error(`[Metrics] Config decrypt failed for ${server.hostname}`);
        return;
    }

    // 2. Execute IPMI 'sdr elist' (Extended List) provides consistent columns
    // Using -C 3 is handled by runIpmiCommand (if updated) or we rely on default.
    const result = await runIpmiCommand(creds, ['sdr', 'elist']);

    if (!result.success) {
        // Silent fail as requested ("Do NOT spam logs")
        // console.warn(`[Metrics] IPMI failed for ${server.hostname}: ${result.error}`);
        return;
    }

    // 3. Parse Output
    const lines = result.output.split('\n');
    const metrics: ParsedMetric[] = [];

    for (const line of lines) {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length < 5) continue;

        const name = parts[0];
        const status = parts[2].toLowerCase(); // ok, ns, na, ...
        const valueStr = parts[4].split(' ')[0]; // "40 degrees C" -> "40"

        if (status !== 'ok') continue;

        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;

        // Classification
        const nameLower = name.toLowerCase();

        // FANS
        if (parts[4].includes('RPM') || nameLower.includes('fan')) {
            metrics.push({
                type: 'FAN_RPM',
                label: name,
                value,
                unit: 'RPM'
            });
            continue;
        }

        // TEMPS
        if (parts[4].includes('degrees C') || nameLower.includes('temp')) {
            let type: MetricType | null = null;
            if (nameLower.includes('inlet')) type = 'INLET_TEMP';
            else if (nameLower.includes('exhaust')) type = 'EXHAUST_TEMP';
            else if (nameLower.includes('cpu') || nameLower.includes('proc')) type = 'CPU_TEMP';
            else {
                // Determine generic temp? 
                // Creating a specific rule: default generic "Temp" to CPU if it's the first one, or ignored?
                // User requirement: "Temperature sources: CPU, Inlet, Exhaust"
                // If I can't map it, I might skip or default to CPU if ambiguous.
                // Assuming "Temp" often refers to CPU/System.
                // Let's map "Temp" -> CPU_TEMP for basic compatibility
                if (name === 'Temp') type = 'CPU_TEMP';
            }

            if (type) {
                metrics.push({ type, label: name, value, unit: 'C' });
            }
        }
    }

    // 4. Batch Insert
    if (metrics.length > 0) {
        const now = new Date(); // Unified timestamp for this poll cycle
        await prisma.hardwareMetric.createMany({
            data: metrics.map(m => ({
                serverId: server.id,
                metricType: m.type,
                metricLabel: m.label,
                value: m.value,
                unit: m.unit,
                createdAt: now
            }))
        });
    }
}

/**
 * Deletes metrics older than 24h
 */
export async function cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.hardwareMetric.deleteMany({
        where: { createdAt: { lt: cutoff } }
    });
}
