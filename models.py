from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str
    pen_name: str
    code: str
    status: str = "waiting"
    pair_id: Optional[int] = Field(default=None, foreign_key="pair.id")


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


class SourceSonnet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SourceLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_sonnet_id: int = Field(foreign_key="sourcesonnet.id")
    line_number: int
    text: str


class Crown(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_sonnet_id: int = Field(foreign_key="sourcesonnet.id")
    status: str = "forming"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Pair(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crown_id: int = Field(foreign_key="crown.id")
    user_1_id: int = Field(foreign_key="user.id")
    user_2_id: int = Field(foreign_key="user.id")
    source_line_start: int
    sonnet_id: int = Field(foreign_key="sonnet.id")
    status: str = "writing"
    completion_order: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)