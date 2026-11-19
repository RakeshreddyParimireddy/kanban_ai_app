import os
from functools import cache

from openai import OpenAI

from app.models import BoardData, ChatMessage, ChatReply

# The spec model openai/gpt-oss-120b needs OpenRouter credits; this free model is used until they're purchased.
MODEL = "nvidia/nemotron-3.5-super-vl:free"

SYSTEM_PROMPT = """You are the assistant for a Kanban project management board.
You can answer questions about the board and create, edit, move or delete cards.

The board is JSON: "columns" is an ordered list of {id, title, cardIds}; "cards" maps each card id to {id, title, details}.
Rules when changing the board:
- Return the complete updated board in "board".
- Every card must appear in exactly one column's cardIds, and every id in cardIds must exist in "cards".
- A card's key in "cards" must equal its "id". New cards get a new unique id such as "card-<short random string>".
- Keep existing column ids. Rename a column only if asked.
If the user does not ask for a change, set "board" to null.
Always put a short reply to the user in "message".

Current board:
"""


@cache
def client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])


def chat(board: BoardData, history: list[ChatMessage], message: str) -> ChatReply:
    response = client().chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + board.model_dump_json()},
            *(m.model_dump() for m in history),
            {"role": "user", "content": message},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "chat_reply", "schema": ChatReply.model_json_schema()},
        },
    )
    return ChatReply.model_validate_json(response.choices[0].message.content)
