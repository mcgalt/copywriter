#!/usr/bin/env bash
# Builds the two installable zips:
#   dist/tank-tools.zip      the theme   (Appearance → Themes → Upload Theme)
#   dist/tank-flow-sim.zip   the plugin  (Plugins → Add New → Upload Plugin)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
for d in tank-tools tank-flow-sim; do
  rm -f "dist/$d.zip"
  zip -qr "dist/$d.zip" "$d" -x '*.DS_Store'
  echo "Built dist/$d.zip"
done
