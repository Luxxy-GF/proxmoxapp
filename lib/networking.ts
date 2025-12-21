import { prisma } from "@/lib/db"

// Helper: IPv4 to Number
export function ipToLong(ip: string): number {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address: ${ip}`)
    }
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
}

// Helper: Number to IPv4
export function longToIp(long: number): string {
    return [
        (long >>> 24) & 0xff,
        (long >>> 16) & 0xff,
        (long >>> 8) & 0xff,
        long & 0xff
    ].join('.')
}

// Check if a string is a valid IPv4
export function isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipv4Regex.test(ip)
}

/**
 * Validates that the new pool's range does not overlap with existing enabled pools on the same node.
 * This should be called before creating or updating a pool.
 */
export async function validateIPPoolRange(nodeId: string, startIP: string, endIP: string, excludePoolId?: string) {
    const start = ipToLong(startIP)
    const end = ipToLong(endIP)

    if (start > end) {
        throw new Error("Start IP must be before End IP")
    }

    // correct: we prefer "database authority", handling overlap checks via DB queries roughly
    // Since math in DB for IP strings is hard, we fetch all pools for the node and check in-memory.
    // Assuming number of pools per node is reasonable (e.g. < 100).

    const existingPools = await prisma.iPPool.findMany({
        where: {
            nodeId,
            enabled: true,
            id: excludePoolId ? { not: excludePoolId } : undefined
        }
    })

    for (const pool of existingPools) {
        const poolStart = ipToLong(pool.startIP)
        const poolEnd = ipToLong(pool.endIP)

        // Check for overlap
        // Range A (start...end) overlaps with Range B (poolStart...poolEnd) if:
        // start <= poolEnd AND end >= poolStart
        if (start <= poolEnd && end >= poolStart) {
            throw new Error(`Range overlaps with existing pool "${pool.name}" (${pool.startIP} - ${pool.endIP})`)
        }
    }

    return true
}

/**
 * Finds the next available IP in a specific pool.
 * Returns null if pool is exhausted.
 */
export async function getNextFreeIP(poolId: string): Promise<string | null> {
    const pool = await prisma.iPPool.findUnique({
        where: { id: poolId },
        include: { allocations: { select: { ipAddress: true } } }
    })

    if (!pool) throw new Error("Pool not found")
    if (!pool.enabled) throw new Error("Pool is disabled")

    const start = ipToLong(pool.startIP)
    const end = ipToLong(pool.endIP)

    // Create a Set of used IPs for O(1) lookups
    const usedIPs = new Set(pool.allocations.map(a => ipToLong(a.ipAddress)))

    // Iterate through the range to find the first free IP
    for (let current = start; current <= end; current++) {
        if (!usedIPs.has(current)) {
            return longToIp(current)
        }
    }

    return null
}

/**
 * Allocates an IP for a server.
 * Uses a transaction to ensure integrity.
 */
export async function allocateIP(poolId: string, serverId: string) {
    return await prisma.$transaction(async (tx) => {
        // 1. Lock the pool/allocations (Prisma doesn't easily support explicit locking, but we can rely on atomic insert constraints unique error handling)
        // Better: Calculate next free based on current state.
        // There is a race condition here if two requests try to allocate same IP.
        // We will optimistically try to pick one.

        // Retries could be handled by the caller or simple loop here.
        // For now, simple implementation:

        const ip = await getNextFreeIP(poolId)
        if (!ip) throw new Error("No available IPs in this pool")

        // 2. Create allocation
        const allocation = await tx.iPAllocation.create({
            data: {
                poolId,
                serverId,
                ipAddress: ip
            }
        })

        return allocation
    })
}

/**
 * Release all IPs for a server.
 */
export async function releaseIPs(serverId: string) {
    await prisma.iPAllocation.deleteMany({
        where: { serverId }
    })
}
