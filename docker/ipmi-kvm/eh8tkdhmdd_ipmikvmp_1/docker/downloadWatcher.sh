#!/bin/bash

function isFilenameSafe() {
	local filename=$1
	if [[ "$filename" =~ ^[a-zA-Z0-9._\ \-\(\)\@]+\.jnlp$ ]]; then
		echo "safe"
	else
		echo "unsafe"
	fi
}

while true; do
	for i in "/tmp/downloads/new"/*.jnlp; do
		[ -e "$i" ] || continue

		FILENAME=$(basename "$i")
		SAFE=$(isFilenameSafe "$FILENAME")

		if [[ "$SAFE" == "safe" ]]; then
			mv "$i" "/tmp/downloads/old/$1"
			bash /usr/tenantos/scripts/startJnlp.sh "/tmp/downloads/old/$FILENAME" &
		fi
	done

	sleep 0.1
done
