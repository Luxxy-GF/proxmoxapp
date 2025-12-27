import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GET - Check dnsmasq service status
export async function GET() {
    try {
        const { stdout } = await execAsync("systemctl is-active dnsmasq");
        const isActive = stdout.trim() === "active";

        // Get more detailed status
        const { stdout: statusOutput } = await execAsync("systemctl status dnsmasq --no-pager 2>&1 | head -20");

        // Get recent log entries
        let logOutput = "";
        try {
            const { stdout: logs } = await execAsync("tail -20 /var/log/dnsmasq-pxe.log 2>/dev/null || echo 'No logs available'");
            logOutput = logs;
        } catch {
            logOutput = "Log file not available";
        }

        return NextResponse.json({
            active: isActive,
            status: stdout.trim(),
            details: statusOutput,
            recentLogs: logOutput
        });
    } catch (error) {
        // Service might be stopped or not installed
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({
            active: false,
            status: "inactive",
            details: errorMessage,
            recentLogs: ""
        });
    }
}
