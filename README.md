# SportDeck

SportDeck is a full-stack football community application built for CSC309. It brings league matches and standings together with discussion forums, personal feeds, polls, and AI-assisted community features.

## Features

- Football fixtures, match results, league standings, and team data.
- Community threads, posts, replies, revision history, and polls.
- User profiles, following relationships, and a personalized feed.
- Email/password authentication with JWT access and refresh tokens, plus Google and GitHub OAuth integrations.
- AI-assisted moderation, translation, sentiment analysis, and daily digests through Gradio services.
- Administration tools for reports, appeals, bans, and account management.
- Docker Compose deployment with PostgreSQL, Redis, and an Nginx reverse proxy.

## Technology

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16 · Redis 7 · Docker

## Quick start with Docker

Install Docker with Compose, then:

```bash
git clone https://github.com/BoyuSong/SportDeck.git
cd SportDeck
cp .env.example .env
```

In PowerShell, use `Copy-Item .env.example .env` for the last command. Set two different random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Configure any external integrations you want to use, then start the application:

```bash
docker compose up -d --build
```

Open http://localhost (or the port configured with `APP_PORT`). Compose initializes the database schema and imports showcase data by default. League initialization runs only when `FOOTBALL_DATA_API_KEY` is configured.

```bash
docker compose logs -f app
docker compose down
```

`docker compose down` preserves the PostgreSQL volume. Demo accounts use `DEMO_USER_PASSWORD`, which defaults to `sportsdeck-demo`; choose a different value for a shared deployment. Set `INIT_SAMPLE_DATA=false` to skip importing demo accounts and content.

## Environment configuration

Copy `.env.example` to `.env` and fill in the values needed for your setup. Actual credentials are intentionally excluded from this repository.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for local development; Compose supplies its own internal connection string. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Separate signing secrets for authentication tokens. |
| `JWT_ACCESS_EXPIRES_MINUTES`, `JWT_REFRESH_EXPIRES_DAYS` | Token lifetimes; defaults are 15 minutes and 7 days. |
| `FOOTBALL_DATA_API_KEY` | Credential used by football data synchronization. |
| `FOOTBALL_DATA_COMPETITION` | Competition code, such as `PL`. |
| `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client configuration. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth application configuration. |
| `AI_MODERATOR`, `AI_TRANSLATOR`, `AI_SENTIMENT`, `AI_DAILY_DIGEST` | Gradio Space identifiers for AI integrations. |
| Corresponding `AI_*_API` variables | Endpoint names exposed by each configured Gradio Space. |

Compose also accepts `APP_PORT` (default `80`), `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `CACHE_TTL_SECONDS` (default `300`). AI services and OAuth providers require their own working external configuration.

## Local development

Use Node.js 22 with native TypeScript execution support, npm, and a reachable PostgreSQL database. Redis can be configured using `CACHE_HOST` and `CACHE_PORT`.

```bash
npm ci
# Create .env from .env.example and configure DATABASE_URL and JWT secrets.
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000. The Compose database is not exposed to the host by default, so use a separate local database or explicitly publish its port when developing outside Docker.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Build the production application. |
| `npm start` | Run an existing production build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Generate Next.js route types and run TypeScript checks. |
| `npm run data:import` | Import showcase community data. |
| `npm run league:sync` | Synchronize league data once. |
| `npm run league:sync:loop` | Repeat league synchronization on a schedule. |

For direct Node.js data scripts, export the required environment variables in your shell before running them.

Enable the optional Docker worker for periodic league updates:

```bash
docker compose --profile league-sync up -d --build
```

`LEAGUE_SYNC_INTERVAL_HOURS` defaults to `24`. `LEAGUE_SYNC_RUN_IMMEDIATELY` defaults to `false` because initialization can already perform the first sync.

## Project layout

```text
app/          Pages and API routes
components/   Shared user interface components
utils/        Authentication, AI, cache, feeds, and forum logic
prisma/       Database schema and client setup
scripts/      Demo imports, league synchronization, and admin utilities
docker/       Database initialization and Nginx configuration
public/       Static assets
```

## Repository contents

This repository starts with a source snapshot. The original environment file, credentials, dependency directories, generated build files, and earlier Git history are excluded. Configure your own `.env` before running the application.