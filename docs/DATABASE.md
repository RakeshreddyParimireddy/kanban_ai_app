# Database

SQLite via Python's standard `sqlite3` module. Schema: [schema.json](schema.json).

## Tables

- `users` - one row per user. The MVP seeds a single `user`. Credentials stay hardcoded in the backend for the MVP, so there is no password column yet; one gets added (hashed) when real auth arrives.
- `boards` - one board per user (`user_id` is `UNIQUE`). The whole board is stored as JSON in `data`, in exactly the `BoardData` shape the frontend uses:

```json
{
  "columns": [{ "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }],
  "cards": { "card-1": { "id": "card-1", "title": "...", "details": "..." } }
}
```

## Why a JSON column

- The frontend and the AI both work with the whole board, so reads and writes are whole-board: `GET /api/board` returns `data`, `PUT /api/board` replaces it.
- The AI returns a complete updated board; saving it is a single row update with no diffing.
- Column order and card order are just array order, so no position columns or reordering logic.
- Trade-off: no SQL queries over individual cards. Not needed for the MVP; cards can move to their own table later if that changes.

## Lifecycle

- On startup the backend creates the DB file and tables if they don't exist (`CREATE TABLE IF NOT EXISTS`).
- If the `user` row or their board is missing, it is seeded: the user, and a board with 5 columns (Backlog, Discovery, In Progress, Review, Done) and the demo cards.
- The `backend/data` directory is mounted as a volume, so data survives container restarts.
- Board JSON is validated with Pydantic before every write.
