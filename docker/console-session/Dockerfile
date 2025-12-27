FROM debian:12-slim

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Desktop Env & Utils
# openjdk-11-jre + icedtea-netx for legacy
# chromium for HTML5
# x11vnc + xvfb for display
# novnc + websockify for web bridge
RUN apt-get update && apt-get install -y \
    xvfb \
    openbox \
    x11vnc \
    websockify \
    novnc \
    chromium \
    icedtea-netx \
    openjdk-17-jre \
    curl \
    wget \
    scrot \
    nodejs \
    npm \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Fix noVNC index (Ubuntu package sometimes puts it in odd places, symlink for safety)
# Usually /usr/share/novnc/index.html exists.

WORKDIR /app

# Install Node dep for controller
COPY package.json .
RUN npm install

# Copy Controller Scripts
COPY src/ .

# Environment Defaults
ENV DISPLAY=:0
ENV RESOLUTION=1280x1024x16

# Expose WebSocket Port
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]
