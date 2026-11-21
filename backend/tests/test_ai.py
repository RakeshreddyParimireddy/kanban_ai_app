import copy
import json
import os
from types import SimpleNamespace

import httpx
import pytest
from openai import APIConnectionError

from app import ai, db

live = pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")


@pytest.fixture
def fake_ai(monkeypatch):
    """Make the AI reply with the queued content; records each request."""
    calls = []
    replies = []

    def create(**kwargs):
        calls.append(kwargs)
        if isinstance(replies[0], Exception):
            raise replies.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=replies.pop(0)))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(ai, "client", lambda: fake_client)
    return SimpleNamespace(calls=calls, replies=replies)


def test_chat_requires_login(client):
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


def test_reply_only_leaves_board_unchanged(auth_client, fake_ai):
    fake_ai.replies.append(json.dumps({"message": "Hello", "board": None}))
    response = auth_client.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello", "board": None}
    assert auth_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_reply_with_board_saves_it(auth_client, fake_ai):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["cards"]["card-x"] = {"id": "card-x", "title": "X", "details": ""}
    board["columns"][0]["cardIds"].append("card-x")
    fake_ai.replies.append(json.dumps({"message": "Added X", "board": board}))

    response = auth_client.post("/api/chat", json={"message": "add X"})
    assert response.status_code == 200
    assert response.json() == {"message": "Added X", "board": board}
    assert auth_client.get("/api/board").json() == board


def test_invalid_board_is_rejected(auth_client, fake_ai):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["columns"][0]["cardIds"].append("card-missing")
    fake_ai.replies.append(json.dumps({"message": "Done", "board": board}))

    assert auth_client.post("/api/chat", json={"message": "break it"}).status_code == 502
    assert auth_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_prompt_includes_board_history_and_message(auth_client, fake_ai):
    fake_ai.replies.append(json.dumps({"message": "Sure", "board": None}))
    history = [{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "reply"}]
    auth_client.post("/api/chat", json={"message": "now", "history": history})

    request = fake_ai.calls[0]
    assert request["model"] == ai.MODEL
    system, *rest = request["messages"]
    assert system["role"] == "system"
    assert "Align roadmap themes" in system["content"]
    assert rest == [*history, {"role": "user", "content": "now"}]


def test_ai_service_error_returns_502(auth_client, fake_ai):
    fake_ai.replies.append(APIConnectionError(request=httpx.Request("POST", "https://openrouter.ai")))
    assert auth_client.post("/api/chat", json={"message": "hi"}).status_code == 502
    assert auth_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_ai_removing_a_column_is_rejected(auth_client, fake_ai):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    removed = board["columns"].pop()
    for card_id in removed["cardIds"]:
        del board["cards"][card_id]
    fake_ai.replies.append(json.dumps({"message": "Removed Done", "board": board}))

    assert auth_client.post("/api/chat", json={"message": "remove Done"}).status_code == 502
    assert auth_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_missing_api_key_returns_502(auth_client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    ai.client.cache_clear()
    try:
        assert auth_client.post("/api/chat", json={"message": "hi"}).status_code == 502
    finally:
        ai.client.cache_clear()


def test_client_has_timeout_and_limited_retries(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    ai.client.cache_clear()
    try:
        assert ai.client().timeout == 60
        assert ai.client().max_retries == 1
    finally:
        ai.client.cache_clear()


@live
def test_live_add_card(auth_client):
    response = auth_client.post("/api/chat", json={"message": "Add a card called Zebra launch to the Backlog column"})
    assert response.status_code == 200
    board = auth_client.get("/api/board").json()
    backlog = board["columns"][0]["cardIds"]
    assert any(board["cards"][card_id]["title"] == "Zebra launch" for card_id in backlog)


@live
def test_live_question_returns_no_board(auth_client):
    response = auth_client.post("/api/chat", json={"message": "How many columns are on the board? Do not change anything."})
    assert response.status_code == 200
    assert response.json()["board"] is None
