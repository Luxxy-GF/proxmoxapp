import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ShellService {
    private readonly logger = new Logger(ShellService.name);

    async exec(command: string): Promise<{ stdout: string; stderr: string }> {
        this.logger.debug(`Executing: ${command}`);
        try {
            const { stdout, stderr } = await execAsync(command);
            if (stderr) {
                this.logger.warn(`Command stderr: ${stderr}`);
            }
            return { stdout, stderr };
        } catch (error) {
            this.logger.error(`Command failed: ${command}`, error);
            throw error;
        }
    }

    /**
     * Safe wrapper for reloading systemd services
     * Requires sudoers permission for the agent user
     */
    async reloadService(serviceName: string): Promise<void> {
        // Validate service name to prevent injection
        if (!/^[a-zA-Z0-9\-\.]+$/.test(serviceName)) {
            throw new Error(`Invalid service name: ${serviceName}`);
        }
        await this.exec(`sudo /usr/bin/systemctl reload ${serviceName}`);
    }
}
