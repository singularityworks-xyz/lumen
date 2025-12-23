FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY packages/configs/package.json ./packages/configs/
COPY apps/workers/package.json ./apps/workers/
RUN bun install
COPY packages/db ./packages/db
COPY packages/logger ./packages/logger
COPY packages/configs ./packages/configs
COPY apps/workers ./apps/workers
WORKDIR /app/packages/db
RUN bun prisma generate
WORKDIR /app/apps/workers
RUN bun build src/index.ts --outdir=dist --target=bun --minify


FROM oven/bun:alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/logger/node_modules ./packages/logger/node_modules
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/logger/src ./packages/logger/src
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/apps/workers/package.json ./apps/workers/
WORKDIR /app/apps/workers
ENV NODE_ENV=production \
  PORT=3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3002/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
RUN addgroup -g 1001 -S nodejs && \
  adduser -S elysia -u 1001 && \
  chown -R elysia:nodejs /app
USER elysia
EXPOSE 3002
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "dist/index.js"]
