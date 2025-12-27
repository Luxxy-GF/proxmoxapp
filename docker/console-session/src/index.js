const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Environment
const TYPE = process.env.TYPE || 'HTML5'; // 'HTML5' or 'JAVA'
const BMC_URL = process.env.BMC_URL;
const BMC_USER = process.env.BMC_USER;
const BMC_PASS = process.env.BMC_PASS;
const RESOLUTION = process.env.RESOLUTION || '1280x1024x16';
const DISPLAY = process.env.DISPLAY || ':0';

console.log(`[LumenConsole] Starting Session Type: ${TYPE} - VERSION 2.0 (SSL+Wait)`);

// Helper to wait for X11 socket
function waitForX11() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            // Check if X11 socket exists (abstract or file)
            // Simplest check: try listing /tmp/.X11-unix
            try {
                if (attempts > 50) { // 5 seconds
                    clearInterval(interval);
                    reject("X11 Timed Out");
                }
                // We'll just rely on x11vnc's ability or wait slightly longer fixed time + xdpyinfo if needed.
                // Better: just wait 2 seconds safe margin for MVP.
                // Real check involves fs.accessSync('/tmp/.X11-unix/X0') but node in docker might differ.
            } catch (e) { }
        }, 100);

        // For now, simpler: Just a robust 3 second delay.
        setTimeout(() => {
            clearInterval(interval);
            resolve();
        }, 3000);
    });
}

(async () => {
    // 1. Start Xvfb
    console.log('[LumenConsole] Starting Xvfb...');
    spawn('Xvfb', [DISPLAY, '-screen', '0', RESOLUTION], { stdio: 'inherit' });

    await waitForX11();

    // 2. Start Window Manager (Openbox)
    console.log('[LumenConsole] Starting Openbox...');
    spawn('openbox-session', [], { env: process.env, stdio: 'ignore' });

    // 3. Start x11vnc
    console.log('[LumenConsole] Starting x11vnc...');
    spawn('x11vnc', ['-display', DISPLAY, '-forever', '-shared', '-nopw', '-bg'], { stdio: 'inherit' });

    // Start Websockify (Plain WS)
    console.log('[LumenConsole] Starting websockify...');
    spawn('websockify', ['--web=/usr/share/novnc', '8080', 'localhost:5900'], { stdio: 'inherit' });

    // Start File Watcher for JNLP (Auto-Launch Java)
    const downloads = path.join(process.env.HOME || '/root', 'Downloads');
    if (!fs.existsSync(downloads)) {
        fs.mkdirSync(downloads, { recursive: true });
    }

    console.log(`[LumenConsole] Watching for JNLP in: ${downloads}`);
    fs.watch(downloads, (eventType, filename) => {
        if (filename && filename.endsWith('.jnlp')) {
            console.log(`[LumenConsole] Detected JNLP: ${filename}`);
            const filePath = path.join(downloads, filename);

            // Give it a moment to finish write
            setTimeout(() => {
                console.log(`[LumenConsole] Launching javaws for ${filename}...`);
                spawn('javaws', [filePath], { stdio: 'inherit' });
            }, 2000);
        }
    });

    if (TYPE === 'HTML5') {
        launchHtml5();
    } else {
        await launchJava(); // launchJava is async
    }
})();

function launchHtml5() {
    console.log(`[LumenConsole] Launching Chromium for ${BMC_URL}`);
    // Basic Kiosk
    const args = [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--disable-software-rasterizer',
        '--window-size=1280,1024',
        '--kiosk',
        '--start-maximized',
        '--disable-infobars',
        '--ignore-certificate-errors',
        BMC_URL
    ];

    spawn('chromium', args, { stdio: 'inherit' });
}

async function launchJava() {
    console.log(`[LumenConsole] Java Mode: Launching Browser to acquire JNLP...`);
    launchHtml5();
}
