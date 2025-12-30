# Testing Guide for Mayday

A quick reference for running and writing tests.

---

## Quick Start

```bash
# Install test dependencies (one time)
pip install pytest pytest-asyncio httpx

# Run all tests
pytest

# Run tests with more detail
pytest -v

# Run a specific test file
pytest tests/test_pairing.py

# Run a specific test
pytest tests/test_pairing.py::TestBookendLines::test_pair_14_wraps_around_to_line_1
```

---

## Understanding Test Output

### All tests pass:
```
tests/test_pairing.py::TestPairing::test_create_user PASSED
tests/test_pairing.py::TestBookendLines::test_pair_14_wraps_around_to_line_1 PASSED
...
========================= 8 passed in 0.45s =========================
```

### A test fails:
```
tests/test_pairing.py::TestBookendLines::test_pair_14_wraps_around_to_line_1 FAILED

    def test_pair_14_wraps_around_to_line_1(self):
        pair_start = 14
        expected_second = 1

        second_line = pair_start + 1  # BUG: should wrap!

>       assert second_line == expected_second
E       AssertionError: assert 15 == 1

========================= 1 failed, 7 passed in 0.52s =========================
```

The output tells you:
- Which test failed
- What was expected vs. what happened
- The exact line that failed

---

## Test File Structure

```
tests/
├── __init__.py          # Makes tests a Python package
├── conftest.py          # Shared fixtures and helpers
├── test_pairing.py      # Tests for pairing logic
└── test_api.py          # Tests for API endpoints
```

---

## Writing New Tests

### Basic test pattern:
```python
def test_something_works(self, session):
    """Describe what this test verifies."""
    # 1. Set up test data
    user = create_test_user(session, "test@example.com", "Test")

    # 2. Do the thing you're testing
    result = some_function(user)

    # 3. Check the result
    assert result == expected_value
```

### Using fixtures:
```python
def test_with_database(self, session):
    """Use 'session' for empty database."""
    pass

def test_with_seed_data(self, seeded_session):
    """Use 'seeded_session' for database with Crown 1 ready."""
    pass

def test_api_endpoint(self, client):
    """Use 'client' to test HTTP endpoints."""
    response = client.get("/signup")
    assert response.status_code == 200
```

### Testing API endpoints:
```python
def test_signup_form(self, client):
    response = client.post(
        "/signup",
        data={"email": "new@test.com", "pen_name": "Poet"},
        follow_redirects=False
    )
    assert response.status_code == 303
```

---

## Available Fixtures

| Fixture | Description |
|---------|-------------|
| `session` | Empty test database |
| `seeded_session` | Database with seed poem and Crown 1 |
| `client` | FastAPI test client for HTTP requests |

### Helper functions in conftest.py:
```python
# Create a test user
user = create_test_user(session, "email@test.com", "Pen Name")

# Create a test pair with sonnet
pair, sonnet = create_test_pair(session, crown_id, user1, user2, source_line_start=1)
```

---

## What to Test

### High priority (test these first):
- **Pairing logic** - Users getting matched correctly
- **Bookend line assignment** - Especially the wrap-around at pair 14
- **Sonnet completion** - Status changes when poem finishes
- **Crown completion** - New Crown spawns correctly

### Medium priority:
- **API responses** - Correct JSON structure
- **Page loads** - No 500 errors
- **Form submissions** - Redirects work

### Lower priority:
- **Edge cases** - Empty database, single user, etc.
- **Error handling** - Invalid inputs

---

## Tips

1. **Run tests before pushing:**
   ```bash
   pytest && git push
   ```

2. **Test the bug before fixing:**
   - Write a test that fails because of the bug
   - Fix the bug
   - Test now passes
   - Bug can never come back

3. **Keep tests fast:**
   - Use in-memory SQLite (already configured)
   - Don't test external services

4. **Name tests clearly:**
   - `test_pair_14_wraps_around_to_line_1` is better than `test_wrap`

---

## Troubleshooting

### "Module not found" errors:
```bash
# Run from the project root
cd /path/to/psny-mayday
pytest
```

### Tests pass locally but fail on server:
- Check if you're using the test database (in-memory SQLite)
- Don't test against production database!

### Need to see print statements:
```bash
pytest -s  # Shows print output
```

---

## Future: CI/CD Integration

To run tests automatically on every push, add GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest
```

This will show a green checkmark or red X on every commit.

---

*Last updated: December 30, 2025*
