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

    def test_signup_with_pen_name_only(self, client):
        """Signup works with just a pen name (no email required)."""
        response = client.post(
            "/signup",
            data={"pen_name": "New Poet"},
            follow_redirects=False
        )

        # Should show the your_code.html page
        assert response.status_code == 200
        assert "Your Secret Code" in response.text
        assert "New Poet" in response.text

    def test_signup_with_email(self, client):
        """Signup works with optional email provided."""
        response = client.post(
            "/signup",
            data={
                "pen_name": "Email Poet",
                "email": "poet@test.com"
            },
            follow_redirects=False
        )

        assert response.status_code == 200
        assert "Your Secret Code" in response.text
        assert "Email Poet" in response.text

    def test_return_with_valid_code(self, client):
        """Returning with a valid code should redirect to poet page."""
        # First signup to get a code
        response1 = client.post(
            "/signup",
            data={"pen_name": "Return Poet"},
            follow_redirects=False
        )
        # Extract code from the page (it's in the HTML)
        import re
        match = re.search(r'id="secret-code">([^<]+)</div>', response1.text)
        assert match, "Could not find secret code in response"
        code = match.group(1)

        # Now return with that code
        response2 = client.post(
            "/return",
            data={"code": code},
            follow_redirects=False
        )
        assert response2.status_code == 303
        assert f"/poet?u={code}" in response2.headers["location"]

    def test_return_with_invalid_code(self, client):
        """Returning with an invalid code should show an error."""
        response = client.post(
            "/return",
            data={"code": "invalid-code-12345"},
            follow_redirects=False
        )
        assert response.status_code == 200
        assert "Code not found" in response.text
