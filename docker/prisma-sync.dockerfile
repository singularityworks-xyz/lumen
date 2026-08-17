# syntax=docker/dockerfile:1

FROM oven/bun:1.3.12
LABEL org.opencontainers.image.title="Lumen Prisma Schema Sync" \
      org.opencontainers.image.description="One-shot container that syncs the Prisma schema to the internal PostgreSQL database" \
      org.opencontainers.image.vendor="Lumen"
WORKDIR /app

COPY docker/prisma-package.json ./package.json
RUN bun install

COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/prisma.config.ts ./packages/db/prisma.config.ts

COPY docker/prisma-sync.sh /usr/local/bin/prisma-sync.sh
RUN chmod +x /usr/local/bin/prisma-sync.sh

ENTRYPOINT ["/usr/local/bin/prisma-sync.sh"]
