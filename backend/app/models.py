from typing import Literal

from pydantic import BaseModel, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_consistency(self):
        placed = [card_id for column in self.columns for card_id in column.cardIds]
        if len(placed) != len(set(placed)):
            raise ValueError("A card appears in more than one place")
        if set(placed) != set(self.cards):
            raise ValueError("Every card must be in exactly one column")
        for key, card in self.cards.items():
            if key != card.id:
                raise ValueError(f"Card key {key} does not match its id {card.id}")
        return self


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatReply(BaseModel):
    message: str
    board: BoardData | None
