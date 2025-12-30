# Code Review: PSNY Mayday

**Review Date:** December 30, 2025
**Reviewer:** Claude Code
**Codebase Version:** Commit `f05b838`

---

## Executive Summary

PSNY Mayday is a well-architected collaborative poetry platform built for the Poetry Society of New York. It enables poets to write sonnets together in pairs, creating an infinite, self-perpetuating fractal ecosystem of Crown of Sonnets that automatically spawn from completed poems.

The codebase demonstrates solid software engineering principles with clean separation of concerns, thoughtful handling of complex user flows, and an impressive visualization system. There are several areas for improvement, primarily around security and code organization.

**Overall Rating: B+** — Production-ready with some refinements recommended.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11) |
| Database | SQLModel (SQLAlchemy + Pydantic) |
| Database Engine | SQLite (dev) / PostgreSQL (prod) |
| Frontend | Jinja2 Templates + Vanilla JavaScript (ES6 Modules) |
| Visualization | Canvas 2D API |
| Deployment | Render |

---

## Architecture Overview

```
psny-mayday/
├── Core Application
│   ├── app.py              # Main FastAPI application (1672 lines)
│   ├── models.py           # SQLModel database schemas
│   ├── database.py         # Database connection management
│   └── seed.py             # Initial data seeding
│
├── Frontend
│   ├── templates/          # Jinja2 HTML templates
│   └── static/
│       ├── styles.css      # Main styling
│       └── viz/            # Visualization ES6 modules
│           ├── main.js
│           ├── ExperienceDirector.js
│           ├── views/
│           │   ├── CosmosView.js
│           │   ├── LineageTunnelView.js
│           │   ├── ScrollView.js
│           │   └── PoetStudioView.js
│           ├── services/
│           │   └── CrownDataService.js
│           └── state/
│               └── AppState.js
│
└── Configuration
    ├── requirements.txt
    ├── render.yaml
    └── build.sh
```

---

## ✅ Strengths

### 1. Architecture & Design

- **Clean Separation of Concerns**: Models, database, routing, and views are properly separated with clear responsibilities.

- **Elegant Fractal Design**: The auto-spawning Crown system is creatively implemented. Completed sonnets automatically become seeds for new Crowns, creating an infinite poetry ecosystem.

- **Turn-Based Collaboration**: Simple but effective alternating write mechanism with clear state management.

- **ES6 Module System**: Frontend uses modern module patterns with proper dependency management and clean class-based architecture.

### 2. Code Quality

- **Type Safety**: SQLModel provides good typing for database models, combining SQLAlchemy with Pydantic validation.

- **Async Patterns**: Proper use of FastAPI's async handlers throughout the application.

- **Smart Caching**: `CrownDataService` implements sensible in-memory caching with invalidation support.

- **Memory Management**: Canvas event listeners are properly bound and unbound to prevent memory leaks in `CosmosView.js`.

### 3. User Experience Handling

- **Orphan Recovery**: Thoughtful handling of partner abandonment with multiple recovery options:
  - Restart with same bookend lines
  - Get completely new lines
  - Exit completely

- **Session Timeout**: 12-hour stale pair cleanup prevents zombie sessions from blocking Crown slots.

- **Multi-View Visualization**: Three distinct views (Threads, Scroll, Cosmos) provide rich exploration of the poetry ecosystem.

### 4. Specific Code Highlights

**`app.py:21-80`** — `spawn_source_sonnet_from_completed()`
```python
def spawn_source_sonnet_from_completed(sonnet_id: int, session: Session):
    """
    When a sonnet is completed, automatically create a new SourceSonnet from it.
    This allows completed sonnets to become seeds for future Crowns.
    """
```
Well-documented function with clear purpose and proper error handling.

**`CrownDataService.js:71-77`** — Parallel data loading
```javascript
async preloadCrown(crownId = this.crownId) {
    const [nodes, stats] = await Promise.all([
        this.getCrownNodes(crownId),
        this.getCrownStats(crownId)
    ]);
    return { nodes, stats };
}
```
Efficient parallel loading pattern.

**`CosmosView.js:161-172`** — Proper cleanup
```javascript
unbindEvents() {
    window.removeEventListener('resize', this.boundResize);
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    // ... all events properly unbound
}
```
Prevents memory leaks in long-running visualization.

---

