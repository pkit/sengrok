#!/bin/bash
set -e

yarn esbuild cli/main.js \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node16 \
  --outfile=cli/dist/main.mjs \
  --packages=external \
  --banner:js='#!/usr/bin/env node'

chmod +x cli/dist/main.mjs
