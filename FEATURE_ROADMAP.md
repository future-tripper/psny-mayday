# Mayday Roadmap

*Active issue tracking and feature planning*

---

## 🔴 High Priority Issues

### 1. Security: Email Session Vulnerability
**Status:** Planned
**Source:** Code Review

**Problem:** Anyone who knows/guesses an email can hijack that user's session by signing up with the same email. No verification required.

```python
# app.py:397-399 - Current vulnerable code
existing_user = session.exec(select(User).where(User.email == email)).first()
if existing_user:
    return RedirectResponse(f"/poet?u={existing_user.code}", status_code=303)
```

**Options:**
1. **Magic links** - Email a login link each time (requires email service: Resend, SendGrid)
2. **Password protection** - Add traditional login credentials
3. **Unique signup URLs** - Generate `/signup/abc123` links, distribute via PSNY channels
4. **Increased token entropy + rate limiting** - Quick partial fix

**Decision:** TBD - requires email service setup for proper fix

---

### 2. Code Organization: Monolithic app.py
**Status:** Planned
**Source:** Code Review

**Problem:** `app.py` is 1672 lines containing routing, business logic, helpers, and API endpoints. Hard to navigate and test.

**Recommended structure:**
```
app/
├── __init__.py           # FastAPI app creation
├── routes/
│   ├── auth.py           # signup, login
│   ├── poet.py           # poet_home, add_line
│   ├── abort.py          # leave/restart flows
│   ├── visualization.py  # crown visualization
│   └── api/
│       ├── crown.py
│       └── fractal.py
├── services/
│   ├── pairing.py        # try_pair_users, cleanup_stale_pairs
│   └── spawning.py       # spawn_source_sonnet_from_completed
└── utils/
    └── helpers.py        # romanize, get_poem_lines_for_display
```

**Effort:** High - significant refactor

---

## 🟡 Medium Priority Issues

### 3. Bug: Line Wrap-Around Edge Case
**Status:** Planned
**Source:** Code Review

**Location:** `app.py:676-678`

**Problem:** When `source_line_start` is 14, queries for lines 14 and 15. Line 15 doesn't exist.

**Fix:**
```python
first_line = pair.source_line_start
second_line = 1 if pair.source_line_start == 14 else pair.source_line_start + 1
```

---

### 4. Reliability: Add Global Exception Handler
**Status:** Planned
**Source:** Code Review

**Problem:** Unhandled exceptions return raw error messages, potentially exposing internal details.

**Fix:**
```python
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred. Please try again."}
    )
```

---

## 🟢 Low Priority Issues

### 5. Security: Increase Token Entropy
**Status:** Planned
**Source:** Code Review

**Current:** 8 bytes (48 bits after base64)
**Recommended:** 16+ bytes (96 bits)

```python
code = secrets.token_urlsafe(16)  # Instead of 8
```

---

### 6. Performance: N+1 Queries in Fractal API
**Status:** Planned
**Source:** Code Review

**Problem:** `/api/fractal/tree` makes many individual queries per crown.

**Fix:** Use eager loading with `selectinload`.

---

### 7. Performance: Hover Detection in CosmosView
**Status:** Planned
**Source:** Code Review

**Problem:** Hover detection runs every frame (~60/sec).

**Fix:** Only check on mouse move, consider spatial indexing for large datasets.

---

### 8. Quality: Add Unit Tests
**Status:** Planned
**Source:** Code Review

**Priority test areas:**
- Pairing logic (`try_pair_users`)
- Spawning logic (`spawn_source_sonnet_from_completed`)
- Turn management
- Abort/Reset flows

**Framework:** pytest + pytest-asyncio

---

## 🚀 Future Features

### AI Writing Partner
**Status:** Not Started
**Source:** Original roadmap

Allow users to collaborate with Claude when no human partner is available.

**Key components:**
- Virtual AI user in database
- `/pair-with-ai` endpoint
- `generate_ai_line()` function using Claude API
- Integration with turn-based writing flow
- Attribution display: "Name + Claude"

**Requirements:**
- Anthropic API key
- `anthropic` Python package

**See:** VISION_BOARD.md for additional AI integration ideas

---

## ✅ Completed

### Database Integrity & Launch Prep (Dec 30, 2025)
- Unique constraints on User.email and User.code
- Database indexes on frequently queried fields (User.email, code, status, pair_id; Pair.crown_id, status)
- seed.py duplicate prevention (won't double-seed)
- Returning user re-pairing flow (can sign up again after completing a poem)

### Phase 1: Abort/Reset Flow
- User-initiated leave with poem preview
- Partner options: restart same lines, get new lines, exit
- 12-hour timeout for silent abandonment
- Session expired page for returning users
- Orphan pair backfilling

### Phase 3: Fractal Visualization (Cosmos)
- `/cosmos` standalone page
- Cosmos tab in crown visualization
- Canvas star-field with crowns as rings
- Click stars to read poems
- Generation-based colors
- Zoom/pan interactions

---

*Last updated: December 30, 2025*
