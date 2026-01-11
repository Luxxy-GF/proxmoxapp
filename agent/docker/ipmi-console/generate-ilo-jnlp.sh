#!/bin/bash
# Generate JNLP for HP iLO matching standard output
BMC_IP="$1"
USERNAME="$2"
PASSWORD="$3"
OUTPUT="$4"

# Login and get session
LOGIN_RESPONSE=$(curl -ks -X POST "https://$BMC_IP/json/login_session" \
    -H "Content-Type: application/json" \
    -d "{\"method\":\"login\",\"user_login\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    -c /tmp/ilo_cookies.txt)

SESSION_KEY=$(echo "$LOGIN_RESPONSE" | grep -oP '"session_key"\s*:\s*"\K[^"]+')
echo "Session key: $SESSION_KEY"

# Get RC info
RC_INFO=$(curl -ks -b /tmp/ilo_cookies.txt "https://$BMC_IP/json/rc_info")
echo "RC Info: $RC_INFO"

ENC_KEY=$(echo "$RC_INFO" | grep -oP '"enc_key"\s*:\s*"\K[^"]+')
RC_PORT=$(echo "$RC_INFO" | grep -oP '"rc_port"\s*:\s*\K[0-9]+')
VM_KEY=$(echo "$RC_INFO" | grep -oP '"vm_key"\s*:\s*"\K[^"]+')
VM_PORT=$(echo "$RC_INFO" | grep -oP '"vm_port"\s*:\s*\K[0-9]+')

# Use VM_PORT for INFO1 as seen in standard iLO JNLP
# (Even though it seems counter-intuitive, we must match the working JNLP)
# Standard JNLP uses 17988 for INFO1

cat > "$OUTPUT" << JNLP
<?xml version="1.0" encoding="UTF-8"?>
<jnlp spec="1.0+" codebase="https://$BMC_IP:443/">
<information>
    <title>Integrated Remote Console</title>
    <vendor>HPE</vendor>
    <offline-allowed></offline-allowed>
</information>
<security>
    <all-permissions></all-permissions>
</security>
<resources>
    <j2se version="1.5+" href="http://java.sun.com/products/autodl/j2se"></j2se>
    <jar href="https://$BMC_IP/html/intgapp4_232.jar" main="false"></jar>
</resources>
<property name="deployment.trace.level property" value="basic"></property>
<applet-desc main-class="com.hp.ilo2.intgapp.intgapp" name="iLOJIRC" documentbase="https://$BMC_IP/html/java_irc.html" width="1" height="1">
    <param name="RCINFO1" value="$SESSION_KEY"></param>
    <param name="RCINFOLANG" value="en"></param>
    <param name="INFO0" value="$ENC_KEY"></param>
    <param name="INFO1" value="$VM_PORT"></param>
    <param name="INFO2" value="composite"></param>
</applet-desc>
<update check="background"></update>
</jnlp>
JNLP

echo "Generated JNLP saved to $OUTPUT"
grep "INFO1" "$OUTPUT"
