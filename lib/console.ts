import { exec } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

const DOCKER_IMAGE = "lumen-console-session:latest";
const HOST_IP = process.env.CONSOLE_HOST_IP || "localhost"; // Public IP/Hostname for the frontend to connect to

interface SessionConfig {
    serverId: string;
    type: 'HTML5' | 'JAVA';
    bmcUrl: string;
    bmcUser?: string;
    bmcPass?: string;
}

interface Session {
    containerId: string;
    port: number;
    wsUrl: string;
    token: string;
}

export async function startConsoleSession(config: SessionConfig): Promise<Session> {
    // 1. Pick a random host port (In prod, use a port manager or Traefik dynamic router)
    // For MVP, simplistic random range 20000-21000
    const port = Math.floor(Math.random() * 1000) + 20000;

    // 2. Generate Container Name
    const containerName = `console-${config.serverId}-${randomBytes(4).toString('hex')}`;

    // 3. Prepare Environment
    const envVars = [
        `TYPE=${config.type}`,
        `BMC_URL=${config.bmcUrl}`,
        `BMC_USER=${config.bmcUser || ''}`,
        `BMC_PASS=${config.bmcPass || ''}`
    ].map(e => `-e "${e}"`).join(' ');

    // 4. Docker Run
    // --rm: Auto remove on exit
    // -p: Map host port
    // --name: Identifiable name
    const cmd = `docker run -d --rm -p ${port}:8080 --name ${containerName} ${envVars} ${DOCKER_IMAGE}`;

    console.log(`[Console] Spawning: ${containerName} on port ${port}`);

    try {
        const { stdout } = await execAsync(cmd);
        const containerId = stdout.trim();

        // 5. Construct Connection Info
        // Note: No specific 'token' needed for noVNC if we trust the port mapping security for MVP.
        // But our design mentioned websockify auth.
        // For 'desktop bridge' model, websockify usually runs without auth inside container, 
        // relying on the ephemeral nature and obscure port. 
        // We can add a token param to the valid URL if we used a path-based router.

        return {
            containerId,
            port,
            wsUrl: `ws://${HOST_IP}:${port}/websockify`, // Standard websockify path
            token: ""
        };
    } catch (e: any) {
        console.error("Docker Run Failed:", e);
        throw new Error(`Failed to start console session: ${e.message}`);
    }
}

export async function stopConsoleSession(containerId: string) {
    try {
        await execAsync(`docker stop ${containerId}`);
    } catch (e) {
        // Ignore if already stopped
    }
}
