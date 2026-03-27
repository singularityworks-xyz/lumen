FROM node:slim AS builder
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"
WORKDIR /app
COPY package.json bun.lock* turbo.json ./
COPY packages/ai/package.json ./packages/ai/
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY packages/native-bridge/package.json ./packages/native-bridge/
COPY packages/yjs-shared/package.json ./packages/yjs-shared/
COPY packages/configs/package.json ./packages/configs/
COPY apps/web/package.json ./apps/web/
COPY packages/db/prisma ./packages/db/prisma
RUN bun install
COPY packages/ai ./packages/ai
COPY packages/db ./packages/db
COPY packages/logger ./packages/logger
COPY packages/native-bridge ./packages/native-bridge
COPY packages/yjs-shared ./packages/yjs-shared
COPY packages/configs ./packages/configs
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN npx next build
FROM oven/bun:alpine
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/node_modules ./packages/logger/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/native-bridge/node_modules ./packages/native-bridge/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/yjs-shared/node_modules ./packages/yjs-shared/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/ai/src ./packages/ai/src
COPY --from=builder --chown=appuser:appgroup /app/packages/ai/package.json ./packages/ai/
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/src ./packages/logger/src
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/package.json ./packages/logger/
COPY --from=builder --chown=appuser:appgroup /app/packages/native-bridge ./packages/native-bridge
COPY --from=builder --chown=appuser:appgroup /app/packages/yjs-shared/index.ts ./packages/yjs-shared/
COPY --from=builder --chown=appuser:appgroup /app/packages/yjs-shared/package.json ./packages/yjs-shared/
COPY --from=builder --chown=appuser:appgroup /app/packages/db ./packages/db
COPY --from=builder --chown=appuser:appgroup /app/packages/configs ./packages/configs
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=appuser:appgroup /app/apps/web/package.json ./apps/web/
COPY --from=builder --chown=appuser:appgroup /app/apps/web/next.config.ts ./apps/web/
COPY --from=builder --chown=appuser:appgroup /app/apps/web/postcss.config.mjs ./apps/web/
COPY --from=builder --chown=appuser:appgroup /app/apps/web/tsconfig.json ./apps/web/
COPY --from=builder --chown=appuser:appgroup /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=appuser:appgroup /app/apps/web/src ./apps/web/src
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1
EXPOSE 3000
USER appuser
CMD ["bun", "run", "start"]
