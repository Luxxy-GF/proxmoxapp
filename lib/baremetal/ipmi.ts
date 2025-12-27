
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface IpmiCredentials {
    host: string;
    user: string;
    pass: string;
}

export type PowerState = 'on' | 'off' | 'cycle' | 'reset' | 'status' | 'soft';

interface IpmiResult {
    success: boolean;
    output: string;
    error?: string;
}

/**
 * Execute an IPMI command locally using ipmitool
 */
export async function runIpmiCommand(creds: IpmiCredentials, args: string[]): Promise<IpmiResult> {
    // Escape arguments for safety - simplified for this context
    // In production, consider using spawn() instead of exec() to avoid shell injection
    // but ipmitool often needs shell execution for complex piping if needed.
    // Here we'll rely on strict argument construction.

    // Construct command: ipmitool -I lanplus -H <host> -U <user> -P <pass> <args>
    // Use env var for password to avoid shell issues and process list leaks
    const env = { ...process.env, IPMI_PASSWORD: creds.pass };
    const command = `ipmitool -I lanplus -H "${creds.host}" -U "${creds.user}" -E ${args.join(' ')}`;

    try {
        const { stdout, stderr } = await execAsync(command, { env });
        return {
            success: true,
            output: stdout.trim(),
        };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
        };
    }
}

/**
 * Get chassis power status
 */
export async function getPowerStatus(creds: IpmiCredentials): Promise<{ status: string; success: boolean }> {
    const result = await runIpmiCommand(creds, ['chassis', 'power', 'status']);
    if (!result.success) {
        return { status: 'error', success: false };
    }
    // Output format: "Chassis Power is on"
    if (result.output.toLowerCase().includes('is on')) return { status: 'on', success: true };
    if (result.output.toLowerCase().includes('is off')) return { status: 'off', success: true };
    return { status: 'unknown', success: false };
}

/**
 * Control chassis power
 */
export async function setPowerState(creds: IpmiCredentials, action: PowerState): Promise<IpmiResult> {
    // Map 'cycle' to 'cycle' or 'reset' based on strictness. ipmitool supports both.
    return await runIpmiCommand(creds, ['chassis', 'power', action]);
}

/**
 * Set boot device for NEXT boot only (one-time)
 */
export async function setOneTimeBoot(creds: IpmiCredentials, device: 'pxe' | 'disk' | 'bios'): Promise<IpmiResult> {
    return await runIpmiCommand(creds, ['chassis', 'bootdev', device]);
}

/**
 * Get sensor data (simple text format for now)
 */
export async function getSensorSummary(creds: IpmiCredentials): Promise<IpmiResult> {
    return await runIpmiCommand(creds, ['sdr', 'elist']);
}