## ⚠️ Issues & Recommendations

### 1. Security Concerns

#### 1.1 Session Hijacking via Email (HIGH)

**Location:** `app.py:397-399`

```python
existing_user = session.exec(select(User).where(User.email == email)).first()
if existing_user:
    return RedirectResponse(f"/poet?u={existing_user.code}", status_code=303)
```

**Problem:** Anyone who knows or guesses an email can access that user's session by simply signing up with the same email.

**Recommendations:**
- Add email verification flow before granting access
- Implement rate limiting on signup attempts
- Consider using HTTP-only session cookies instead of URL-based authentication
- Add CAPTCHA for repeated signup attempts

#### 1.2 Token Entropy (MEDIUM)

**Location:** `app.py:401`

```python
code = secrets.token_urlsafe(8)  # 48 bits of entropy
```

**Problem:** While `secrets.token_urlsafe` is cryptographically secure, 8 bytes (48 bits after base64) may be brute-forceable at scale.

**Recommendation:** Increase to 16+ bytes for production:
```python
code = secrets.token_urlsafe(16)  # 96 bits of entropy
```

#### 1.3 Email Storage (LOW)

**Location:** `models.py:8`

```python
email: str
```

**Problem:** Emails are stored in plaintext. If the database is compromised, all user emails are exposed.

**Recommendation:** For production, consider hashing emails or encrypting at rest.

---

### 2. Potential Bugs

#### 2.1 Missing Edge Case for Line Wrap-Around (MEDIUM)

**Location:** `app.py:676-678`

```python
.where(SourceLine.line_number.in_([pair.source_line_start, pair.source_line_start + 1]))
```

**Problem:** When `source_line_start` is 14, this queries for lines 14 and 15. Line 15 doesn't exist — it should wrap to line 1.

**Fix:**
```python
first_line = pair.source_line_start
second_line = 1 if pair.source_line_start == 14 else pair.source_line_start + 1
.where(SourceLine.line_number.in_([first_line, second_line]))
```

**Note:** This is handled correctly in other places (e.g., `app.py:175`) but inconsistently here.

#### 2.2 Ineffective Duplicate Check in Seed Script (LOW)

**Location:** `seed.py:10`

```python
session.exec(select(SourceSonnet)).first()  # Result is discarded
```

**Problem:** This query runs but its result isn't used. Running `seed.py` multiple times will create duplicate data.

**Fix:**
```python
existing = session.exec(select(SourceSonnet)).first()
if existing:
    print("Database already seeded. Skipping.")
    return
```

#### 2.3 Potential IndexError in Orphan Filling (LOW)

**Location:** `app.py:194-195`

```python
source_lines = session.exec(...).all()
# ... later
text=source_lines[0].text,  # Could IndexError if data is inconsistent
```

**Problem:** The code assumes both source lines exist but doesn't validate. If data is inconsistent, this will crash.

**Fix:**
```python
if len(source_lines) != 2:
    print(f"⚠️ Missing source lines for orphaned pair {orphaned_pair.id}")
    return None
```

---

### 3. Performance Considerations

#### 3.1 N+1 Query Problem in Fractal Tree API (MEDIUM)

**Location:** `app.py:1446-1664`

**Problem:** The `/api/fractal/tree` endpoint makes many individual queries per crown:
- 1 query for source_sonnet
- 1 query for source_lines
- N queries for each pair's users (user_1, user_2)
- N queries for each sonnet's lines

For a system with 10 crowns and 14 sonnets each, this could mean 300+ queries per request.

**Recommendation:** Use eager loading or batch queries:
```python
# Load all pairs with users in fewer queries
from sqlmodel import selectinload

pairs = session.exec(
    select(Pair)
    .where(Pair.crown_id.in_(crown_ids))
    .options(
        selectinload(Pair.user_1),
        selectinload(Pair.user_2)
    )
).all()
```

#### 3.2 Hover Detection Runs Every Frame (LOW)

**Location:** `CosmosView.js:380-382`

```javascript
drawCrowns() {
    const mouseWorld = this.screenToWorld(this.lastMouseX, this.lastMouseY);
    this.checkHover(mouseWorld);  // Runs 60 times/second
```

**Problem:** Hover detection iterates all crowns and sonnets on every render frame (~60/sec). With many crowns, this becomes expensive.

