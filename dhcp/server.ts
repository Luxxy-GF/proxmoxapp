
import dhcp from 'dhcp';
import { prisma } from '../lib/db';
import { networkInterfaces } from 'os';
// import .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Prisma is already initialized in lib/db


const SERVER_IP = '10.15.0.1';
const SUBNET_MASK = '255.255.255.0';
const RANGE_START = '10.15.0.100';
const RANGE_END = '10.15.0.200';
const ROUTER = '10.15.0.1';
const DNS = '8.8.8.8';
const HTTP_BOOT_URL = `http://${SERVER_IP}:3000/api/pxe/ipxe`;

// Dynamic Boot File Logic
const bootFileFunc = function (this: any, req: any, res: any) {
    try {
        // req is the options object itself (in node-dhcp injection)
        // Option 77: User Class
        // Option 60: Vendor Class
        // Option 93: Client System Architecture

        // Use MAC from 'client-identifier' (61) or fallback to 'chaddr' if available in 'this' context?
        // In node-dhcp, 'this' inside config function is the Server instance.
        // We can access current request via this._req
        // @ts-ignore
        const currentReq = this._req;
        const mac = currentReq ? currentReq.chaddr : 'unknown';

        const userClass = req[77] ? req[77].toString() : '';
        const vendorClass = req[60] ? req[60].toString() : '';
        // Check if Option 175 (iPXE) is in the Parameter Request List (Option 55)
        const requestedOptions = req[55] || [];
        const isIpxe = userClass.includes('iPXE') || vendorClass.includes('iPXE') || (Array.isArray(requestedOptions) && requestedOptions.includes(175));

        console.log(`[DHCP] BootFile Check for ${mac}: UserClass=${userClass}, VendorClass=${vendorClass}, isIpxe=${isIpxe}`);

        // iPXE Detection
        if (isIpxe) {
            // Check if we need to loop. iPXE might request again.
            // If it's already iPXE, we instruct it to chainload our script.
            return `${HTTP_BOOT_URL}?mac=${mac}`;
        }

        // Architecture Check (Option 93)
        // req[93] might be an array or buffer. node-dhcp parses based on type.
        // If undefined in opts, it might be passed as raw buffer or hex?
        // Since 93 is not in standard opts, it might be raw.
        // Let's rely on 'ipxe.efi' default for now if detection fails, 
        // as 93 is often 00:00 (BIOS) or 00:07 / 00:09 (EFI).

        // Safe check for 93 if it comes through
        const arch = req[93];
        if (arch) {
            // If buffer, read it. If it's parsed (unlikely without def), use it.
            // For now, simple logic:
            // If the vendor class lacks "PXE", it might be BIOS?
            // Actually, usually default to ipxe.efi is fine for most UEFI servers.
        }

        return 'undionly.kpxe';
    } catch (e) {
        console.error("[DHCP] BootFile Logic Error:", e);
        return 'undionly.kpxe';
    }
};

// Create a server
const server = dhcp.createServer({
    range: [RANGE_START, RANGE_END],
    forceOptions: ['bootFile', 'tftpServer'],
    randomIP: true,
    static: {}, // Populated dynamically via 'message' event hook hook (see below)
    // Dynamic Options
    bootFile: bootFileFunc,
    nextServer: SERVER_IP,
    server: SERVER_IP, // Option 54: Server Identifier (Required)
    tftpServer: SERVER_IP, // Option 66: TFTP Server Name
    netmask: SUBNET_MASK,
    router: [ROUTER],
    dns: [DNS]
});

// Monkey Patch: Filter out Option 60 from requested parameter list to prevent crash
// node-dhcp crashes if client requests Option 60 because it has no 'config' property in options.js
const originalSendOffer = server.sendOffer.bind(server);
// @ts-ignore
server.sendOffer = (req) => {
    if (req.options && req.options[55] && Array.isArray(req.options[55])) {
        // Filter out 60 (Vendor Class Identifier)
        // Also filtering 50, 53, 55, 56, 61 just in case, as they also lack 'config'
        const forbiddenOptions = [50, 53, 55, 56, 60, 61];
        req.options[55] = req.options[55].filter((id: number) => !forbiddenOptions.includes(id));
    }
    return originalSendOffer(req);
};

const originalSendAck = server.sendAck.bind(server);
// @ts-ignore
server.sendAck = (req) => {
    if (req.options && req.options[55] && Array.isArray(req.options[55])) {
        const forbiddenOptions = [50, 53, 55, 56, 60, 61];
        req.options[55] = req.options[55].filter((id: number) => !forbiddenOptions.includes(id));
    }
    return originalSendAck(req);
};

const originalSendNak = server.sendNak.bind(server);
// @ts-ignore
server.sendNak = (req) => {
    if (req.options && req.options[55] && Array.isArray(req.options[55])) {
        const forbiddenOptions = [50, 53, 55, 56, 60, 61];
        req.options[55] = req.options[55].filter((id: number) => !forbiddenOptions.includes(id));
    }
    return originalSendNak(req);
};

// Hook into messages to populate static IP mapping on the fly
server.on('message', async (data) => {
    if (data.options[53] === 1 || data.options[53] === 3) { // DISCOVER or REQUEST
        const mac = data.chaddr;
        console.log(`[DHCP DEBUG] Received request from MAC: '${mac}'`);

        // Normalize MAC: 94-18-... -> 94:18:...
        const normalizedMac = mac.replace(/-/g, ':').toLowerCase();

        console.log(`[DHCP DEBUG] Normalized MAC: '${normalizedMac}'`);

        try {
            // Check if we have a Dedicated Server record
            const dedicated = await prisma.dedicatedServer.findFirst({
                where: { macAddress: normalizedMac }
            });
            console.log(`[DHCP DEBUG] DB Lookup result for '${mac}':`, dedicated ? dedicated.hostname : "null");

            if (dedicated && dedicated.primaryIpv4) {
                console.log(`[DHCP DEBUG] Found Dedicated Server ${dedicated.hostname} (${mac}), assigning ${dedicated.primaryIpv4}`);
                // Inject into the static map of the running server instance
                // @ts-ignore
                if (server.static) {
                    // @ts-ignore
                    server.static[mac] = dedicated.primaryIpv4;
                } else {
                    console.error("[DHCP DEBUG] server.static is undefined! Cannot assign IP.");
                }
            }
        } catch (e) {
            console.error("[DHCP] DB Error", e);
        }
    }
    console.log('[DHCP] Message:', data.options);
});

server.on('listening', (address) => {
    console.log('DHCP Server listening on', address);
});

server.on('bound', (state) => {
    console.log('DHCP Bound:', state);
});

server.on('error', (err, data) => {
    console.log('DHCP Error:', err, data);
});

// Calculate broadcast address
const getBroadcastAddress = () => {
    return '10.15.0.255';
}

// Bind to the specific interface IP
try {
    server.listen({
        address: '0.0.0.0',
        port: 67, // DHCP Server port
        broadcast: getBroadcastAddress()
    });
    console.log(`DHCP Server starting on ${SERVER_IP}...`);
} catch (e) {
    console.error("Failed to start DHCP server:", e);
}
