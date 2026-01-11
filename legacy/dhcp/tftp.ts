
import tftp from 'node-tftp';
import fs from 'fs';
import path from 'path';

// Configuration
const TFTP_ROOT = path.join(process.cwd(), 'tftpboot');
const PORT = 69;

// Ensure root exists
if (!fs.existsSync(TFTP_ROOT)) {
    fs.mkdirSync(TFTP_ROOT, { recursive: true });
    console.log(`[TFTP] Created root directory: ${TFTP_ROOT}`);
}

const server = tftp.createServer({
    host: '10.15.0.1',
    port: PORT,
    root: TFTP_ROOT,
    denyPUT: true // Read-only
});

server.on('error', (err) => {
    console.error(`[TFTP] Error: ${err.message}`);
});

server.on('listening', () => {
    console.log(`[TFTP] Server listening on 10.15.0.1:${PORT} serving ${TFTP_ROOT}`);
});

server.on('request', (req, res) => {
    console.log(`[TFTP] Allowed request for ${req.file} from ${req.stats.remoteAddress}`);
    // The library handles serving files from root automatically
});

try {
    server.listen();
} catch (e) {
    console.error(`[TFTP] Failed to start:`, e);
}
