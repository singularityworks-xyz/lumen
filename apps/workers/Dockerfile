FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock* turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY packages/configs/package.json ./packages/configs/
COPY apps/workers/package.json ./apps/workers/
COPY packages/db/prisma ./packages/db/prisma
RUN bun install
COPY packages/db ./packages/db
COPY packages/logger ./packages/logger
COPY packages/configs ./packages/configs
COPY apps/workers ./apps/workers
WORKDIR /app/apps/workers
RUN bun build src/index.ts --outdir=dist --target=bun --minify

FROM oven/bun:alpine AS production
RUN apk add --no-cache dumb-init nginx \
  && rm -rf /var/cache/apk/*
RUN addgroup -g 1001 -S appgroup \
  && adduser -S appuser -u 1001 -G appgroup
RUN mkdir -p /var/lib/nginx/tmp /var/log/nginx /run/nginx \
  && chown -R appuser:appgroup /var/lib/nginx /var/log/nginx /run/nginx
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/node_modules ./packages/logger/node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=appuser:appgroup /app/packages/logger/src ./packages/logger/src
COPY --from=builder --chown=appuser:appgroup /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/workers/package.json ./apps/workers/
COPY --chown=appuser:appgroup apps/workers/nginx.conf /etc/nginx/nginx.conf
WORKDIR /app/apps/workers
ENV NODE_ENV=production \
  PORT=3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
EXPOSE 8080
USER appuser
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "nginx & exec bun run dist/index.js"]
