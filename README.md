# ATLAS

ATLAS is a private personal operating system with a Next.js dashboard, a FastAPI service, and a database you run yourself. Priorities and records work without an AI provider, a cloud account, or a network connection after local setup.

## Local development

Install Node.js 22 or newer and Python 3.12 or newer. Run these commands from this directory.

```bash
npm ci
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm run dev
```

Open [ATLAS](http://127.0.0.1:3000). The Next.js UI and FastAPI bind to loopback. SQLite data is saved in `data/atlas.sqlite3`. Development loads sample records once. Start with an empty database using `ATLAS_DEMO_DATA=0 npm run dev`, or remove the original sample records from **Workspace settings** in an existing workspace. Edits to sample records are retained as user records.

Set `ATLAS_CURRENCY` when creating a database to choose its ledger currency. The default is USD. Dates in the dashboard use Asia/Kolkata. Back up the SQLite file while the app is stopped or use SQLite's online backup mechanism.

## Modules

| Module | What you can do |
| --- | --- |
| Command Centre | Manage dated priorities, mark them complete, and see interviews, follow-ups, and financial trends. |
| Career OS | Track roles, companies, application stages, and interviews. Save résumé links and associate versions with applications. |
| Business OS | Track leads through proposals and client engagements. Link income entries from Finance to see collected revenue by opportunity. |
| Finance OS | Log income, expenses, purchases, and savings transfers. Filter the ledger and review monthly cash flow. Savings transfers are excluded from income and expenses. |

Use the search button or `Ctrl+K` / `⌘K` to find and open records from any module.

## Self-host on Docker

Copy `.env.example` to `.env`. Set the owner email and generate separate secrets for the database, Better Auth, and initial account setup using `openssl rand -hex 32`. For a VPS, configure an HTTPS reverse proxy to the loopback web port and set `BETTER_AUTH_URL` to its external origin. For local Docker use the loopback URL matching `ATLAS_PORT`.

```bash
docker compose up -d --build
read -rs -p 'Owner password: ' atlas_password
printf '\n'
printf '%s' "$atlas_password" | node --env-file=.env scripts/bootstrap-owner.mjs
unset atlas_password
```

Sign in in the browser. Clear `ATLAS_SETUP_TOKEN` from `.env` and recreate the web container with `docker compose up -d web` after registering the owner. The frontend is the only published service. The API and PostgreSQL remain on the private Docker network. Both session and workspace data are stored in the PostgreSQL volume, which can be backed up with `pg_dump`.

## Architecture

Next.js serves the Tailwind UI and proxies workspace requests to FastAPI. The proxy checks the Better Auth session in the Docker deployment. FastAPI owns record validation and persistence, using SQLite locally and PostgreSQL in Docker. These are separate databases. Switching deployments does not move existing records automatically.

Knowledge OS, Project OS, Personal OS, and AI Command are planned. The future agent layer can use ATLAS's data API as the shared boundary for JARVIS, ZEUS, LOKI, and PROMETHEUS. LangGraph, Ollama, cloud providers, and pgvector belong to that phase.
