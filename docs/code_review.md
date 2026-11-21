# Code Review

Date: 2026-11-21. Scope: the whole repository at commit `9086dd1` (backend, frontend, Docker, scripts, tests, docs).

## Summary

The codebase is small, readable and close to the AGENTS.md standards: few dependencies, no dead code, consistent naming, and the plan in `docs/PLAN.md` matches what was built. All automated checks pass:

| Check | Result |
| --- | --- |
| `uv run pytest` (backend) | 26 passed (live AI tests skipped, no key in shell) |
| `npx vitest run` (frontend) | 17 passed |
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm audit --omit=dev` | 6 advisories (1 critical, 4 high, 1 moderate) |
| Git history scan for API keys | only the README placeholder, no real key committed |

The main problems are edge cases the tests don't cover yet: saving and loading when the session has expired or the network fails, the AI overwriting edits made while it is replying, missing validation of the fixed columns, and a default session secret combined with a port that is open to the whole network. None of them need a redesign; most fixes are a few lines.

Severity: **High** = can lose data or allow access in normal use. **Medium** = a real bug in a less common path. **Low** = robustness, hygiene or developer experience. **Nit** = style or tidy-up.

---

## High

### H1. The default session secret, combined with the port open on all interfaces, lets anyone on the network forge a login
- `backend/app/main.py:14` falls back to `"dev-secret"`. `scripts/start.ps1:7` / `scripts/start.sh:8` never set `SESSION_SECRET`, and the README's `.env` example only has the OpenRouter key, so in practice the container always runs with the default.
- `-p 8000:8000` publishes on every host interface, so other machines on the same network (for example public Wi-Fi) can reach the app.
- Anyone who knows the public default can sign a cookie `{"username": "Rakeshreddy"}` with `itsdangerous` and get full board and chat access, spending OpenRouter credit, without the password.
- Actions:
  - Bind to localhost in both start scripts: `-p 127.0.0.1:8000:8000`.
  - Require `SESSION_SECRET` when running in the container: drop the default and add it to the README `.env` example, or have the start scripts generate one into `.env` if it is missing.

### H2. Failed saves are silent, and the UI shows changes that were never stored
- `frontend/src/components/KanbanBoard.tsx:47-50`: `update()` calls `saveBoard(next)` and ignores the result. `saveBoard` (`src/lib/api.ts:35-45`) resolves on any HTTP status, including 401 and 422.
- Scenario: the session cookie expires, or the container restarts with a new secret (H1). The user keeps editing, every PUT returns 401, and nothing tells them. On reload, all of that work is gone.
- Action: in `update()`, check `response.ok`. On 401 return to the login screen (pass a callback down from `AuthGate`); on any other failure show a short "Changes not saved" alert. Add a Vitest case where the PUT mock returns 401.

### H3. The AI can overwrite board edits made while it is replying
- `backend/app/main.py:81-85` reads the board, waits for the model (often several seconds), then saves the AI's board, which is based on the old snapshot. `KanbanBoard.tsx:207` then replaces local state with it.
- Scenario: the user asks the AI something, drags a card while "Thinking..." is shown (the PUT succeeds), then the AI reply arrives and its board replaces both the stored and the displayed board. The drag is lost without warning.
- Action (simplest): block board edits while a chat request is in flight. For example, lift `isSending` into `KanbanBoard` and skip `update()` while it is true, or show an overlay on the board. A version check on `updated_at` would also work but adds more code than the MVP needs.

---

## Medium

### M1. Board validation doesn't enforce the fixed columns
- `backend/app/models.py:22-32` checks card consistency but not columns. These are all accepted by `PUT /api/board` and from the AI: `{"columns": [], "cards": {}}`, a 6th column, a removed column, changed column ids, or duplicate column ids (which also cause duplicate React keys in `KanbanBoard.tsx:163,182`).
- The AI is the realistic risk: one bad reply can delete a column and every card in it. The system prompt asks it to keep column ids, but nothing checks this.
- Action: in `save_board` (or in both routes), reject the board unless `[c.id for c in board.columns]` equals the stored board's column ids. One comparison covers count, order, ids and duplicates. Add pytest cases for the PUT route and for an AI reply.

### M2. Loading the board when not signed in crashes the page
- `frontend/src/lib/api.ts:27-30`: `getBoard` doesn't check `response.ok`. On 401 it returns `{detail: "Not signed in"}`, `setBoard` stores it, and `board.columns.map` throws (`KanbanBoard.tsx:163`), leaving a blank page.
- On a network error the promise rejects with no handler (`KanbanBoard.tsx:36`), so the page stays on "Loading board..." forever. `AuthGate.tsx:13` has the same problem with `getMe`: the page stays blank.
- Action: have `getBoard` throw when the response is not ok, and handle it the same way as H2 (go back to login on 401, show an error otherwise).

### M3. OpenRouter errors become unhandled 500s, and calls have no timeout
- `backend/app/main.py:80-83` only catches `ValidationError`. A 402 (the known credits problem), a 429, a network failure or a missing `OPENROUTER_API_KEY` (`ai.py:29`, `KeyError`) all raise and return a bare 500 with a server traceback.
- `ai.py:29` uses the SDK defaults: a 600 s timeout and 2 retries, so a hung request can leave "Thinking..." on screen for up to about 30 minutes.
- Action: catch `openai.APIError` in the chat route and return 502 as well. Set `timeout=60, max_retries=1` (or similar) on the client. Add a mocked test where `create` raises.

### M4. Running the e2e suite wipes your real board
- `frontend/tests/helpers.ts:12-17` (`signInToBoard`) PUTs the fixture board to whatever is running on port 8000, which by default is the container that uses `backend/data/app.db`, your real data.
- Action: run e2e against a separate DB. For example, have the start scripts accept a data directory, or run the test container with `-v <temp dir>:/app/data`. At least add a warning to the README "Playwright tests" section.

### M5. `start.ps1` probably aborts on first run under Windows PowerShell 5.1
- `scripts/start.ps1:1,4`: with `$ErrorActionPreference = "Stop"`, Windows PowerShell 5.1 turns redirected native stderr into a terminating `NativeCommandError`. I confirmed this locally with a stand-in command. If `docker rm -f pm-app` writes "No such container" to stderr when there is nothing to remove, the script stops before `docker run`. Docker wasn't running during this review, so I couldn't confirm what `docker rm -f` actually prints. PowerShell 7 does not have this problem.
- Also, `$ErrorActionPreference` doesn't apply to native exit codes in 5.1, so a failed `docker build` doesn't stop the script, and it starts the previous image.
- Action: replace line 4 with `docker rm -f pm-app *> $null; $global:LASTEXITCODE = 0` (or wrap it in `try { } catch { }`), and add `if ($LASTEXITCODE -ne 0) { exit 1 }` after `docker build`. Test once with no existing container.

---

## Low

### L1. A column rename sends one PUT per keystroke
`KanbanColumn.tsx:46` calls `onRename` on every `onChange`, and each call queues a full-board PUT. Typing a 20-character title sends 20 requests. It also allows an empty title. Action: keep the draft title in local state and commit it on blur or Enter, ignoring empty values.

### L2. Chat history and input sizes are unbounded
`ChatRequest` (`models.py:40-42`) and card fields have no length limits. A long session resends the whole history every time, so each request costs more and will eventually exceed the model's context. Action: send only the last N messages (for example 20) from `ChatSidebar`, and optionally add `max_length` to `message`.

### L3. A failed chat message stays in the history without a reply
`ChatSidebar.tsx:26-35`: on error the user message stays in `messages`, so the next request has two user turns in a row, and the typed text has already been cleared. Action: on error, remove the last message and put its text back into the input.

### L4. The frontend dev server can't sign in
`frontend/README.md` advertises `npm run dev` at port 3000, but `/api/*` doesn't exist there, so login always fails. `npm run start` (`next start`) doesn't work with `output: "export"`. Action: remove `start`, and document that `dev` is only for styling (or point it at the backend via a dev-only rewrite).

### L5. Dependencies with security advisories and drifting versions
- `next 16.1.6` has a critical advisory (fixed in 16.4.x). The runtime impact is small because only the static export is served, but the build toolchain is affected. `sharp`, `postcss`, `nanoid` and `source-map-js` advisories come in transitively.
- `@types/node ^20` while Docker builds with Node 24. `vitest ^3` / `@vitejs/plugin-react ^5` are behind current majors (AGENTS.md asks for the latest versions).
- `Dockerfile:9` uses `ghcr.io/astral-sh/uv:latest`, which isn't reproducible.
- Action: bump `next` and `eslint-config-next` to the latest 16.x, run `npm audit fix`, align `@types/node` with Node 24, and pin the uv image tag.

### L6. The container runs as root and has no health check
`Dockerfile` has no `USER` and no `HEALTHCHECK`. This is fine for local use, but a two-line change: add a non-root user that owns `/app/data`, plus `HEALTHCHECK CMD` against `/api/health`.

### L7. Drag and drop doesn't work from the keyboard
`KanbanBoard.tsx:29-33` registers only `PointerSensor`. Each card has `role="button"` from dnd-kit attributes and also contains Edit/Remove buttons (nested interactive elements, as `frontend/AGENTS.md` notes). Action: add `KeyboardSensor` with `sortableKeyboardCoordinates`.

### L8. A possible e2e flake from unsaved renames
`tests/kanban.spec.ts:43-47` doesn't wait for the per-keystroke PUTs. One can still be in flight when the next test's `signInToBoard` resets the board, and land after the reset. Action: wrap the fill in `andSave` as `persistence.spec.ts` does, or fix L1.

### L9. Missing test coverage
These cases have no tests: OpenRouter exceptions (M3), save/load failure handling (H2, M2), column validation (M1), and `moveCard` edge cases (unknown ids, dropping on the card's own column). Add them alongside each fix.

---

## Nits

- `db.py:54` hardcodes `"Rakeshreddy"`, duplicating `USERNAME` in `main.py:17`. Import one from the other.
- `main.py:50`: use `secrets.compare_digest` for the password comparison. This is cheap, even for hardcoded credentials.
- `main.py:84`: `if reply.board is not None:` states the intent better than a truthiness check on a model.
- `KanbanBoard.tsx:84`: the placeholder `"No details yet."` is stored as real data, so the AI sees it and users must delete it when editing. Store `""` and show the placeholder only when rendering.
- `kanban.ts:108-112`: `createId` could be `` `${prefix}-${crypto.randomUUID().slice(0, 8)}` ``.
- `package.json`: `test` and `test:unit` are duplicates.
- `DEFAULT_BOARD` (`db.py`) and `initialData` (`boardFixture.ts`) are hand-kept copies. This is acceptable, but add a comment pointing each at the other.
- `LoginForm.tsx`: no pending state, so a double click sends two logins (harmless).
- Card deletion has no confirmation or undo.

---

## Documentation

- `backend/AGENTS.md` and `scripts/AGENTS.md` are still one-line placeholders. Fill them in, as was done for `frontend/AGENTS.md` (modules, env vars `DB_PATH` / `STATIC_DIR` / `SESSION_SECRET` / `OPENROUTER_API_KEY`, test fixtures).
- README: add `SESSION_SECRET` to the `.env` example (H1) and the e2e data warning (M4).
- `frontend/README.md`: correct the dev-server line (L4).
- `ai.py:9` / `PLAN.md` Part 8: the model is still the free substitute. Keep tracking the switch back to `openai/gpt-oss-120b`.

---

## Action checklist (in priority order)

Remediation of High and Medium items done 2026-11-21. Results:
- Backend `uv run pytest`: 34 passed, including the live AI tests.
- Frontend: `npx vitest run` 23 passed; `npm run test:e2e` 15 passed, including the live chat test, against an isolated server on port 8001; lint and `tsc` clean.
- Container: built and started with `scripts/start.ps1` under Windows PowerShell 5.1, published on `127.0.0.1:8000` only. Smoke test passed: health, login, a PUT that removes a column returns 422 and leaves the board unchanged, and a cookie forged with the old `dev-secret` returns 401.

Note on M5: with Docker 29, `docker rm -f` on a missing container exits 0 and prints nothing, so the suspected first-run abort does not happen on this Docker version. The script is now safe either way, and it now stops when `docker build` or `docker run` fails.

Note on H1: if `SESSION_SECRET` is not set, a random secret is generated at startup (you sign in again after a restart). Set it in `.env` to keep sessions across restarts.

Note on M4: Playwright now starts its own backend (`uv run uvicorn`) on `127.0.0.1:8001` with a throwaway DB in the OS temp directory; `npm run test:e2e` builds the frontend first.


- [x] H1: Bind the start scripts to `127.0.0.1`; require or generate `SESSION_SECRET`; document it in the README
- [x] H2: Handle failed saves in `KanbanBoard.update` (go to login on 401, show an error otherwise) + Vitest
- [x] H3: Block board edits while a chat request is in flight
- [x] M1: Validate that column ids match the stored board on PUT and AI save + pytest
- [x] M2: `getBoard` / `getMe` check `response.ok` and handle errors
- [x] M3: Catch `openai.APIError` -> 502; set client timeout and retries + pytest
- [x] M4: Isolate the e2e database from real data, or document the risk
- [x] M5: Make `start.ps1` safe on Windows PowerShell 5.1 and stop on build failure
- [ ] L1: Commit column renames on blur or Enter; reject empty titles
- [ ] L2: Cap the chat history sent to the backend
- [ ] L3: Restore the input and drop the orphaned message on chat error
- [ ] L4: Fix or remove the `dev` / `start` scripts and frontend README
- [ ] L5: Upgrade `next`, run `npm audit fix`, align `@types/node`, pin the uv image
- [ ] L6: Non-root user and `HEALTHCHECK` in the Dockerfile
- [ ] L7: Add `KeyboardSensor` for accessible drag and drop
- [ ] L8: Make the rename e2e test wait for its save
- [ ] L9: Add the missing tests listed above
- [ ] Nits and documentation updates
