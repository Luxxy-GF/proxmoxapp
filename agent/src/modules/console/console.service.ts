import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import {
    ConsoleCredentials,
    ConsoleSessionRequest,
    ConsoleSessionResponse,
    ContainerInfo,
} from './console.types';
import { IpmiService } from '../power/ipmi.service';

const execAsync = promisify(exec);

@Injectable()
export class ConsoleService {
    private readonly logger = new Logger(ConsoleService.name);
    private readonly activeContainers = new Map<string, ContainerInfo>();
    private readonly CONSOLE_IMAGE = process.env.CONSOLE_IMAGE || 'ipmi-console:latest';
    private readonly PORT_RANGE_START = 16000;
    private readonly PORT_RANGE_END = 16999;
    private readonly usedPorts = new Set<number>();
    private readonly JNLP_DIR = '/tmp/ipmi-jnlp-sessions';

    constructor(
        private readonly configService: ConfigService,
        private readonly ipmiService: IpmiService
    ) {
        // Start cleanup interval
        setInterval(() => this.cleanupExpiredContainers(), 60000);
        // Ensure JNLP directory exists
        fs.mkdir(this.JNLP_DIR, { recursive: true }).catch(() => { });
    }

    /**
     * Get the next available port in the range
     */
    private getNextAvailablePort(): number {
        for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }
        throw new Error('No available ports for console container');
    }

    /**
     * Release a port back to the pool
     */
    private releasePort(port: number): void {
        this.usedPorts.delete(port);
    }

    /**
     * Start a new console container
     */
    async startConsoleSession(request: ConsoleSessionRequest): Promise<ConsoleSessionResponse> {
        const { serverId, consoleType, token, expiresAt, credentials } = request;

        this.logger.log(`Starting ${consoleType} console session for server ${serverId}`);

        let activeCredentials = credentials;
        let tempUserId: number | undefined;
        let tempUsername: string | undefined;

        try {
            // Create temporary IPMI user for web console
            if (consoleType === 'web') {
                try {
                    const tempUser = await this.ipmiService.createTempUser({
                        host: credentials.host,
                        user: credentials.username,
                        pass: credentials.password
                    });

                    activeCredentials = {
                        ...credentials,
                        username: tempUser.username,
                        password: tempUser.pass
                    };
                    tempUserId = tempUser.userId;
                    tempUsername = tempUser.username;
                } catch (err) {
                    this.logger.warn(`Failed to create temp user, falling back to original creds: ${err.message}`);
                    // Fallback to original credentials (risky but allows connection)
                    // Or we could fail here. For now, warn and proceed.
                }
            }

            // Get available port
            const containerPort = this.getNextAvailablePort();
            const containerName = `console-${serverId}-${Date.now()}`;

            // Generate JNLP file for java console type
            let jnlpPath: string | undefined;
            if (consoleType === 'java') {
                jnlpPath = await this.generateJnlpFile(token, activeCredentials);
            }

            // Build Docker run command with security restrictions
            const dockerCmd = this.buildDockerCommand(
                containerName,
                containerPort,
                consoleType,
                activeCredentials,
                token,
                jnlpPath
            );

            this.logger.debug(`Starting container: ${containerName} on port ${containerPort}`);

            // Start container
            const { stdout } = await execAsync(dockerCmd);
            const containerId = stdout.trim();

            // Store container info
            const containerInfo: ContainerInfo = {
                containerId,
                sessionId: token,
                serverId,
                port: containerPort,
                status: 'starting',
                createdAt: new Date(),
                expiresAt: new Date(expiresAt),
                tempUserId,
                tempUsername,
                originalCredentials: tempUserId ? credentials : undefined
            };

            this.activeContainers.set(token, containerInfo);

            // Wait briefly for container to start
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify container is running
            const isRunning = await this.isContainerRunning(containerId);
            if (!isRunning) {
                this.releasePort(containerPort);
                throw new Error('Container failed to start');
            }

            containerInfo.status = 'active';

            this.logger.log(`Console container started: ${containerId} on port ${containerPort}`);

            return {
                sessionId: token,
                containerId,
                containerPort,
                status: 'active',
            };
        } catch (error) {
            this.logger.error(`Failed to start console session: ${error.message}`);

            // Cleanup temp user if check failed
            if (tempUserId) {
                try {
                    await this.ipmiService.deleteUser({
                        host: credentials.host,
                        user: credentials.username,
                        pass: credentials.password
                    }, tempUserId);
                } catch (e) {
                    this.logger.error(`Failed to cleanup temp user after error: ${e.message}`);
                }
            }

            return {
                sessionId: token,
                containerId: '',
                containerPort: 0,
                status: 'error',
                message: error.message,
            };
        }
    }

    /**
     * Build Docker run command with proper security settings
     * Uses jlesage/baseimage-gui based image with noVNC on port 5800
     */
    private buildDockerCommand(
        containerName: string,
        hostPort: number,
        consoleType: string,
        credentials: ConsoleCredentials,
        token: string,
        jnlpPath?: string
    ): string {
        const { host, username, password, port = 623 } = credentials;

        // Base Docker command with basic security limits
        // Note: jlesage/baseimage-gui needs capabilities for X11 and networking
        const securityFlags = [
            '--memory=1024m',                       // Memory limit (increased for Java)
            '--cpus=2',                             // CPU limit
            '--pids-limit=1000',                    // Process limit
            `--network=bridge`,                     // Use bridge network
        ];

        // Environment variables for the console
        const envVars = [
            `-e CONSOLE_TYPE=${consoleType}`,
            `-e BMC_URL=https://${host}/`,
            `-e backendHost=${host}`,
            `-e IPMI_HOST=${host}`,
            `-e IPMI_PORT=${port}`,
            `-e IPMI_USER=${username}`,
            `-e IPMI_PASS=${password}`,
            `-e SESSION_TOKEN=${token}`,
            `-e DISPLAY_WIDTH=1440`,
            `-e DISPLAY_HEIGHT=900`,
        ];

        // Volume mounts
        const volumeMounts: string[] = [];
        if (jnlpPath) {
            // Mount the JNLP directory as /app (read-only)
            const jnlpDir = path.dirname(jnlpPath);
            volumeMounts.push(`-v ${jnlpDir}:/app:ro`);
        }

        // Port mapping - jlesage/baseimage-gui uses 5800 for noVNC web interface
        const portMapping = `-p 0.0.0.0:${hostPort}:5800`;

        // Build full command
        const cmd = [
            'docker run -d --rm',
            `--name ${containerName}`,
            ...securityFlags,
            ...envVars,
            ...volumeMounts,
            portMapping,
            this.CONSOLE_IMAGE,
        ].join(' ');

        return cmd;
    }

    /**
     * Generate JNLP file for HP iLO Java console
     */
    private async generateJnlpFile(sessionId: string, credentials: ConsoleCredentials): Promise<string> {
        const { host, username, password } = credentials;
        const sessionDir = path.join(this.JNLP_DIR, sessionId);

        await fs.mkdir(sessionDir, { recursive: true });

        try {
            // Temporarily disable SSL verification for self-signed iLO certs
            const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

            try {
                // Login to iLO and get session key
                const loginResponse = await fetch(`https://${host}/json/login_session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: 'login',
                        user_login: username,
                        password: password
                    }),
                });

                const loginData = await loginResponse.json() as { session_key?: string };
                const sessionKey = loginData.session_key || '';

                // Get RC info
                const rcResponse = await fetch(`https://${host}/json/rc_info`, {
                    headers: { 'Cookie': `sessionKey=${sessionKey}` },
                });
                const rcInfo = await rcResponse.json() as {
                    enc_key?: string;
                    rc_port?: number;
                    vm_key?: string;
                    vm_port?: number;
                };

                // Restore SSL verification
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;

                const encKey = rcInfo.enc_key || '';
                const vmPort = rcInfo.vm_port || 17988;

                // Generate JNLP content
                const jnlpContent = `<?xml version="1.0" encoding="UTF-8"?>
<jnlp spec="1.0+" codebase="https://${host}:443/">
<information>
    <title>Integrated Remote Console</title>
    <vendor>HPE</vendor>
    <offline-allowed></offline-allowed>
</information>
<security>
    <all-permissions></all-permissions>
</security>
<resources>
    <j2se version="1.5+" href="http://java.sun.com/products/autodl/j2se"></j2se>
    <jar href="https://${host}/html/intgapp4_232.jar" main="false"></jar>
</resources>
<property name="deployment.trace.level property" value="basic"></property>
<applet-desc main-class="com.hp.ilo2.intgapp.intgapp" name="iLOJIRC" documentbase="https://${host}/html/java_irc.html" width="1" height="1">
    <param name="RCINFO1" value="${sessionKey}"></param>
    <param name="RCINFOLANG" value="en"></param>
    <param name="INFO0" value="${encKey}"></param>
    <param name="INFO1" value="${vmPort}"></param>
    <param name="INFO2" value="composite"></param>
</applet-desc>
<update check="background"></update>
</jnlp>`;

                const jnlpPath = path.join(sessionDir, 'starter.jnlp');
                await fs.writeFile(jnlpPath, jnlpContent);

                // Also write javaVersion file to use legacy Java 8u121
                await fs.writeFile(path.join(sessionDir, 'javaVersion'), 'java8u121');

                this.logger.log(`Generated JNLP file: ${jnlpPath}`);
                return jnlpPath;

            } catch (error) {
                this.logger.error(`Failed to generate JNLP: ${error.message}`);
                // Return path anyway - container will try to use environment variables
                const jnlpPath = path.join(sessionDir, 'starter.jnlp');
                // Write a minimal JNLP that will trigger the container to use env vars
                await fs.writeFile(jnlpPath, '<!-- JNLP generation failed, container will use env vars -->');
                return jnlpPath;
            } finally {
                // Always restore SSL verification
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
            }
        } catch (err) {
            this.logger.error(`JNLP session directory error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Check if a container is running
     */
    private async isContainerRunning(containerId: string): Promise<boolean> {
        try {
            const { stdout } = await execAsync(
                `docker inspect -f '{{.State.Running}}' ${containerId}`
            );
            return stdout.trim() === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Stop a console session
     */
    async stopConsoleSession(sessionId: string): Promise<void> {
        const containerInfo = this.activeContainers.get(sessionId);
        if (!containerInfo) {
            this.logger.warn(`Session ${sessionId} not found`);
            return;
        }

        this.logger.log(`Stopping console session: ${sessionId}`);

        try {
            await execAsync(`docker stop ${containerInfo.containerId}`);
        } catch (error) {
            this.logger.warn(`Error stopping container: ${error.message}`);
        }

        // Cleanup temp IPMI user if exists
        if (containerInfo.tempUserId && containerInfo.originalCredentials) {
            try {
                this.logger.log(`Cleaning up temp IPMI user ${containerInfo.tempUsername} (ID ${containerInfo.tempUserId})`);
                const { host, username, password } = containerInfo.originalCredentials;
                await this.ipmiService.deleteUser({
                    host,
                    user: username,
                    pass: password
                }, containerInfo.tempUserId);
            } catch (error) {
                this.logger.error(`Failed to delete temp IPMI user: ${error.message}`);
            }
        }

        this.releasePort(containerInfo.port);
        this.activeContainers.delete(sessionId);
    }

    /**
     * Get session status
     */
    getSessionStatus(sessionId: string): ContainerInfo | null {
        return this.activeContainers.get(sessionId) || null;
    }

    /**
     * List all active sessions
     */
    listActiveSessions(): ContainerInfo[] {
        return Array.from(this.activeContainers.values());
    }

    /**
     * Update heartbeat for a session
     */
    updateHeartbeat(sessionId: string): boolean {
        const container = this.activeContainers.get(sessionId);
        if (!container) {
            return false;
        }
        // Extend expiry by 5 minutes on heartbeat
        container.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        return true;
    }

    /**
     * Cleanup expired containers
     */
    private async cleanupExpiredContainers(): Promise<void> {
        const now = new Date();
        const expiredSessions: string[] = [];

        for (const [sessionId, info] of this.activeContainers.entries()) {
            if (info.expiresAt < now) {
                expiredSessions.push(sessionId);
            }
        }

        for (const sessionId of expiredSessions) {
            this.logger.log(`Cleaning up expired session: ${sessionId} `);
            await this.stopConsoleSession(sessionId);
        }
    }

    /**
     * Stop all containers (used on shutdown)
     */
    async stopAllContainers(): Promise<void> {
        this.logger.log('Stopping all console containers...');
        const sessions = Array.from(this.activeContainers.keys());
        for (const sessionId of sessions) {
            await this.stopConsoleSession(sessionId);
        }
    }
}
