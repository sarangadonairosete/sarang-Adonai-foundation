#!/usr/bin/env bash
set -euo pipefail

if [[ -f package.json && -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
elif [[ -f package.json ]]; then
  npm install --no-audit --no-fund
fi

if [[ -d worker/src ]]; then
  for source in worker/src/*.js; do
    [[ -f "$source" ]] && node --check "$source"
  done
fi

if [[ -f admin/records.js ]]; then
  node --check admin/records.js
fi
