#!/bin/sh
# Migrations run before the app starts, so a deploy is schema-first and a
# container that boots is a container whose schema matches its code. With a
# single API instance this is safe; if the API is ever scaled out, migrations
# move to a dedicated one-shot job instead.
set -e

echo "Running database migrations..."
node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run

# Reference data — the 14 regions, their districts and the categories. Without
# it no listing can be posted at all, because region and category are required.
#
# Off by default: the standard deploy seeds once by hand and a re-run on every
# restart is pointless write traffic. Platforms with no shell access (Render's
# free tier) set SEED_ON_START=true instead. The seed matches on slug and
# updates in place, so running it repeatedly is safe.
if [ "${SEED_ON_START}" = "true" ]; then
  echo "Seeding reference data..."
  node dist/database/seeds/run-seed.js
fi

echo "Starting Agromagnat backend..."
exec node dist/main.js
