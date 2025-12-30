from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = Field(default=None, index=True)  # Optional - for PSNY CRM
    pen_name: str
    code: str = Field(unique=True, index=True)
    status: str = Field(default="waiting", index=True)
    pair_id: Optional[int] = Field(default=None, foreign_key="pair.id", index=True)


class Sonnet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"
    spawned_source_sonnet_id: Optional[int] = Field(default=None, foreign_key="sourcesonnet.id")  # Links to SourceSonnet this became


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
    source_type: str = "classic"  # "classic" or "collaborative"
    parent_sonnet_id: Optional[int] = Field(default=None, foreign_key="sonnet.id")  # If collaborative, which Sonnet spawned this
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SourceLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_sonnet_id: int = Field(foreign_key="sourcesonnet.id")
    line_number: int
    text: str


class Crown(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_sonnet_id: int = Field(foreign_key="sourcesonnet.id")
    parent_sonnet_id: Optional[int] = Field(default=None, foreign_key="sonnet.id")  # Which completed Sonnet spawned this Crown
    generation: int = 1  # 1=classic seed, 2=first gen collaborative, 3=second gen, etc.
    status: str = "forming"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Pair(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crown_id: int = Field(foreign_key="crown.id", index=True)
    user_1_id: int = Field(foreign_key="user.id")
    user_2_id: Optional[int] = Field(default=None, foreign_key="user.id")  # Optional for orphaned pairs
    source_line_start: int
    sonnet_id: Optional[int] = Field(default=None, foreign_key="sonnet.id")  # Optional when waiting for new partner
    status: str = Field(default="writing", index=True)
    completion_order: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)