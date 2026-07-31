# Multi-stage: build with dev dependencies, ship only dist + production deps.
#
# Debian slim rather than alpine: sharp (image resizing) runs on its fast glibc
# prebuilds instead of the musl variants, and npm is measurably less flaky here.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# Retries and capped sockets because registry networks flake — a build should
# not fail on one dropped connection, whether in CI or on the server.
RUN npm config set fetch-retries 5 fetch-retry-maxtimeout 120000 maxsockets 8 && \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev

# ---------------------------------------------------------------- runtime
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# Run as a non-root user — a compromised process should not own the container.
RUN groupadd -r app && useradd -r -g app app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./
COPY --chown=app:app docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER app
EXPOSE 3000

# slim has no wget/curl; node's built-in fetch does the job.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
