import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// POST - Restart dnsmasq service
export async function POST() {
    try {
        await execAsync("systemctl restart dnsmasq");

        // Wait a moment and check status
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { stdout } = await execAsync("systemctl is-active dnsmasq");
        const isActive = stdout.trim() === "active";

        return NextResponse.json({
            success: true,
            active: isActive,
            message: isActive ? "dnsmasq restarted successfully" : "dnsmasq failed to start"
        });
    } catch (error) {
        console.error("Error restarting dnsmasq:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            {
                success: false,
                active: false,
                message: `Failed to restart dnsmasq: ${errorMessage}`
            },
            { status: 500 }
        );
    }
}
