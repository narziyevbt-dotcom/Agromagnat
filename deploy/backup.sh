#!/bin/sh
# Nightly Postgres backup: pg_dump, gzip, upload to MinIO, 14-day retention
# both locally and in the bucket.
#
# Install (as the deploy user, from the repo root):
#   crontab -e
#   0 2 * * * /opt/agromagnat/deploy/backup.sh >> /var/log/agromagnat-backup.log 2>&1
#
# Restore:
#   gunzip -c backups/agromagnat-YYYY-MM-DD.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$DB_USER" "$DB_NAME"
set -eu

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"
BACKUP_DIR="$APP_DIR/backups"
STAMP="$(date +%F)"
FILE="agromagnat-$STAMP.sql.gz"
RETENTION_DAYS=14

# Read credentials from the same .env the stack runs on.
. "$APP_DIR/.env"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] dumping $DB_NAME..."
$COMPOSE exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILE"

# Refuse to treat an empty dump as a success — that is how you discover a
# broken backup only on the day you need it.
[ -s "$BACKUP_DIR/$FILE" ] || { echo "ERROR: dump is empty"; exit 1; }

echo "[$(date -Iseconds)] uploading to MinIO..."
docker run --rm \
  --network agromagnat-prod_default \
  -v "$BACKUP_DIR":/backups:ro \
  minio/mc:latest \
  sh -c "mc alias set local http://minio:9000 '$S3_ACCESS_KEY' '$S3_SECRET_KEY' >/dev/null && \
         mc mb --ignore-existing local/backups && \
         mc cp /backups/$FILE local/backups/ && \
         mc rm --recursive --force --older-than ${RETENTION_DAYS}d local/backups/ || true"

# Local retention.
find "$BACKUP_DIR" -name 'agromagnat-*.sql.gz' -mtime +$RETENTION_DAYS -delete

echo "[$(date -Iseconds)] done: $FILE ($(du -h "$BACKUP_DIR/$FILE" | cut -f1))"
