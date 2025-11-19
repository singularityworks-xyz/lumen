FROM node:25-alpine AS base
RUN npm install -g pnpm@10.22.0
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps ./apps
COPY packages ./packages
COPY turbo.json ./
ENV NODE_ENV=production
RUN CI=true pnpm install --frozen-lockfile
WORKDIR /app/apps/web
RUN pnpm build

FROM node:25-alpine AS production
RUN apk add --no-cache nginx libc6-compat curl && \
    npm install -g pnpm@10.22.0
RUN mkdir -p /etc/nginx/conf.d /etc/ssl/certs /etc/ssl/private /var/log/nginx /var/cache/nginx /run/nginx
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app ./
RUN CI=true pnpm prune --prod
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY --from=nginx:alpine /etc/nginx/mime.types /etc/nginx/mime.types
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "Starting Next.js application..."' >> /start.sh && \
    echo 'cd /app/apps/web && pnpm start &' >> /start.sh && \
    echo 'sleep 5' >> /start.sh && \
    echo 'echo "Starting Nginx..."' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh
EXPOSE 80
CMD ["/start.sh"]
