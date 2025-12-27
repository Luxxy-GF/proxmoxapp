
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    // Cloud-Init requires a meta-data endpoint.
    // We return minimal info. "instance-id" is useful to prevent re-running if it were persistent, 
    // but for live boot it matters less. We'll use the token or a random ID.

    // We can extract token from URL if needed, but for meta-data strictly, 
    // minimal is:
    // instance-id: <id>
    // local-hostname: <hostname>

    return new NextResponse("instance-id: i-inventory\nlocal-hostname: inventory-scan\n", {
        headers: { 'Content-Type': 'text/plain' }
    });
}
