FROM node:20-alpine

RUN addgroup -g 1001 fcm && \
    adduser -D -u 1001 -G fcm fcm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate && \
    pnpm install --frozen-lockfile --prod

COPY web/dist ./web/dist
COPY bin ./bin
COPY src ./src
COPY scripts /app/scripts
COPY sources.js ./

RUN mkdir -p /home/fcm && chown -R fcm:fcm /app /home/fcm
USER fcm

ENV FCM_HOST=0.0.0.0 \
    FCM_PORT=19280 \
    FREE_CODING_MODELS_TELEMETRY=0 \
    NODE_ENV=production

EXPOSE 19280

COPY --chmod=755 --chown=fcm:fcm docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:19280/health || exit 1
