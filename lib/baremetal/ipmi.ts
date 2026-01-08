
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
    // Added -C 3 (Cipher Suite 3) for performance on legacy BMCs
    const env = { ...process.env, IPMI_PASSWORD: creds.pass };
    const command = `ipmitool -I lanplus -C 3 -H "${creds.host}" -U "${creds.user}" -E ${args.join(' ')}`;

    try {
        // Enforce 15 second timeout (increased from 10s)
        const { stdout, stderr } = await execAsync(command, { env, timeout: 15000 });
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
 * Execute an IPMI command with retries
 */
export async function runIpmiCommandWithRetry(
    creds: IpmiCredentials,
    args: string[],
    retries = 3,
    delayMs = 2000
): Promise<IpmiResult> {
    let lastResult: IpmiResult = { success: false, output: '', error: 'Not started' };

    for (let i = 0; i < retries; i++) {
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        lastResult = await runIpmiCommand(creds, args);
        if (lastResult.success) {
            return lastResult;
        }
        console.warn(`IPMI command failed (attempt ${i + 1}/${retries}): ${args.join(' ')} - ${lastResult.error}`);
    }

    return lastResult;
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

/**
 * Wait for a specific power status
 */
export async function waitForPowerStatus(
    creds: IpmiCredentials,
    targetStatus: 'on' | 'off',
    maxAttempts = 10,
    delayMs = 2000
): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        const { status, success } = await getPowerStatus(creds);
        if (success && status === targetStatus) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
}
