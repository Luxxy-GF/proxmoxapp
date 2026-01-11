#!/bin/bash

cd /var/www/ISOs

function getDigitalSigs() {
	if [ -f "/tmp/executedExtractCrts" ]; then
		return 1
	fi

	getJar=$(cat "$1" | grep '<jar ' | head -n1 | grep -oP 'href="\K[^"]+')
	getHost=$(cat "$1" | grep '<jnlp ' | head -n1 | grep -oP 'codebase="\K[^"]+')

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

	touch /tmp/executedExtractCrts
}

function setupSecurityAndStart() {
	if [ "$backendHost" != "" ]; then
		yad --info --title="Please wait" --text="One moment, the application is starting.\n\nThis dialog will be closed automatically in a few seconds." --no-buttons --center --height=100 &
		xMessagePid=$!

		echo "Q" | timeout 5 openssl s_client -connect "$backendHost:443" 2>/dev/null | openssl x509 >/workdir/backendHost.crt
		mkdir -p /config/xdg/config/icedtea-web/security/
		keytool -import -trustcacerts -keystore "/config/xdg/config/icedtea-web/security/trusted.certs" -storepass changeit -noprompt -alias backendHost -file /workdir/backendHost.crt
		rm -f /workdir/backendHost.crt
		getDigitalSigs "$1"

		if [ "$xMessagePid" != "" ]; then
			kill -9 $xMessagePid
		fi
	fi
}

function extractFilename() {
	local filepath=$1
	local filename=$(basename "$filepath")

	echo "$filename"
}

FILE=$1

CHOICE=$(yad --list --radiolist \
	--title="Open with Java Web Start" \
	--text="Select the Java version to use for opening the file \"$(extractFilename $1)\".\n\nRecommended selections are marked with descriptions." \
	--width=600 --height=300 \
	--center \
	--column="Select" --column="Java Version" --column="Description" \
	FALSE "Java 8 u121" "Compatible with most Java viewers" \
	TRUE "Java 8 (latest)" "Compatible with most Java viewers" \
	FALSE "Java 11" "Use if other versions fail" \
	--button="OK:0" --button="Cancel:1")

if [ $? -eq 0 ]; then
	case "$CHOICE" in
	*"Java 8 u121"*)
		export JAVA_HOME="/usr/lib/jvm/java8u121"
		;;
	*"Java 8 (latest)"*)
		setupSecurityAndStart "$1"
		export JAVA_HOME="/usr/lib/jvm/java-8-openjdk-amd64/"
		;;
	*"Java 11"*)
		setupSecurityAndStart "$1"
		export JAVA_HOME="/usr/lib/jvm/java-1.11.0-openjdk-amd64/"
		;;
	*)
		echo "No valid choice selected"
		exit 1
		;;
	esac
else
	exit 1
fi

getHost=$(cat "$1" | grep '<jnlp ' | head -n1 | grep -oP 'codebase="\K[^"]+')
mkdir -p /root/.java/deployment/security/
mkdir -p /var/www/.java/deployment/security/
echo "$getHost" >/root/.java/deployment/security/exception.sites
echo "$getHost" >/var/www/.java/deployment/security/exception.sites

javaCommandPrefix=""
if [ -n "$fakeJavaDate" ]; then
	javaCommandPrefix="faketime --exclude-monotonic $fakeJavaDate "
fi

$javaCommandPrefix javaws "$FILE"
