#!/bin/sh
# Migrations run before the app starts, so a deploy is schema-first and a
# container that boots is a container whose schema matches its code. With a
# single API instance this is safe; if the API is ever scaled out, migrations
# move to a dedicated one-shot job instead.
set -e

echo "Running database migrations..."
node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run

echo "Starting Agromagnat backend..."
exec node dist/main.js
