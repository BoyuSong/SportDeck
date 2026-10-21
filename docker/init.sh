#!/usr/bin/env sh
set -eu

echo "===== SportsDeck container init ====="
echo "Synchronizing Prisma schema..."
npx prisma db push --skip-generate

if [ "${INIT_LEAGUE_DATA:-false}" = "true" ]; then
  if [ -n "${FOOTBALL_DATA_API_KEY:-}" ]; then
    echo "Initializing league data..."
    node scripts/initLeagueData.ts
  else
    echo "Skipping league data initialization because FOOTBALL_DATA_API_KEY is not set."
  fi
else
  echo "Skipping league data initialization."
fi

if [ "${INIT_SAMPLE_DATA:-true}" = "true" ]; then
  echo "Importing showcase demo data..."
  node scripts/importDemoData.ts
else
  echo "Skipping showcase demo data import."
fi

echo "===== SportsDeck container init complete ====="
