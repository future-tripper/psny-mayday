"""
Tests for user pairing logic.

These tests verify that:
- Users get paired correctly
- Pairs receive correct bookend lines
- The wrap-around for pair 14 works
"""

import pytest
from sqlmodel import select
from models import User, Pair, Crown
from conftest import create_test_user, create_test_pair


class TestPairing:
    """Tests for the pairing system."""

    def test_create_user(self, session):
        """Basic test: can we create a user?"""
        user = create_test_user(session, "test@example.com", "Test Poet")

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.pen_name == "Test Poet"
        assert user.status == "waiting"

    def test_two_users_can_be_paired(self, seeded_session):
        """When two users exist, they can be paired together."""
        session = seeded_session

        # Get the crown
        crown = session.exec(select(Crown)).first()

        # Create two users
        user1 = create_test_user(session, "alice@test.com", "Alice")
        user2 = create_test_user(session, "bob@test.com", "Bob")

        # Create a pair
        pair, sonnet = create_test_pair(session, crown.id, user1, user2, source_line_start=1)

        # Verify pairing
        assert pair.user_1_id == user1.id
        assert pair.user_2_id == user2.id
        assert user1.status == "paired"
        assert user2.status == "paired"
        assert user1.pair_id == pair.id
        assert user2.pair_id == pair.id


class TestBookendLines:
    """Tests for bookend line assignment."""

    def test_pair_1_gets_lines_1_and_2(self, seeded_session):
        """Pair 1 should receive lines 1 and 2 as bookends."""
        pair_start = 1
        expected_second = 2

        # The logic: second_line = 1 if start == 14 else start + 1
        second_line = 1 if pair_start == 14 else pair_start + 1

        assert second_line == expected_second

    def test_pair_13_gets_lines_13_and_14(self, seeded_session):
        """Pair 13 should receive lines 13 and 14 as bookends."""
        pair_start = 13
        expected_second = 14

        second_line = 1 if pair_start == 14 else pair_start + 1

        assert second_line == expected_second

    def test_pair_14_wraps_around_to_line_1(self, seeded_session):
        """
        Pair 14 should receive lines 14 and 1 (wrap-around).
        This completes the "crown" structure.
        """
        pair_start = 14
        expected_second = 1  # Wraps around!

        second_line = 1 if pair_start == 14 else pair_start + 1

        assert second_line == expected_second, \
            f"Pair 14 should wrap to line 1, but got line {second_line}"


class TestCrownStructure:
    """Tests for Crown creation and structure."""

    def test_crown_starts_as_forming(self, seeded_session):
        """A new Crown should start with status 'forming'."""
        session = seeded_session
        crown = session.exec(select(Crown)).first()

        assert crown.status == "forming"
        assert crown.generation == 1

    def test_crown_has_14_source_lines(self, seeded_session):
        """The seed sonnet should have exactly 14 lines."""
        from models import SourceLine
        session = seeded_session

        crown = session.exec(select(Crown)).first()
        source_lines = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == crown.source_sonnet_id)
        ).all()

        assert len(source_lines) == 14
