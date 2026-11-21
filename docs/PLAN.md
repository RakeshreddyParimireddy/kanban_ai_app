# Project Plan

Checklists are checked off by the agent as work completes. Each part ends with its tests passing and its success criteria met before moving on.

## Key decisions

- Single container, single port: FastAPI on `8000` serves the API at `/api/*` and the statically exported Next.js site at `/`.
- Next.js uses `output: "export"`; the build output (`frontend/out`) is copied into the image and mounted with `StaticFiles(html=True)`.
- Dockerfile is multi-stage: `node` stage builds the frontend, `python` stage installs backend deps with `uv` and runs `uvicorn`.
- Auth: hardcoded `user` / `password` checked by the backend; session held in a signed cookie (Starlette `SessionMiddleware`). A `users` table exists for future multi-user support.
- Board storage: one row per user holding the board as JSON (same `BoardData` shape the frontend already uses). Confirmed with the user in Part 5.
- AI: `openai` Python SDK pointed at `https://openrouter.ai/api/v1`, model `openai/gpt-oss-120b`, key from `.env` (`OPENROUTER_API_KEY`). Structured Outputs return `{ message, board | null }`; a non-null `board` replaces the stored board.
- SQLite file at `backend/data/app.db` (volume-mounted so data survives container restarts), created with schema and seed board on startup if missing.
- Tests: `pytest` for backend, Vitest for frontend units, Playwright for e2e against the running container.

## Part 1: Plan

- [x] Review existing frontend code
- [x] Create `frontend/AGENTS.md` describing the existing code
- [x] Enrich this plan with substeps, tests and success criteria
- [x] User reviews and approves the plan

Success: user approves this document.

## Part 2: Scaffolding

- [x] `backend/pyproject.toml` (uv-managed) with `fastapi`, `uvicorn`; dev deps `pytest`, `httpx`
- [x] `backend/app/main.py` with `GET /api/health` returning `{"status": "ok"}` and a static `hello world` HTML page served at `/`
- [x] `Dockerfile` (python + uv) and `.dockerignore`
- [x] `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux) and `scripts/start.ps1`, `scripts/stop.ps1` (Windows): build image, run container on port 8000 with `.env` and the data volume; stop removes the container
- [x] Minimal root `README.md` (how to start/stop, run tests)

Tests:
- [x] `pytest`: `/api/health` returns 200 and `{"status": "ok"}`; `/` returns the hello world HTML

Note: verified in Docker on 2026-11-21: `scripts/start.ps1` builds and runs the container, health/login/board work, the Playwright suite passes against it, and `scripts/stop.ps1` removes it.

Success: `scripts/start` brings the container up, `http://localhost:8000/` shows hello world, `http://localhost:8000/api/health` returns ok, `scripts/stop` tears it down.

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`; confirm `npm run build` produces `frontend/out`
- [x] Multi-stage Dockerfile: build frontend in a node stage, copy `out/` into the python image; FastAPI mounts it at `/` (after API routes)
- [x] Add card editing (business requirement): edit title/details inline on a card, save/cancel
- [x] Point Playwright at the container (`baseURL` `http://127.0.0.1:8000`, no dev server)

Tests:
- [x] Vitest: existing tests pass; new tests for editing a card (save and cancel)
- [x] `pytest`: `/` serves the exported `index.html`; `/api/health` still works
- [x] Playwright: board loads with 5 columns, add card, edit card, delete card, rename column, drag card between columns

Success: `http://localhost:8000/` shows the Kanban board from the container and all tests pass.

## Part 4: Fake user sign in

- [x] Backend: `POST /api/login` (checks `user`/`password`, sets session), `POST /api/logout` (clears session), `GET /api/me` (returns username or 401)
- [x] `SessionMiddleware` with a secret from env (default for local dev)
- [x] Frontend: on load call `/api/me`; show a login form if 401, else the board; header shows a Log out button
- [x] Login form styled with the project colors; error message on bad credentials

Tests:
- [x] `pytest`: login success/failure, `/api/me` before and after login, logout clears session
- [x] Vitest: login form renders, submits, shows error on failure; board shown when authenticated
- [x] Playwright: `/` shows login; wrong password shows error; correct login shows board; logout returns to login; reload keeps session

Success: the board is only reachable after signing in with `user`/`password`, and logout works.

