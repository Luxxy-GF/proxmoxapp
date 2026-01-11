#!/bin/bash
# Fetch JNLP from HP iLO BMC
# Usage: ./fetch-jnlp.sh <BMC_IP> <USERNAME> <PASSWORD>

BMC_IP="${1:-10.0.10.80}"
USERNAME="${2:-admin}"
PASSWORD="${3:-admin}"

OUTPUT_DIR="./app"
mkdir -p "$OUTPUT_DIR"

echo "Fetching JNLP from HP iLO at $BMC_IP..."

# Step 1: Login to get session key
echo "Logging in..."
LOGIN_RESPONSE=$(curl -ks -X POST "https://$BMC_IP/json/login_session" \
    -H "Content-Type: application/json" \
    -d "{\"method\":\"login\",\"user_login\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    -c /tmp/ilo_cookies.txt)

echo "Login response: $LOGIN_RESPONSE"

# Extract session key if present
SESSION_KEY=$(echo "$LOGIN_RESPONSE" | grep -oP '"session_key"\s*:\s*"\K[^"]+' || true)

if [ -z "$SESSION_KEY" ]; then
    echo "Warning: No session key found in response. Trying direct JNLP fetch..."
fi

# Step 2: Fetch the JNLP file
echo "Fetching JNLP..."

# Try different JNLP endpoints (varies by iLO version)
JNLP_URLS=(
    "https://$BMC_IP/html/IRC.jnlp"
    "https://$BMC_IP/html/jnlp"
    "https://$BMC_IP/jnlp/IRC.jnlp"
    "https://$BMC_IP/json/rc_info"
)

for URL in "${JNLP_URLS[@]}"; do
    echo "Trying: $URL"
    RESPONSE=$(curl -ks -b /tmp/ilo_cookies.txt "$URL")
    
    if echo "$RESPONSE" | grep -q "jnlp"; then
        echo "Found JNLP content at $URL"
        echo "$RESPONSE" > "$OUTPUT_DIR/starter.jnlp"
        echo "Saved to $OUTPUT_DIR/starter.jnlp"
        break
    fi
done

# Set Java version for HP iLO (usually needs older Java)
echo "java8u121" > "$OUTPUT_DIR/javaVersion"

echo ""
echo "Done! Files created:"
ls -la "$OUTPUT_DIR/"

echo ""
echo "To test JNLP mode, run:"
echo "docker run -d -p 5800:5800 -v \$(pwd)/app:/app:ro -e backendHost=$BMC_IP --name ipmi-jnlp ipmi-console:latest"
