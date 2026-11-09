#!/usr/bin/env bash
# Builds dist/tank-tools.zip, ready for Appearance → Themes → Upload Theme.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/tank-tools.zip
zip -qr dist/tank-tools.zip tank-tools -x '*.DS_Store'
echo "Built dist/tank-tools.zip"
