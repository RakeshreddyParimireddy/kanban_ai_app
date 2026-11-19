import json
import os
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from app.models import BoardData

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent.parent / "data" / "app.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

DEFAULT_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {"id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics."},
        "card-2": {"id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback."},
        "card-3": {"id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs."},
        "card-4": {"id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board."},
        "card-5": {"id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists."},
        "card-6": {"id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states."},
        "card-7": {"id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered."},
        "card-8": {"id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally."},
    },
}


def connect() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as conn, conn:
        conn.executescript(SCHEMA)
    create_user("user")


def create_user(username: str) -> None:
    """Create the user and their default board if they don't exist."""
    with closing(connect()) as conn, conn:
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
        conn.execute(
            "INSERT OR IGNORE INTO boards (user_id, data, updated_at) "
            "SELECT id, ?, ? FROM users WHERE username = ?",
            (json.dumps(DEFAULT_BOARD), now(), username),
        )


def get_board(username: str) -> BoardData:
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT b.data FROM boards b JOIN users u ON u.id = b.user_id WHERE u.username = ?",
            (username,),
        ).fetchone()
    return BoardData.model_validate_json(row[0])


def save_board(username: str, board: BoardData) -> None:
    with closing(connect()) as conn, conn:
        conn.execute(
            "UPDATE boards SET data = ?, updated_at = ? "
            "WHERE user_id = (SELECT id FROM users WHERE username = ?)",
            (board.model_dump_json(), now(), username),
        )


def now() -> str:
    return datetime.now(UTC).isoformat()
