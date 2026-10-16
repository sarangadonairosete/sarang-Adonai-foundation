#!/usr/bin/env bash
set -euo pipefail

if [[ -f package.json && -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
elif [[ -f package.json ]]; then
  npm install --no-audit --no-fund
fi

if [[ -f worker/src/index.js ]]; then
  node --check worker/src/index.js
fi
