import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)

from app import db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "data" / "app.db"
    monkeypatch.setattr(db, "DB_PATH", path)
    return path


@pytest.fixture
def client(db_path):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_client(client):
    client.post("/api/login", json={"username": "Rakeshreddy", "password": "Rakeshreddy123"})
    return client
