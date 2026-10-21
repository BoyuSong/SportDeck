#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sportsdeck}"
POSTGRES_USER="${POSTGRES_USER:-sportsdeck}"

echo "Starting database service..."
docker compose up -d db

echo "Waiting for database to become ready..."
until docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

echo "Importing schema and demo data through app-init..."
docker compose run --rm --build app-init

echo "Database import complete."
