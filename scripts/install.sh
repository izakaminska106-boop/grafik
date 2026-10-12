#!/usr/bin/env bash
set -euo pipefail
cd /workspace/grafik
node -e 'if(Number(process.versions.node.split(".")[0])<24) throw Error("Wymagany Node.js 24+")'
npm ci --cache /tmp/grafik-npm-cache --no-fund --no-audit
npm test
npm run build
