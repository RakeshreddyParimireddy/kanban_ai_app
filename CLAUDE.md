# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Requirements, color scheme and coding standards (simplicity first, no emojis, prove root cause before fixing) are in @AGENTS.md. The phased plan and its decisions are in `docs/PLAN.md`; check off items there as work completes. Frontend file-by-file notes and test hooks are in `frontend/AGENTS.md`; DB schema is in `docs/DATABASE.md`.

## Commands

Run the app (Docker, port 8000, passes `.env`, mounts `backend/data` for the SQLite file):

- Windows: `.\scripts\start.ps1` / `.\scripts\stop.ps1`
- Mac/Linux: `scripts/start.sh` / `scripts/stop.sh`

Backend (in `backend/`, uv-managed, Python 3.13):

- All tests: `uv run pytest`
- Single test: `uv run pytest tests/test_board.py::test_db_created_when_missing`
- Run locally without Docker: `npm run build` in `frontend/`, then `STATIC_DIR=../frontend/out uv run uvicorn app.main:app --port 8000`

Frontend (in `frontend/`):

- Unit tests (Vitest): `npm run test:unit`; single file: `npx vitest run src/components/KanbanBoard.test.tsx`; by name: `npx vitest run -t "name"`
- E2E (Playwright): `npm run test:e2e` - requires the app already running at `http://127.0.0.1:8000` (no dev server is started). Single spec: `npx playwright test tests/kanban.spec.ts`
- Lint: `npm run lint`
- Build static export: `npm run build` (outputs `frontend/out`)

Live AI tests (pytest and `tests/chat.spec.ts`) are skipped unless `OPENROUTER_API_KEY` is set in the shell environment.

## Architecture

Single container, single port. FastAPI (`backend/app/main.py`) serves `/api/*` and mounts the Next.js static export at `/` via `StaticFiles(html=True)`. The mount must stay last so API routes take precedence. The multi-stage `Dockerfile` builds the frontend in a node stage and copies `out/` to `/app/static`; `STATIC_DIR` overrides that path.

- Auth: hardcoded credentials in `main.py`, session in a signed cookie (`SessionMiddleware`, `SESSION_SECRET` env with a dev default). The `current_user` dependency guards board and chat routes (401 otherwise).
- Storage (`backend/app/db.py`): stdlib `sqlite3`, `DB_PATH` env (default `backend/data/app.db`). Tables and the seeded user + default board are created on startup (lifespan). Each user has one row in `boards` holding the whole board as JSON.
- Board shape: `BoardData = { columns: [{id, title, cardIds}], cards: {id: {id, title, details}} }`. Defined in Pydantic in `backend/app/models.py` and in TS in `frontend/src/lib/kanban.ts`; keep them in sync. Columns are fixed (5), only titles change; card order is `cardIds` order.
- Saves are whole-board: the frontend `PUT`s the full board to `/api/board` after every change; `src/lib/api.ts` queues saves so they arrive in order.
- AI (`backend/app/ai.py`): OpenAI SDK pointed at OpenRouter. `POST /api/chat` sends system prompt + current board JSON + client-held history + message, requesting a JSON schema response `{ message, board | null }` (non-strict, because the `cards` map can't be expressed in strict mode). The reply is validated with Pydantic; invalid replies return 502 without saving. A non-null `board` replaces the stored board and is returned so `ChatSidebar` updates the UI.
- Model: AGENTS.md specifies `openai/gpt-oss-120b`, but `MODEL` in `ai.py` currently uses a free model because the account returns OpenRouter 402. Switch back once credits exist.

## Testing notes

- `backend/tests/conftest.py` sets `STATIC_DIR` to a temp dir before importing the app and monkeypatches `db.DB_PATH` per test; use the `client` / `auth_client` fixtures.
- Frontend unit tests stub `fetch` via `src/test/mockApi.ts`.
- Playwright runs with 1 worker because all tests share one user's persisted board; `signInToBoard` in `tests/helpers.ts` resets it to the fixture.
