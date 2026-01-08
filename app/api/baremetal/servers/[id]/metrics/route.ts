import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const server = await prisma.dedicatedServer.findUnique({
        where: { id },
    });

    if (!server) return new NextResponse("Not Found", { status: 404 });
    if (session.user.role !== "ADMIN" && server.userId !== session.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // Range default 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const metrics = await prisma.hardwareMetric.findMany({
        where: {
            serverId: id,
            createdAt: { gte: cutoff }
        },
        orderBy: { createdAt: 'asc' }
    });

    // Pivot Data
    // We expect unified timestamps for each poll
    const grouped = new Map<string, any>(); // ISO string -> Data Object

    for (const m of metrics) {
        const timeKey = m.createdAt.toISOString();
        if (!grouped.has(timeKey)) {
            grouped.set(timeKey, {
                ts: timeKey,
                cpu: null, inlet: null, exhaust: null,
                fans: {}
            });
        }
        const period = grouped.get(timeKey);

        if (m.metricType === 'CPU_TEMP') period.cpu = m.value;
        if (m.metricType === 'INLET_TEMP') period.inlet = m.value;
        if (m.metricType === 'EXHAUST_TEMP') period.exhaust = m.value;
        if (m.metricType === 'FAN_RPM') {
            period.fans[m.metricLabel] = m.value;
        }
    }

    // Sort by time just in case map order varies (ES6 map preserves insertion order, query was ordered, so safe)
    const result = Array.from(grouped.values());

    // Transform to requested columnar format
    const response = {
        timestamps: result.map(r => r.ts),
        temperatures: {
            cpu: result.map(r => r.cpu),
            inlet: result.map(r => r.inlet),
            exhaust: result.map(r => r.exhaust)
        },
        fans: {} as Record<string, (number | null)[]>
    };

    // Collect all unique fan names encountered
    const allFanNames = new Set<string>();
    metrics.filter(m => m.metricType === 'FAN_RPM').forEach(m => allFanNames.add(m.metricLabel));

    // Fill fan columns
    for (const fanName of allFanNames) {
        response.fans[fanName] = result.map(r => r.fans[fanName] || null);
    }

    return NextResponse.json(response);
}
