# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder
# Native SQLite driver fallback when no prebuilt binary exists for the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && cp -a node_modules/. .next/standalone/node_modules/

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data
RUN mkdir -p /data/uploads && chown -R node:node /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/lib/storage-config.mjs /app/lib/logger.mjs ./lib/
COPY --from=builder --chown=node:node /app/lib/database.ts ./lib/database.ts
COPY --from=builder --chown=node:node /app/lib/auth/bootstrap.ts /app/lib/auth/validation.ts /app/lib/auth/environment.ts ./lib/auth/
COPY --from=builder --chown=node:node /app/lib/attachments/config.ts /app/lib/attachments/rules.ts ./lib/attachments/
COPY --from=builder --chown=node:node /app/generated/prisma ./generated/prisma
COPY --from=builder --chown=node:node /app/scripts/init-storage.mjs ./scripts/init-storage.mjs
COPY --from=builder --chown=node:node /app/scripts/create-admin.mts /app/scripts/check-config.mts ./scripts/
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
