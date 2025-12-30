"""
Tests for API endpoints.

These tests verify that:
- Pages load correctly
- API endpoints return expected data
- Form submissions work
"""

import pytest


class TestPages:
    """Tests for page endpoints."""

    def test_signup_page_loads(self, client):
        """The signup page should load successfully."""
        response = client.get("/signup")

        assert response.status_code == 200
        assert "Mayday" in response.text

    def test_about_page_loads(self, client):
        """The about page should load successfully."""
        response = client.get("/about")

        assert response.status_code == 200

    def test_root_redirects_to_signup(self, client):
        """The root URL should redirect to signup."""
        response = client.get("/", follow_redirects=False)

        assert response.status_code == 303
        assert "/signup" in response.headers["location"]


class TestFractalAPI:
    """Tests for the fractal/cosmos API."""

    def test_fractal_tree_returns_json(self, client):
        """The fractal tree API should return JSON."""
        response = client.get("/api/fractal/tree")

        assert response.status_code == 200
        data = response.json()
        assert "crowns" in data
        assert "originalSeed" in data

    def test_fractal_tree_empty_without_data(self, client):
        """Without seed data, fractal tree returns empty crowns."""
        response = client.get("/api/fractal/tree")

        data = response.json()
        assert data["crowns"] == []


class TestSignupFlow:
    """Tests for the signup flow."""

    def test_signup_creates_user(self, client):
        """Submitting the signup form should create a user."""
        response = client.post(
            "/signup",
            data={
                "email": "newuser@test.com",
                "pen_name": "New Poet"
            },
            follow_redirects=False
        )

        # Should redirect to poet page
        assert response.status_code == 303
        assert "/poet?u=" in response.headers["location"]

    def test_returning_user_recognized(self, client):
        """A returning user with same email should be recognized."""
        # First signup
        response1 = client.post(
            "/signup",
            data={"email": "returning@test.com", "pen_name": "Poet"},
            follow_redirects=False
        )
        first_redirect = response1.headers["location"]

        # Second signup with same email
        response2 = client.post(
            "/signup",
            data={"email": "returning@test.com", "pen_name": "Poet"},
            follow_redirects=False
        )
        second_redirect = response2.headers["location"]

        # Should get the same user code
        assert "/poet?u=" in first_redirect
        assert "/poet?u=" in second_redirect
