import os
from functools import cache

from openai import OpenAI

from app.models import BoardData, ChatMessage, ChatReply

# The spec model openai/gpt-oss-120b needs OpenRouter credits; this free model is used until they're purchased.
MODEL = "nvidia/nemotron-3.5-super-vl:free"

SYSTEM_PROMPT = """You are the assistant for a Kanban project management board.
You can answer questions about the board, create, edit, move or delete cards, rename, add and delete columns.

The board is JSON: "columns" is an ordered list of {id, title, cardIds}; "cards" maps each card id to {id, title, details}.
Rules when changing the board:
- Return the complete updated board in "board".
- Every card must appear in exactly one column's cardIds, and every id in cardIds must exist in "cards".
- A card's key in "cards" must equal its "id". New cards get a new unique id such as "card-<short random string>".
- Keep existing columns' ids and order. Never reorder columns. Rename a column only if asked.
- To add a column, insert {id, title, cardIds: []} into "columns" at the requested position (at the end if none is given). Give it a new unique id such as "col-<short random string>".
- To delete a column, remove it from "columns". If it still has cards, the user must say whether to delete them or move them to another column; if they did not, set "board" to null and ask. The board must keep at least one column.
If the user does not ask for a change, set "board" to null.
Always put a short reply to the user in "message".

Current board:
"""


@cache
def client() -> OpenAI:
    # A missing key raises openai.OpenAIError on first use, which the chat route turns into a 502.
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        timeout=60,
        max_retries=1,
    )


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
