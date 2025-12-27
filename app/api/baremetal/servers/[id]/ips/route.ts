
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { allocateIP } from "@/lib/networking"; // Assume updated to support dedicated
import { auth } from "@/auth";
import { regenerateDnsmasqConfig } from "@/lib/pxe";

// GET: List allocations
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;
        const server = await prisma.dedicatedServer.findUnique({
            where: { id },
            include: {
                allocations: {
                    include: { pool: true },
                    orderBy: { ipAddress: 'asc' }
                }
            }
        });

        if (!server) return new NextResponse("Server not found", { status: 404 });

        return NextResponse.json(server.allocations);
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST: Allocate IPs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;
        const json = await req.json();
        const { poolId, count } = json;

        if (!poolId || !count || count < 1) {
            return new NextResponse("Invalid request", { status: 400 });
        }

        const serverId = id;
        const allocations = [];

        // Loop allocation (could be optimized)
        for (let i = 0; i < count; i++) {
            try {
                const allocation = await allocateIP(poolId, serverId, 'dedicated');
                allocations.push(allocation);
            } catch (e: any) {
                // If one fails (e.g. pool full), stop and report partial success or revert?
                // For now, return what we got + error
                return NextResponse.json({
                    message: `Allocated ${allocations.length} IPs. Stopped due to error: ${e.message}`,
                    allocations
                }, { status: 206 }); // Partial Content
            }
        }

        return NextResponse.json({ success: true, allocations });

    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE: Release IP
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const ip = searchParams.get("ip");

        if (!ip) return new NextResponse("IP required", { status: 400 });

        const serverId = id;

        // Check ownership
        const allocation = await prisma.iPAllocation.findUnique({
            where: {
                poolId_ipAddress: {
                    poolId: (await prisma.iPAllocation.findFirst({ where: { ipAddress: ip, dedicatedServerId: serverId } }))?.poolId || "", // We need poolId for composite key?
                    ipAddress: ip
                }
            }
        });

        const deleted = await prisma.iPAllocation.deleteMany({
            where: {
                dedicatedServerId: serverId,
                ipAddress: ip
            }
        });

        if (deleted.count === 0) {
            return new NextResponse("Allocation not found", { status: 404 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PATCH: Set Primary IP
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;
        const json = await req.json();
        const { primaryIpv4 } = json;

        // Verify IP is allocated to this server (security check)
        if (primaryIpv4) {
            const allocation = await prisma.iPAllocation.findFirst({
                where: { dedicatedServerId: id, ipAddress: primaryIpv4 }
            });
            if (!allocation) {
                return new NextResponse("IP not allocated to this server", { status: 400 });
            }
        }

        const updated = await prisma.dedicatedServer.update({
            where: { id },
            data: { primaryIpv4 }
        });

        // Trigger DHCP Update
        await regenerateDnsmasqConfig();

        return NextResponse.json(updated);

    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
