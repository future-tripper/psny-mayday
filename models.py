from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    display_name: str
    code: str


class Sonnet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"


class Line(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sonnet_id: int = Field(foreign_key="sonnet.id")
    line_number: int
    text: str
    author_user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Turn(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sonnet_id: int = Field(foreign_key="sonnet.id")
    next_user_id: int = Field(foreign_key="user.id")