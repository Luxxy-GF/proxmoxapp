#!/bin/bash
# Main startup script for IPMI KVM Console
# Based on Tenantos implementat#!/bin/bash

# e.g. HP iLO does not use the home directory. If opening the mount ISO dialog, the default directory (the directory that is opened by default in the file browser) should be /var/www or /var/www/ISOs
# This does fix the issue for HP iLO (other KVM viewers does not seem to have this issue)
mkdir -p /var/www/ISOs
cd /var/www/ISOs

# Fix HOME to avoid /dev/null issues (added by agent)
export HOME=/config

function getDigitalSigs() {
	getJar=$(cat /app/starter.jnlp | grep '<jar ' | head -n1 | grep -oP 'href="\K[^"]+')
	getHost=$(cat /app/starter.jnlp | grep '<jnlp ' | head -n1 | grep -oP 'codebase="\K[^"]+')

	if [[ "$getJar" == *://* ]]; then
		finalUrl=$(echo "$getJar")
	else
		finalUrl=$(echo "$getHost/$getJar" | sed 's@//@/@g' | sed 's@//@/@g' | sed 's@:/@://@g')
	fi

	if [ "$getJar" != "" ]; then
		wgetWithHeader=$(wget --no-check-certificate "$finalUrl" -O /workdir/extracted.jar --server-response 2>&1 | tee /dev/tty)
		contentType=$(echo "$wgetWithHeader" | grep -i 'Content-Type:')

		if [[ ! "$contentType" =~ application/ ]]; then
			rm -f /workdir/extracted.jar
			wget --no-check-certificate "${finalUrl}.pack.gz" -O /workdir/extracted.pack.gz
			unpack200 /workdir/extracted.pack.gz /workdir/extracted.jar
			rm -f /workdir/extracted.pack.gz
		fi

		keytool -printcert -jarfile /workdir/extracted.jar -rfc | awk '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/' >/workdir/ssl
		keytool -importcert -noprompt -trustcacerts -alias "jarTrusted" -file /workdir/ssl -storepass changeit -keystore /config/xdg/config/icedtea-web/security/trusted.certs

		rm -f /workdir/ssl
		rm -f /workdir/extracted.jar
	fi
}

mkdir -p /config/xdg/config/icedtea-web/
echo "deployment.security.level=ALLOW_UNSIGNED" >/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.manifest.attributes.check=NONE" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.whitelist=https://*:443" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.jsse.hostmismatch.warning=false" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.itw.ignorecertissues=true" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.expired.warning=false" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.validation.ocsp=false" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.tls.revocation.check=NO_CHECK" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.mixcode=DISABLE" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.security.revocation.check=NO_CHECK" >>/config/xdg/config/icedtea-web/deployment.properties

# Enable verbose logging (Agent added)
echo "deployment.log=true" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.trace=true" >>/config/xdg/config/icedtea-web/deployment.properties
echo "deployment.trace.level=all" >>/config/xdg/config/icedtea-web/deployment.properties

mkdir -p /root/.java/deployment/security/
mkdir -p /var/www/.java/deployment/security/

# for java 8u121
echo "deployment.security.level=ALLOW_UNSIGNED" >/var/www/.java/deployment/deployment.properties
echo "deployment.manifest.attributes.check=NONE" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.whitelist=https://*:443" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.jsse.hostmismatch.warning=false" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.itw.ignorecertissues=true" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.expired.warning=false" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.validation.ocsp=false" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.tls.revocation.check=NO_CHECK" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.mixcode=DISABLE" >>/var/www/.java/deployment/deployment.properties
echo "deployment.security.revocation.check=NO_CHECK" >>/var/www/.java/deployment/deployment.properties

if [ -f "/app/startVnc.sh" ]; then
	bash /app/startVnc.sh
else
	# quick fix for #JRA-6932-167. Should all be done in a separate function.
	getHost=$(cat /app/starter.jnlp | grep '<jnlp ' | head -n1 | grep -oP 'codebase="\K[^"]+')

	echo "$getHost" >/root/.java/deployment/security/exception.sites
	echo "$getHost" >/var/www/.java/deployment/security/exception.sites

	if [ -f "/app/javaVersion" ]; then
		getJavaVersion=$(cat /app/javaVersion)
		if [ -d "/usr/lib/jvm/$getJavaVersion" ]; then
			#rm -rf /usr/lib/jvm/default-java
			#ln -s /usr/lib/jvm/$getJavaVersion /usr/lib/jvm/default-java
			#echo "Use Java $getJavaVersion"
			echo "Use Java $getJavaVersion" >>/tmp/usedJava
			export JAVA_HOME="/usr/lib/jvm/$getJavaVersion/"
		else
			echo "Java directory does not exist" >>/tmp/usedJava
		fi
	else
		echo "No java override file" >>/tmp/usedJava
	fi

	if [ "$backendHost" != "" ] && [ "$getJavaVersion" != "java8u121" ]; then
		yad --info --title="Please wait" --text="One moment, the application is starting.\n\nThis dialog will be closed automatically in a few seconds." --no-buttons --center --height=100 &
		xMessagePid=$!

		echo "Q" | timeout 5 openssl s_client -connect "$backendHost:443" 2>/dev/null | openssl x509 >/workdir/backendHost.crt
		mkdir -p /config/xdg/config/icedtea-web/security/
		keytool -import -trustcacerts -keystore "/config/xdg/config/icedtea-web/security/trusted.certs" -storepass changeit -noprompt -alias backendHost -file /workdir/backendHost.crt
		rm -f /workdir/backendHost.crt
		getDigitalSigs

		if [ "$xMessagePid" != "" ]; then
			kill -9 $xMessagePid
		fi
	fi

	javaCommandPrefix=""
	if [ -n "$fakeJavaDate" ]; then
		javaCommandPrefix="faketime --exclude-monotonic $fakeJavaDate "
	fi

	if [ "$getJavaVersion" == "java8u121" ]; then
		if [ -n "$JAVA_BIN_EXECUTION" ] && [ -n "$JAVA_BIN_ARGUMENTS" ]; then
			echo "$JAVA_BIN_ARGUMENTS" | xargs /usr/lib/jvm/java8u121/bin/java
		else
			# Nicht einfach per javaws starten, auch wenn aufgrund von $JAVA_HOME die richtige Version genutzt werden würde.
			# Es macht Probleme, z.B. bei HP iLO (diese Warnung wird als full screen angezeigt, anstatt als kleines Fenster)
			$javaCommandPrefix /usr/lib/jvm/java8u121/bin/javaws -verbose -J-Duser.home=/config /app/starter.jnlp -noupdate
		fi
	else
		if [ -n "$JAVA_BIN_EXECUTION" ] && [ -n "$JAVA_BIN_ARGUMENTS" ]; then
			echo "$JAVA_BIN_ARGUMENTS" | xargs java
		else
			$javaCommandPrefix javaws -verbose -J-Duser.home=/config /app/starter.jnlp -noupdate
		fi
	fi

	while true; do
		isRunning=$(ps aux | grep java | grep -v grep)

		if [ "$isRunning" == "" ]; then
			break
		fi
		sleep 0.5
	done
fi
