#!/bin/sh
set -eu
umask 077

node scripts/check-config.mts
node scripts/init-storage.mjs
# Deploy committed migrations only. Never reset or push a schema in production.
node node_modules/prisma/build/index.js migrate deploy
node --input-type=module -e 'import { logEvent } from "./lib/logger.mjs"; logEvent("server.starting");'
exec node server.js
