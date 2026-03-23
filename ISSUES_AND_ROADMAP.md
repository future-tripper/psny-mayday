# Mayday Roadmap

*Active issue tracking and feature planning*

---

## 🔴 High Priority Issues

### Code Organization: Monolithic app.py
**Status:** Planned
**Source:** Code Review

**Problem:** `app.py` is ~1700 lines containing routing, business logic, helpers, and API endpoints. Hard to navigate and test.

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

## 🟢 Low Priority Issues

### Quality: Expand Unit Tests
**Status:** Setup complete, expand as needed
**Source:** Code Review

**Current coverage:**
- Basic pairing tests
- Bookend line wrap-around test
- API endpoint tests

**Priority areas to add:**
- `try_pair_users` integration
- `spawn_source_sonnet_from_completed` logic
- Turn management
- Abort/Reset flows

**See:** `TESTING.md` for how to run and write tests

---

### Operations: Error Alerting
**Status:** Planned
**Source:** Discussion

**Problem:** Currently no way to know when errors occur unless manually checking Render logs.

**Options:**
- Render Notifications (deploy failures only)
- Sentry (full error tracking, free tier: 5K errors/month)
- Email on exception (requires email service setup)

**Recommendation:** Start with Render notifications, upgrade to Sentry if needed.

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

### Changed Seed Poem to Lady Mary Wroth (Jan 3, 2026)
- Replaced Ted Berrigan's "Sonnet 1" with Lady Mary Wroth's "In this strange labyrinth how shall I turn"
- Updated `seed.py`, `app.py`, test fixtures, and frontend fallback data
- Reset production database required before launch

### Simplified Pen Name + Code Flow (Dec 30, 2025)
- **No accounts, no authentication friction** - just enter pen name and go
- Email made optional ("Stay in touch with PSNY") - for CRM collection only
- Pen name = attribution for THIS poem only (not a persistent identity)
- Code = key to return to THIS poem only (128-bit secure token)
- Same pen name used by multiple people? Fine - it's communal poetry
- Two-section signup: "Start a New Sonnet" + "Return to Your Poem"
- POST /return endpoint for code-based poem access
- Input validation: pen name max 100 chars, email max 254 chars, poem lines max 500 chars
- Updated tests for optional email flow

### Database Integrity & Launch Prep (Dec 30, 2025)
- Unique constraint on User.code (email is now optional, not unique)
- Database indexes on frequently queried fields (User.email, code, status, pair_id; Pair.crown_id, status)
- seed.py duplicate prevention (won't double-seed)
- Returning user re-pairing flow (can sign up again after completing a poem)
- Line wrap-around fix: Pair 14 now correctly receives lines 14 and 1 (completing the crown)
- Poetic global exception handler (graceful error page with logging)
- N+1 query fix in fractal API (7 queries instead of 300+)
- Hover detection optimization in CosmosView (only on mouse move, not every frame)
- Unit test framework setup (pytest + sample tests + TESTING.md guide)

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

*Last updated: January 3, 2026*
