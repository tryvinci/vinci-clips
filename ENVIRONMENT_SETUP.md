# Environment Variables Setup Guide

Vinci Clips uses a **local-first** architecture: JSON file database, local file storage, and no required MongoDB/GCS setup.

## Environment Files

```
vinci-clips/
├── .env.example              # Docker Compose (project root)
├── backend/.env.example      # Local backend development
├── frontend/env.example      # Local frontend development
└── ENVIRONMENT_SETUP.md      # This guide
```

## Option 1: Local Development (Recommended)

### Backend

```bash
cd backend
cp .env.example .env
```

Required in `backend/.env`:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (required for transcription) |
| `PORT` | Server port (default: 8080) |
| `LLM_PROVIDER` | `gemini` (default) or `openai` |
| `LLM_MODEL` | Model name (default: `gemini-2.5-flash`) |
| `OPENAI_API_KEY` | Optional — for OpenAI-compatible analysis |

See [LLM_PROVIDERS.md](LLM_PROVIDERS.md) for multi-provider setup.

### Frontend

```bash
cd frontend
cp env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8080`) |

If unset, the frontend falls back to `http://localhost:8080` via `src/lib/api.ts`.

### Start

```bash
npm run install:all   # from project root
npm start
```

App: `http://localhost:3000/upload`

## Option 2: Docker Compose

```bash
cp .env.example .env
# Edit .env — set GEMINI_API_KEY at minimum
docker-compose up --build
```

Docker runs **backend + frontend only**. Data persists in:
- `./backend/uploads/` — videos, clips, captioned output
- `./backend/storage/` — `db.json` transcript database

No MongoDB or Redis required.

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Backend root health (Docker) |
| `GET /clips/health` | Backend API health |
| `GET /api/health` | Frontend health (Docker) |

## Legacy / Unused Variables

These appear in older docs or `docker-compose.prod.yml` but are **not used** by the current local-first app:

- `DB_URL`, `MONGO_*` — replaced by JSON file DB
- `GCP_BUCKET_NAME`, `GCP_SERVICE_ACCOUNT_PATH` — replaced by local storage
- `REDIS_*`, `JWT_SECRET`, `CLERK_*` — not wired in current codebase

Do not configure these unless you are running a custom cloud deployment.
