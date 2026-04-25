FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock* turbo.json ./
COPY scripts/install/prepare.ts ./scripts/install/
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY packages/ai/package.json ./packages/ai/
COPY packages/configs/package.json ./packages/configs/
COPY packages/yjs-shared/package.json ./packages/yjs-shared/
COPY apps/workers/package.json ./apps/workers/
COPY packages/db/prisma ./packages/db/prisma
RUN apk add --no-cache git
RUN bun install
COPY packages/db ./packages/db
COPY packages/logger ./packages/logger
COPY packages/ai ./packages/ai
COPY packages/configs ./packages/configs
COPY packages/yjs-shared ./packages/yjs-shared
COPY apps/workers ./apps/workers
WORKDIR /app/apps/workers
RUN bun build src/index.ts --outdir=dist --target=bun --minify

FROM oven/bun:alpine
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/node_modules ./packages/logger/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/yjs-shared/node_modules ./packages/yjs-shared/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/src ./packages/logger/src
COPY --from=builder --chown=appuser:appgroup /app/packages/ai/src ./packages/ai/src
COPY --from=builder --chown=appuser:appgroup /app/packages/yjs-shared/src ./packages/yjs-shared/src
COPY --from=builder --chown=appuser:appgroup /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/workers/package.json ./apps/workers/
WORKDIR /app/apps/workers
ENV NODE_ENV=production PORT=3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3002/health || exit 1
EXPOSE 3002
USER appuser
CMD ["bun", "run", "dist/index.js"]
