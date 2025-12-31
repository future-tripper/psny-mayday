from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
import os

# Use DATABASE_URL from environment (Render sets this automatically)
# Falls back to SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mayday.db")

# PostgreSQL URLs from Render start with "postgres://" but SQLAlchemy 1.4+ requires "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Use check_same_thread=False only for SQLite
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, echo=True, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


def run_migrations():
    """Run any pending database migrations."""
    with engine.connect() as conn:
        # Check if we're on PostgreSQL (Render) vs SQLite (local)
        if not DATABASE_URL.startswith("sqlite"):
            # Make email column nullable (migration for optional email feature)
            try:
                conn.execute(text('ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL'))
                conn.commit()
                print("Migration: Made email column nullable")
            except Exception as e:
                # Column might already be nullable, that's fine
                if "already" not in str(e).lower():
                    print(f"Migration note: {e}")
