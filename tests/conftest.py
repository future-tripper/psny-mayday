"""
Pytest configuration and shared fixtures for Mayday tests.

This file is automatically loaded by pytest and provides:
- Test database setup/teardown
- Reusable fixtures for creating test data
- FastAPI test client
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

# Import app and models
import sys
sys.path.insert(0, '..')

from app import app
from database import get_session
from models import User, Sonnet, Line, Turn, Crown, Pair, SourceSonnet, SourceLine


# Create in-memory test database
@pytest.fixture(name="engine")
def engine_fixture():
    """Create a fresh in-memory database for each test."""
    engine = create_engine(
        "sqlite://",  # In-memory SQLite
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(engine):
    """Create a database session for testing."""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    """Create a FastAPI test client with test database."""
    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="seeded_session")
def seeded_session_fixture(session):
    """
    Create a session with the seed poem already loaded.
    Use this when you need a Crown ready for pairing.
    """
    # Create source sonnet (Ted Berrigan's Sonnet 1)
    source_sonnet = SourceSonnet(
        title="Sonnet 1",
        source_type="classic",
        parent_sonnet_id=None
    )
    session.add(source_sonnet)
    session.commit()
    session.refresh(source_sonnet)

    # Add the 14 lines
    lines = [
        "His piercing pince-nez. Some dim frieze",
        "Hands point to a dim frieze, in the dark night.",
        "In the book of his music the corners have straightened:",
        "Which owe their presence to our sleeping hands.",
        "The ox-blood from the hands which play",
        "For fire for warmth for hands for growth",
        "Is there room in the room that you room in?",
        "Upon his structured tomb:",
        "Still they mean something. For the dance",
        "And the architecture.",
        "Weave among incidents",
        "May be portentous to him",
        "We are the sleeping fragments of his sky,",
        "Wind giving presence to fragments."
    ]

    for i, line_text in enumerate(lines, start=1):
        source_line = SourceLine(
            source_sonnet_id=source_sonnet.id,
            line_number=i,
            text=line_text
        )
        session.add(source_line)

    # Create Crown 1
    crown = Crown(
        source_sonnet_id=source_sonnet.id,
        generation=1,
        parent_sonnet_id=None,
        status="forming"
    )
    session.add(crown)
    session.commit()

    return session


# Helper functions for creating test data
def create_test_user(session, pen_name, email=None, status="waiting"):
    """Helper to create a user for testing. Email is optional."""
    import secrets
    user = User(
        email=email,
        pen_name=pen_name,
        code=secrets.token_urlsafe(8),
        status=status
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_test_pair(session, crown_id, user1, user2, source_line_start):
    """Helper to create a pair for testing."""
    sonnet = Sonnet(status="active")
    session.add(sonnet)
    session.commit()
    session.refresh(sonnet)

    pair = Pair(
        crown_id=crown_id,
        user_1_id=user1.id,
        user_2_id=user2.id,
        source_line_start=source_line_start,
        sonnet_id=sonnet.id,
        status="writing"
    )
    session.add(pair)
    session.commit()
    session.refresh(pair)

    # Update users with pair_id (now that pair has an ID)
    user1.status = "paired"
    user1.pair_id = pair.id
    user2.status = "paired"
    user2.pair_id = pair.id
    session.add(user1)
    session.add(user2)
    session.commit()
    session.refresh(user1)
    session.refresh(user2)

    return pair, sonnet
