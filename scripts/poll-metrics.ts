import { prisma } from "../lib/db";
import { pollServerMetrics, cleanupOldMetrics } from "../lib/baremetal/ipmi-monitor";

console.log("Starting IPMI Metrics Poller...");

async function loop() {
    while (true) {
        const start = Date.now();
        try {
            // 1. Get Active Servers
            const servers = await prisma.dedicatedServer.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true }
            });

            // 2. Poll concurrently
            // In huge deployments, chunk this. For now, Promise.all is fine.
            if (servers.length > 0) {
                await Promise.all(servers.map(s => pollServerMetrics(s.id)));
                console.log(`[Poller] Polled ${servers.length} servers at ${new Date().toLocaleTimeString()}`);
            } else {
                console.log(`[Poller] No ACTIVE servers to poll.`);
            }

            // 3. Cleanup (approx every 8 mins at 5s intervals * 1/100 chance? 5s * 100 = 500s. Good enough.)
            if (Math.random() < 0.01) {
                await cleanupOldMetrics();
            }

        } catch (e) {
            console.error("Poller Loop Error:", e);
        }

        // Wait for remainder of 5s
        const elapsed = Date.now() - start;
        const wait = Math.max(5000 - elapsed, 1000); // Ensure at least 1s wait if slow
        await new Promise(r => setTimeout(r, wait));
    }
}

loop();
