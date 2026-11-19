# Project Management MVP

Kanban board with an AI assistant. FastAPI backend serving a static Next.js frontend, packaged in Docker.

## Run

Requires Docker. Put `OPENROUTER_API_KEY=...` in `.env` at the project root.

```bash
scripts/start.sh    # Mac/Linux
scripts/stop.sh
```

```powershell
scripts\start.ps1   # Windows
scripts\stop.ps1
```

App: http://localhost:8000 (sign in with `user` / `password`).

## Tests

```bash
cd backend && uv run pytest
cd frontend && npm run test:unit && npm run test:e2e
```

Live AI tests are skipped unless `OPENROUTER_API_KEY` is set in the shell environment.