**Recommendation:**
- Only check hover on actual mouse move events
- Consider spatial indexing (quadtree) for large datasets
- Debounce hover checks

---

### 4. Code Organization

#### 4.1 Monolithic app.py (HIGH)

**Problem:** `app.py` is 1672 lines containing routing, business logic, helpers, and API endpoints. This makes it difficult to navigate and test.

**Recommendation:** Split into modules:

```
app/
├── __init__.py           # FastAPI app creation
├── routes/
│   ├── auth.py           # signup, login
│   ├── poet.py           # poet_home, add_line, complete
│   ├── abort.py          # leave/restart flows
│   ├── visualization.py  # crown visualization pages
│   └── api/
│       ├── crown.py      # Crown API endpoints
│       ├── sonnet.py     # Sonnet API endpoints
│       └── fractal.py    # Fractal tree API
├── services/
│   ├── pairing.py        # try_pair_users, cleanup_stale_pairs
│   └── spawning.py       # spawn_source_sonnet_from_completed
└── utils/
    └── helpers.py        # romanize, get_poem_lines_for_display
```

#### 4.2 Anonymous Class for Placeholders (LOW)

**Location:** `app.py:515-518`

```python
placeholder_line = type('obj', (object,), {
    'line_number': i,
    'text': ''
})()
```

**Problem:** This is clever but obscure. It creates an anonymous class at runtime, which is harder to understand and type-check.

**Recommendation:** Use a proper type:
```python
from typing import NamedTuple

class PlaceholderLine(NamedTuple):
    line_number: int
    text: str = ''

# Usage
placeholder_line = PlaceholderLine(line_number=i)
```

---

### 5. Database Schema Issues

#### 5.1 Missing Indexes (MEDIUM)

**Location:** `models.py`

**Problem:** Frequently queried fields lack indexes, which will slow down queries as data grows.

**Recommendation:**
```python
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    code: str = Field(index=True)
    status: str = Field(index=True)
    pair_id: Optional[int] = Field(default=None, foreign_key="pair.id", index=True)

class Pair(SQLModel, table=True):
    crown_id: int = Field(foreign_key="crown.id", index=True)
    status: str = Field(index=True)
```

#### 5.2 Missing Unique Constraints (MEDIUM)

**Location:** `models.py:8-10`

```python
email: str    # Should be unique
code: str     # Should be unique
```

**Problem:** The schema allows duplicate emails and codes, which could cause data integrity issues.

**Recommendation:**
```python
email: str = Field(unique=True)
code: str = Field(unique=True)
```

---

### 6. Error Handling

#### 6.1 No Global Exception Handler (MEDIUM)

**Problem:** Unhandled exceptions will return raw error messages to users, potentially exposing internal details.

**Recommendation:** Add a global exception handler:
```python
import logging

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred. Please try again."}
    )
```

#### 6.2 Silent API Failures in Frontend (LOW)

**Location:** `CrownDataService.js`

**Problem:** API errors throw exceptions but callers may not handle them, leading to silent failures.

**Recommendation:** Add error callbacks or UI feedback:
```javascript
try {
    const data = await this.dataService.getCrownContext(crownId);
} catch (error) {
    this.showErrorToast('Failed to load crown data');
    console.error('[CrownData] Error:', error);
}
```

---

### 7. Testing Gaps

**Problem:** The codebase has no test files. Given the complexity of the pairing and spawning logic, this is a significant risk.

**Priority Test Cases:**

1. **Pairing Logic** (`try_pair_users`)
   - Two waiting users get paired
   - Single user remains waiting
   - Orphaned pair gets filled first
   - Stale pairs get cleaned up

2. **Spawning Logic** (`spawn_source_sonnet_from_completed`)
   - Completed sonnet creates SourceSonnet
   - All 14 lines are copied correctly
   - Crown is marked complete when 14 pairs finish

3. **Turn Management**
   - Turns alternate correctly
   - Line 13 triggers completion
   - Turn is deleted on completion

4. **Abort/Reset Flows**
   - Partner leaving creates orphaned pair
   - Restart with same lines preserves slot
   - Restart with new lines abandons slot

**Recommended Testing Framework:** `pytest` with `pytest-asyncio` for FastAPI

---

## 📋 Prioritized Action Items

