import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from openai import OpenAIError
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.models import BoardData, ChatReply, ChatRequest

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static"))
# Without a configured secret, a random one is used, so sessions end when the server restarts.
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)

# MVP: single hardcoded user
USERNAME = "Rakeshreddy"
PASSWORD = "Rakeshreddy123"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="strict")


class Credentials(BaseModel):
    username: str
    password: str


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if username != USERNAME:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    valid_username = secrets.compare_digest(credentials.username.encode(), USERNAME.encode())
    valid_password = secrets.compare_digest(credentials.password.encode(), PASSWORD.encode())
    if not (valid_username and valid_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


def columns_unchanged(username: str, board: BoardData) -> bool:
    """Columns are fixed: only their titles may change."""
    return [c.id for c in board.columns] == [c.id for c in db.get_board(username).columns]


@app.get("/api/board")
def read_board(username: str = Depends(current_user)) -> BoardData:
    return db.get_board(username)


@app.put("/api/board")
def write_board(board: BoardData, username: str = Depends(current_user)) -> BoardData:
    if not columns_unchanged(username, board):
        raise HTTPException(status_code=422, detail="Columns are fixed; only their titles can change")
    db.save_board(username, board)
    return board


@app.post("/api/chat")
def chat(request: ChatRequest, username: str = Depends(current_user)) -> ChatReply:
    try:
        reply = ai.chat(db.get_board(username), request.history, request.message)
    except ValidationError:
        raise HTTPException(status_code=502, detail="The AI returned an invalid response")
    except OpenAIError:
        raise HTTPException(status_code=502, detail="The AI service is unavailable")
    if reply.board is not None:
        if not columns_unchanged(username, reply.board):
            raise HTTPException(status_code=502, detail="The AI changed the board's columns")
        db.save_board(username, reply.board)
    return reply


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
