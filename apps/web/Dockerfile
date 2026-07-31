# Multi-stage build for the Next.js app, shipping the standalone output.
#
# NEXT_PUBLIC_* values are BUILD arguments, not runtime environment: Next.js
# inlines them into the client bundle at build time. Changing them means
# rebuilding the image — docker-compose.prod.yml passes them from .env.
FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_S3_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_S3_URL=$NEXT_PUBLIC_S3_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# Retries because registry networks flake — a build should not fail on one
# dropped connection, whether in CI or on the server.
RUN npm config set fetch-retries 5 fetch-retry-maxtimeout 120000 && \
    npm ci --no-audit --no-fund

COPY . .
# Every data-driven page is dynamic and its fetches catch failures, so the
# build itself never needs the API to be reachable.
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/ > /dev/null || exit 1

CMD ["node", "server.js"]