| Priority | Issue | Category | Effort |
|----------|-------|----------|--------|
| 🔴 **High** | Email-based session hijacking | Security | Medium |
| 🔴 **High** | Add unique constraints to models | Data Integrity | Low |
| 🔴 **High** | Split app.py into modules | Maintainability | High |
| 🟡 **Medium** | Add database indexes | Performance | Low |
| 🟡 **Medium** | Fix line wrap-around edge case | Bug | Low |
| 🟡 **Medium** | Add global exception handler | Reliability | Low |
| 🟡 **Medium** | Fix seed.py duplicate prevention | Operations | Low |
| 🟢 **Low** | Increase code token length | Security | Low |
| 🟢 **Low** | Optimize N+1 queries in fractal API | Performance | Medium |
| 🟢 **Low** | Add unit tests | Quality | High |
| 🟢 **Low** | Optimize hover detection in CosmosView | Performance | Low |

---

## Appendix: Database Schema Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ SourceSonnet│────<│ SourceLine  │     │   Crown     │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ title       │     │ source_id   │────>│ source_id   │
│ source_type │     │ line_number │     │ parent_id   │
│ parent_id   │     │ text        │     │ generation  │
│ created_at  │     └─────────────┘     │ status      │
└─────────────┘                         │ created_at  │
       ▲                                └─────────────┘
       │                                       │
       │ spawns                                │ has many
       │                                       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sonnet    │────<│    Line     │     │    Pair     │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ status      │     │ sonnet_id   │     │ crown_id    │
│ created_at  │     │ line_number │     │ user_1_id   │
│ spawned_id  │     │ text        │     │ user_2_id   │
└─────────────┘     │ author_id   │     │ sonnet_id   │
       ▲            │ created_at  │     │ status      │
       │            └─────────────┘     │ completion  │
       │                   │            └─────────────┘
       │                   │                   │
┌──────┴──────┐            │                   │
│    Turn     │            ▼                   ▼
├─────────────┤     ┌─────────────┐     ┌─────────────┐
│ id (PK)     │     │    User     │<────│    User     │
│ sonnet_id   │     ├─────────────┤     └─────────────┘
│ next_user_id│────>│ id (PK)     │
└─────────────┘     │ email       │
                    │ pen_name    │
                    │ code        │
                    │ status      │
                    │ pair_id     │
                    └─────────────┘
```

---

## Appendix: Key User Flows

### Pairing Flow
```
User Signs Up
     │
     ▼
┌─────────────────┐
│ Check Orphaned  │──Yes──> Fill Orphaned Slot
│ Pairs First     │              │
└────────┬────────┘              │
         │ No                    │
         ▼                       │
┌─────────────────┐              │
│ 2+ Waiting      │──No───> Stay Waiting
│ Users?          │              │
└────────┬────────┘              │
         │ Yes                   │
         ▼                       │
┌─────────────────┐              │
│ Find/Create     │              │
│ Forming Crown   │              │
└────────┬────────┘              │
         │                       │
         ▼                       ▼
┌─────────────────────────────────┐
│ Create Pair + Sonnet + Turn     │
│ Pre-fill bookend lines (1 & 14) │
└─────────────────────────────────┘
```

### Writing Flow
```
User's Turn
     │
     ▼
┌─────────────────┐
│ Submit Line     │
│ (lines 2-13)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Line 13?        │──No──> Toggle Turn to Partner
└────────┬────────┘              │
         │ Yes                   │
         ▼                       │
┌─────────────────┐              │
│ Mark Complete   │              │
│ Spawn Source    │              │
└────────┬────────┘              │
         │                       │
         ▼                       │
┌─────────────────┐              │
│ All 14 Pairs    │──No──────────┘
│ Complete?       │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Mark Crown      │
│ Complete        │
└─────────────────┘
```

---

## Conclusion

PSNY Mayday is a creatively designed and well-implemented collaborative poetry platform. The fractal Crown concept is innovative, and the codebase demonstrates good software engineering practices overall.

**Key Strengths:**
- Elegant fractal auto-spawning architecture
- Thoughtful user experience for edge cases
- Clean frontend module organization
- Impressive visualization system

**Priority Improvements:**
1. Address session security vulnerability
2. Add database constraints and indexes
3. Split monolithic app.py for maintainability
4. Add test coverage for critical paths

With these improvements, the platform will be well-positioned for production scale and long-term maintenance.

---

*Report generated by Claude Code*
