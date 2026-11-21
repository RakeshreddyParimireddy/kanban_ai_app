import copy
import sqlite3

from fastapi.testclient import TestClient

from app import db
from app.main import app


def test_db_created_when_missing(db_path):
    assert not db_path.exists()
    with TestClient(app):
        pass
    assert db_path.exists()
    tables = {row[0] for row in sqlite3.connect(db_path).execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"users", "boards"} <= tables


def test_init_is_idempotent(db_path):
    db.init_db()
    db.init_db()
    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1


def test_existing_data_survives_restart(db_path):
    db.init_db()
    board = db.get_board("Rakeshreddy")
    board.columns[0].title = "Persisted"
    db.save_board("Rakeshreddy", board)
    with TestClient(app):
        pass
    assert db.get_board("Rakeshreddy").columns[0].title == "Persisted"


def test_board_requires_login(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=db.DEFAULT_BOARD).status_code == 401


def test_get_returns_seed_board(auth_client):
    response = auth_client.get("/api/board")
    assert response.status_code == 200
    assert response.json() == db.DEFAULT_BOARD


def test_put_persists_changes(auth_client):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["columns"][0]["title"] = "Ideas"
    board["cards"]["card-9"] = {"id": "card-9", "title": "New", "details": "Fresh"}
    board["columns"][1]["cardIds"].append("card-9")
    # move card-1 to Done
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][4]["cardIds"].insert(0, "card-1")

    response = auth_client.put("/api/board", json=board)
    assert response.status_code == 200
    assert response.json() == board
    assert auth_client.get("/api/board").json() == board


def test_put_rejects_invalid_shape(auth_client):
    assert auth_client.put("/api/board", json={"columns": "nope"}).status_code == 422


def test_put_rejects_card_missing_from_cards(auth_client):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["columns"][0]["cardIds"].append("card-missing")
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_put_rejects_card_not_in_any_column(auth_client):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["cards"]["card-9"] = {"id": "card-9", "title": "Orphan", "details": ""}
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_put_rejects_duplicate_card_placement(auth_client):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["columns"][1]["cardIds"].append("card-1")
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_rejected_put_leaves_board_unchanged(auth_client):
    auth_client.put("/api/board", json={"columns": "nope"})
    assert auth_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_boards_isolated_per_user(db_path):
    db.init_db()
    db.create_user("other")
    board = db.get_board("other")
    board.columns[0].title = "Other's backlog"
    db.save_board("other", board)
    assert db.get_board("Rakeshreddy").columns[0].title == "Backlog"
    assert db.get_board("other").columns[0].title == "Other's backlog"
