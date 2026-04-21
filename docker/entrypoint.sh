#!/bin/sh
set -e

echo "[entrypoint] running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting next.js..."
exec node server.js
