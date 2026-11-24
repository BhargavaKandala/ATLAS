# ATLAS

ATLAS is a local-first personal operating system with a Next.js dashboard, a FastAPI service, and a database you run yourself. Workspace records and built-in agent workflows work offline after setup.

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
| AI Command | Run daily briefings, decision reviews, reusable checklists, and learning exercises. Inspect the duration and outcome of each step. |

Use the search button or `Ctrl+K` / `⌘K` to find and open records from any module.

## AI Command

Choose an agent, select a provider, and run a prompt. Each request goes through a LangGraph workflow that optionally prepares a workspace summary, then routes to one of four agents. The agents produce advice and plans. Record changes are made through the workspace screens.

| Agent | Typical workflow |
| --- | --- |
| JARVIS | Read today's priorities and upcoming interviews and follow-ups. |
| ZEUS | Review competing deadlines, business opportunities, career activity, and cash flow before making a decision. |
| LOKI | Turn a task or follow-up into a reusable checklist with a review step. |
| PROMETHEUS | Find relevant notes already attached to workspace records and build a practice exercise. |

| Provider | Setup and data access |
| --- | --- |
| Workspace mode | Available immediately. Rule-based workflows read relevant records from the local database. |
| Ollama | Set `ATLAS_OLLAMA_MODEL` to a model installed on your Ollama server. `ATLAS_OLLAMA_URL` defaults to `http://127.0.0.1:11434`. The selected prompt goes to that server, with an optional workspace summary. |
| OpenAI | Set `ATLAS_ENABLE_CLOUD_AI=1`, `ATLAS_OPENAI_MODEL`, and `OPENAI_API_KEY`. Each run requires confirmation and sends your prompt without workspace records. |
| Anthropic | Set `ATLAS_ENABLE_CLOUD_AI=1`, `ATLAS_ANTHROPIC_MODEL`, and `ANTHROPIC_API_KEY`. Each run requires confirmation and sends your prompt without workspace records. |

Export these variables in your shell for local development. For Docker, set them in your untracked `.env` file. Choose an Ollama URL reachable from the API container, such as a trusted server on the same private network. A provider error appears in AI Command and in the local run history. Select Workspace mode to retry offline.

### Observability

AI Command displays the 12 most recent runs. SQLite or PostgreSQL retains the trace ID, agent, provider, outcome, step durations, and token counts when available. Prompts, workspace excerpts, responses, and provider exception messages are excluded from trace records and structured logs. Responses are shown for the current session.

To export OpenTelemetry traces, set `ATLAS_OTLP_TRACES_ENDPOINT` to an HTTP/protobuf collector URL including `/v1/traces`. Use `OTEL_EXPORTER_OTLP_TRACES_HEADERS` if the collector requires authentication. Trace IDs match the run history and log entries. Export is off by default, and ATLAS disables LangSmith tracing for agent runs.

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

## Tech stack

| Layer | Technology in use |
| --- | --- |
| Frontend | Node.js 22+ (24 in Docker), Next.js 16 App Router and Turbopack, React 19, TypeScript 5.9, Tailwind CSS 4, PostCSS, Lucide React, Inter and Manrope via Fontsource |
| Backend | Python 3.12+, FastAPI, Starlette, Uvicorn, Pydantic v2 |
| Storage | SQLAlchemy 2, SQLite for local development, PostgreSQL 17 for self-hosting, Psycopg 3 for Python, node-postgres for authentication |
| Agent orchestration | LangGraph, LangChain Core, LangSmith tracing context for trace suppression |
| Model integrations | LangChain adapters for Ollama, OpenAI, and Anthropic, backed by their Python SDKs |
| Observability | OpenTelemetry API and SDK, optional OTLP HTTP/protobuf exporter, structured Python logs, SQL-backed run history |
| Authentication | Better Auth with email and password and PostgreSQL-backed sessions |
| Deployment and source | Docker, Docker Compose, npm and pip, Git and GitHub |
| Verification | Python unittest, FastAPI TestClient and HTTPX, TypeScript type checks, Next.js production build |

## Architecture

Next.js serves the Tailwind UI and proxies workspace and AI requests to FastAPI. The proxy checks the Better Auth session in Docker. FastAPI owns record validation, persistence, and agent execution. SQLite and PostgreSQL are separate databases. Switching deployments does not move existing records automatically.

Knowledge OS, Project OS, Personal OS, voice access for JARVIS, and pgvector retrieval are planned.

## Checks

```bash
.venv/bin/python -m unittest discover -s backend/tests
npm run typecheck
npm run build
```
