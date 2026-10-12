#!/usr/bin/env bash
set -euo pipefail
cd /workspace/grafik
if node --input-type=module -e 'const r=await fetch("http://127.0.0.1:3001/api/state");if(!r.ok)process.exit(1);const s=await r.json();if(!Array.isArray(s.employees)||s.employees.length!==6||!s.settings.rulesVersion)process.exit(1)' 2>/dev/null; then
  echo 'Grafik Emisji już działa; API zwróciło zespół i profil reguł.'
  exit 0
fi
if [ ! -f dist/index.html ]; then npm run build; fi
exec node server.js
