#!/bin/bash
# IPMI Console Container Entrypoint
# Environment variables expected:
#   CONSOLE_TYPE: 'web' | 'java'
#   IPMI_HOST: BMC IP address
#   IPMI_PORT: IPMI port (default 623)
#   IPMI_USER: Username
#   IPMI_PASS: Password
#   SESSION_TOKEN: Session token for validation

set -e

echo "Starting IPMI Console Container..."
echo "Console Type: ${CONSOLE_TYPE:-web}"
echo "IPMI Host: ${IPMI_HOST:-not set}"

# Validate required environment variables
if [ -z "$IPMI_HOST" ]; then
    echo "ERROR: IPMI_HOST not set"
    exit 1
fi

if [ -z "$IPMI_USER" ]; then
    echo "ERROR: IPMI_USER not set"
    exit 1
fi

# Start Xvfb (virtual framebuffer display)
echo "Starting Xvfb..."
Xvfb :99 -screen 0 1280x1024x24 &
sleep 2

# Start window manager (openbox)
echo "Starting Openbox..."
DISPLAY=:99 openbox &
sleep 1

# Start x11vnc to capture the display
echo "Starting x11vnc..."
x11vnc -display :99 -forever -shared -rfbport 5900 -noxdamage -nopw -quiet &
sleep 1

# Start noVNC websockify proxy
echo "Starting noVNC websockify..."
websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

# Start the appropriate console
if [ "$CONSOLE_TYPE" = "java" ]; then
    echo "Java console mode - preparing JNLP..."
    
    # Try to fetch JNLP from BMC
    # This varies by vendor - placeholder for now
    echo "Java console not yet implemented in this build"
    
    # For now, fall back to web console
    CONSOLE_TYPE="web"
fi

if [ "$CONSOLE_TYPE" = "web" ]; then
    echo "Web console mode - launching Chromium..."
    
    # Construct BMC URL
    BMC_URL="https://${IPMI_HOST}/"
    
    # Launch Chromium with security flags
    DISPLAY=:99 chromium \
        --no-sandbox \
        --disable-gpu \
        --disable-software-rasterizer \
        --disable-dev-shm-usage \
        --disable-setuid-sandbox \
        --ignore-certificate-errors \
        --start-maximized \
        --kiosk \
        --window-size=1280,1024 \
        --user-data-dir=/tmp/chromium \
        "${BMC_URL}" &
    
    BROWSER_PID=$!
    
    echo "Chromium started with PID: ${BROWSER_PID}"
    echo "BMC URL: ${BMC_URL}"
    echo "Login credentials available in environment"
fi

echo "Console container ready."
echo "noVNC available at http://localhost:6080/vnc.html"

# Keep container running
wait
