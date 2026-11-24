# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 Kanban board. Built as a static export (`output: "export"` -> `out/`) and served by the FastAPI backend. The board is loaded from and saved to the backend API (`/api/board`).

## Layout

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) fonts.
- `src/app/page.tsx` - renders `AuthGate` at `/`.
- `src/components/AuthGate.tsx` - checks `/api/me`; shows `LoginForm` or `KanbanBoard` (with logout).
- `src/components/LoginForm.tsx` - username/password form, error on failed login.
- `src/lib/api.ts` - backend calls (`getMe`, `login`, `logout`, `getBoard`, `saveBoard`, `sendChat`). Saves are queued so they reach the server in order; `sendChat` waits for the queue. `getBoard`/`saveBoard` throw `ApiError(status)` on non-OK responses.
- `src/app/globals.css` - Tailwind import and color tokens as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `moveCard` (pure reorder/move logic), `createId`.
- `src/components/KanbanBoard.tsx` - loads the board on mount, saves the whole board after every change; dnd-kit `DndContext` with `DragOverlay`; handlers for rename column, add/edit/delete card, drag end. Shows an alert when loading or saving fails and calls `onSessionExpired` on 401. Owns the chat `isSending` state and blocks edits (`inert` section + guard in `update`) while the AI is replying.
- `src/components/KanbanColumn.tsx` - droppable column, inline editable title input, sortable card list, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline title/details form) and Remove buttons. Drag attributes are removed while editing.
- `src/components/KanbanCardPreview.tsx` - card rendered in the drag overlay.
- `src/components/NewCardForm.tsx` - toggleable title/details form.
- `src/components/ChatSidebar.tsx` - AI chat panel (sticky column beside the board), toggled by the header "AI Assistant" button and kept mounted while closed. `isSending` comes from `KanbanBoard`. Keeps history in state and sends it to `/api/chat`; when the reply has a board it calls `onBoardChange` (the backend has already saved it).

## Data shape

```ts
BoardData = { columns: { id, title, cardIds[] }[], cards: Record<id, { id, title, details }> }
```

Columns can be renamed, and inserted or deleted through the AI chat; they are never reordered and at least one remains. The board grid lays out any number of columns in one row on large screens. Card order is the order of `cardIds`.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)` - `npm run test:unit`. `src/test/mockApi.ts` fakes the backend via a stubbed `fetch`; `src/test/boardFixture.ts` holds the demo board.
- E2E (Playwright, Chromium): `tests/*.spec.ts` (helpers in `tests/helpers.ts`; `signInToBoard` resets the board to the fixture; runs with 1 worker since tests share one board) - `npm run test:e2e`. Builds `out/`, then `playwright.config.ts` starts the backend via `uv` on 127.0.0.1:8001 with a throwaway DB (OS temp dir), so the real board is never touched. Needs `uv` on the host.

`tests/chat.spec.ts` calls the real AI and is skipped unless `OPENROUTER_API_KEY` is set in the environment.

Test hooks: `data-testid="column-<columnId>"`, `data-testid="card-<cardId>"`, column title input `aria-label="Column title"`, edit/delete buttons `aria-label="Edit <title>"` / `"Delete <title>"` (use `exact: true`; the card element itself has role button and contains these names), chat input `aria-label="Chat message"`, messages `data-testid="chat-user"` / `"chat-assistant"`.