## Part 5: Database modeling

- [x] Write `docs/DATABASE.md`: tables, columns, relationships, the board JSON shape, how the DB is created and seeded
- [x] Save the proposed schema as `docs/schema.json`
- [x] User reviews and signs off

Approved schema:
- `users(id INTEGER PK, username TEXT UNIQUE)` - seeded with `user` (no password column while credentials are hardcoded)
- `boards(id INTEGER PK, user_id INTEGER UNIQUE FK -> users.id, data TEXT JSON, updated_at TEXT)` - one board per user, `data` is `BoardData`

Success: user approves the schema.

## Part 6: Backend

- [x] `backend/app/db.py`: open SQLite (stdlib `sqlite3`), create tables if missing, seed user and default board
- [x] Pydantic models for `Card`, `Column`, `BoardData` mirroring the frontend types
- [x] `GET /api/board` returns the signed-in user's board; `PUT /api/board` validates and replaces it
- [x] Both routes require a session (401 otherwise)

Tests:
- [x] `pytest` (temp DB per test): DB file created when missing; seed data present; GET returns seed board; PUT persists and GET returns the update; invalid payload returns 422; unauthenticated returns 401; boards are isolated per user

Success: board changes persist across requests and container restarts.

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts` with `getBoard()` and `saveBoard(board)`
- [x] `KanbanBoard` loads the board from the API after login and saves after each change (rename, add, edit, delete, move)
- [x] Loading state while fetching; remove reliance on `initialData` in the running app

Tests:
- [x] Vitest with mocked `fetch`: board renders from API data; each change calls `saveBoard` with the expected board
- [x] Playwright: make each kind of change, reload the page, change is still there; restart container, change is still there

Restart persistence verified with `docker restart pm-app` (board data on the mounted volume survives).

Success: the Kanban is fully persistent per user.

## Part 8: AI connectivity

- [x] Add `openai` dependency; `backend/app/ai.py` with a client configured for OpenRouter and `openai/gpt-oss-120b`
- [x] Temporary/diagnostic `POST /api/ai/test` that sends "What is 2+2?" and returns the reply

Tests:
- [x] `pytest` unit test with the client mocked
- [x] `pytest` live test (skipped if `OPENROUTER_API_KEY` is not set) asserting the reply contains `4`

Model note: `openai/gpt-oss-120b` returns OpenRouter 402 (account has no credits), so `nvidia/nemotron-3.5-super-vl:free` is used until credits are purchased. Live call from inside the container verified. As of 2026-11-21 `openai/gpt-oss-120b` still returns 402; switch `MODEL` in `backend/app/ai.py` once credits are added.

Success: live call from inside the container returns a correct answer.

## Part 9: AI with board context and Structured Outputs

- [x] `POST /api/chat` accepting `{ message, history: [{role, content}] }`
- [x] Backend builds the prompt: system instructions, current board JSON, history, user message
- [x] Structured Outputs response schema: `{ message: string, board: BoardData | null }`
- [x] If `board` is present, validate it and save it; return `{ message, board }` to the client
- [x] Replace the Part 8 test route with this one

The board's `cards` map can't be expressed in strict mode, so a non-strict JSON schema is sent and the reply is validated with Pydantic; an invalid reply returns 502 and nothing is saved.

Tests:
- [x] `pytest` with mocked AI: reply-only response leaves board unchanged; response with board saves it; invalid board from AI is rejected without corrupting stored data; history is passed through
- [x] `pytest` live tests (skipped without key): "add a card called X to Backlog" results in a saved board containing X; a plain question returns `board: null`

Success: the AI can create, edit and move one or more cards via chat, and changes persist.

## Part 10: AI chat sidebar

- [x] `ChatSidebar` component: collapsible panel beside the board, message list, input, send button (purple), loading indicator
- [x] Conversation history kept in component state and sent with each request
- [x] When the response includes a board, update board state so the UI refreshes immediately
- [x] Styled to the color scheme and consistent with the existing design

Tests:
- [x] Vitest with mocked `fetch`: sending a message shows user and AI messages; a response with a board updates the rendered board; errors are shown
- [x] Playwright (live, skipped without key): ask the AI to add a card and see it appear on the board without reload

Success: a user can chat with the AI in the sidebar and see the board update automatically when the AI changes it.
