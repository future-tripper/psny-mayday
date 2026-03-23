# PSNY MAYDAY - Fractal Poetry Ecosystem

## Project Overview
A collaborative poetry platform for the Poetry Society of New York (PSNY) where poets write sonnets together in pairs, creating an infinite, self-perpetuating Crown of Sonnets system.

## The Fractal Poetry System

### How It Works
1. **Users sign up** → Get paired with another poet → Receive 2 consecutive lines from a seed sonnet
2. **Pairs collaborate** → Write 12 lines between their 2 bookend lines → Create a complete 14-line sonnet
3. **Sonnets auto-spawn** → Each completed sonnet immediately becomes a seed for future Crowns
4. **Crowns complete** → When all 14 pairs finish → Crown marked complete → New Crown auto-creates from next seed
5. **Pattern repeats infinitely** → Fractal tree of poetry grows organically

### Crown Structure
- **Crown 1** (Generation 1): Seeded from Lady Mary Wroth's "In this strange labyrinth how shall I turn" (classic)
- **Crown 2-15** (Generation 2): Seeded from Crown 1's 14 completed sonnets
- **Crown 16+** (Generation 3+): Seeded from Crown 2's sonnets, and so on...

## Current Status: ✅ DEPLOYED ON RENDER

**Known Issues & Roadmap:** See `FEATURE_ROADMAP.md` for:
- 🟢 Low priority optimizations
- 🚀 Future features (AI writing partner, etc.)

### Unified System Architecture
- **One database**: `mayday.db` (SQLite with fractal Crown schema)
- **One seamless flow**: Signup → Writing → Visualization
- **Auto-spawning**: Sonnets → SourceSonnets → new Crowns (all automatic)
- **Full lineage tracking**: Every element traceable through generations
- **No accounts**: Pen name + code only, no authentication friction

### User Journey
1. **Enter** → `/signup` - Enter pen name (email optional), get a secret code
2. **Wait** → Waiting room until paired with another poet
3. **Write** → `/poet?u=CODE` - Collaborate on your sonnet (turn-based)
4. **Return** → Use your code to return to poem in progress
5. **Complete** → Celebration page when sonnet finishes
6. **View Crown** → `/crown/{id}/visualize` - Three integrated views:
   - **THREADS**: Horizontal scrolling cards with lineage timeline
   - **SCROLL**: Vertical list of all sonnets with bookend lines highlighted
   - **COSMOS**: Canvas star-field visualization of fractal crown system
7. **About** → `/about` - Learn about Mayday and Crown of Sonnets

### Authentication Model
- **No accounts** - Just enter a pen name and go
- **Pen name** = attribution for THIS poem only (not a persistent identity)
- **Code** = 128-bit secure token, key to return to THIS poem only
- **Email** = optional, just for PSNY CRM ("Stay in touch")
- Same pen name used by 100 people? Fine - it's communal poetry

### Visualization Features
**THREADS View**: Horizontal scrolling cards showing each sonnet as a card

**SCROLL View**: Vertical list of all sonnets with bookend lines highlighted

**COSMOS View** (Canvas 2D):
- Star-field background with twinkling stars
- Crowns displayed as rings of 14 sonnet-stars
- Generation colors: Gold (Gen 1), Blue (Gen 2), Green (Gen 3)
- Click stars to open reading overlay with full poem
- Drag to pan, scroll to zoom
- Lineage connections between parent/child crowns

**Dynamic Dropdown**: Only shows Crowns that exist in database

**Standalone Cosmos**: `/cosmos` - Full-screen cosmos experience with all crowns

### Abort/Reset Flow (Partner Abandonment)
When a partner leaves or goes inactive, the system handles it gracefully:

**User-initiated leave:**
1. User clicks "Leave collaboration" → `/confirm-leave` page with poem preview
2. Can copy their work, then choose: "Go to waiting room" or "Nah, I'm good" (exit)
3. Partner sees `/partner-left` page with options:
   - "Restart this poem" - Keep same bookend lines, wait for new partner
   - "Get new lines" - Release slot, join waiting room for fresh start
   - "Nah, I'm good" - Exit completely

**12-hour timeout (silent abandonment):**
1. `cleanup_stale_pairs()` runs on each signup, marks inactive pairs as "abandoned"
2. Abandoned slots become available for new pairs (backfill)
3. Returning user after timeout sees `/session-expired` page
4. Can rejoin waiting room with same account code

**Key endpoints:**
- `GET /confirm-leave` - User initiates leaving
- `GET /partner-left` - Remaining user sees options
- `GET /session-expired` - User returns after 12h timeout
- `GET /goodbye` - Friendly exit page
- `POST /abort`, `/restart-same-lines`, `/restart-new-lines`, `/leave-completely`, `/rejoin`

## Tech Stack
- **Backend**: FastAPI + SQLModel (Starlette 1.0+)
- **Database**: SQLite (local), PostgreSQL (production on Render)
- **Frontend**: Jinja2 templates + vanilla JavaScript (ES6 modules)
- **Visualization**: Canvas 2D (Cosmos), HTML/CSS (Threads, Scroll)
- **Styling**: Custom CSS with PSNY branding

### Important: TemplateResponse API
This project uses Starlette 1.0+ which requires the new `TemplateResponse` signature:
```python
# Correct (Starlette 1.0+)
templates.TemplateResponse(request, "template.html", {"key": value})

# Wrong (old Starlette)
templates.TemplateResponse("template.html", {"request": request, "key": value})
```

## File Structure

### Core Application Files
```
psny-mayday/
├── app.py                      # Main FastAPI server with fractal auto-spawning
├── models.py                   # Database models with fractal Crown schema
├── database.py                 # Database connection
├── seed.py                     # Seeds DB with Lady Mary Wroth's seed sonnet
├── create_crown.py             # Manual Crown creation tool
├── mayday.db                   # Local SQLite database (gitignored)
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
├── build.sh                    # Render build script
```

### Frontend Files
```
├── templates/                  # Jinja2 HTML templates
│   ├── signup.html            # User signup page
│   ├── waiting.html           # Waiting for pair page
│   ├── index.html             # Poet writing interface (turn-based)
│   ├── complete.html          # Sonnet completion celebration
│   ├── crown_visualization.html # Crown viz with Jewels/Threads/Scroll
│   ├── sonnet.html            # Individual sonnet view
│   ├── about.html             # About Mayday page
│   ├── confirm_leave.html     # User confirms leaving collaboration
│   ├── partner_left.html      # Options when partner has left
│   ├── session_expired.html   # User returns after 12h timeout
│   └── goodbye.html           # Friendly exit page
│
├── static/
│   ├── styles.css             # Main PSNY styling
│   ├── viz_styles.css         # Visualization-specific styles
│   ├── menu.js                # Mobile hamburger menu
│   ├── images/
│   │   └── psny-logo.png
│   └── viz/                   # ES6 module architecture for visualization
│       ├── main.js            # Boot sequence
│       ├── ExperienceDirector.js  # View orchestration
│       ├── services/
│       │   ├── AppState.js    # Reactive state management
│       │   └── CrownDataService.js # API data fetching
│       ├── views/
│       │   ├── CosmosView.js       # Cosmos star-field view (Canvas 2D)
│       │   ├── LineageTunnelView.js # Threads timeline view
│       │   ├── ScrollView.js       # Scroll vertical list view
│       │   └── PoetStudioView.js   # Side panel poem reader
│       └── utils/
│           ├── formatters.js   # Text formatting helpers
│           └── metrics.js      # Analytics tracking
```

### Documentation & Development
```
├── README.md                   # Quick start guide
├── claude.md                   # Full technical documentation (this file)
├── VISION_BOARD.md            # Future ideas and expansion concepts
│
└── visualization_dev/          # Development tools
    ├── generate_fractal_test_data.py # Generate test Crowns
    ├── generate_test_data.py         # Legacy test data generator
    ├── test_viz_api.py              # API testing script
    ├── UNIFICATION_PLAN.md          # Database unification notes
    └── README.md                    # Dev environment guide
```

### Git Ignored Files
```
.gitignore includes:
- .venv/              # Virtual environment
- __pycache__/        # Python cache
- *.db                # All database files
- .env                # Environment variables
- .DS_Store           # macOS files
- images/             # Local image assets
```

## Database Schema (Fractal Crown System)

### Key Models
```python
SourceSonnet:
  - title: str (first line for collaborative, poem title for classic)
  - source_type: "classic" | "collaborative"
  - parent_sonnet_id: int (which sonnet spawned this, if collaborative)

Crown:
  - source_sonnet_id: int
  - parent_sonnet_id: int (which sonnet spawned this Crown)
  - generation: int (1=classic seed, 2+=collaborative seeds)
  - status: "forming" | "complete"

Sonnet:
  - status: "active" | "complete"
  - spawned_source_sonnet_id: int (tracks if this became a seed)

Pair:
  - crown_id: int
  - user_1_id: int
  - user_2_id: Optional[int] (nullable for orphaned pairs awaiting new partner)
  - source_line_start: int (1-14, which line pair starts from)
  - sonnet_id: Optional[int] (nullable when waiting for new partner)
  - status: "writing" | "complete" | "orphaned" | "abandoned"
  - completion_order: int (1-14 within Crown)

User:
  - email: Optional[str] (for PSNY CRM, not required)
  - pen_name: str (attribution for this poem)
  - code: str (128-bit secure token, unique)
  - status: "waiting" | "paired" | "waiting_for_partner" | "inactive"
```

## Local Development

### Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn sqlmodel jinja2 python-multipart

# Seed database with the source sonnet
python seed.py

# Run server
uvicorn app:app --reload
```

### Testing the Fractal System
1. Sign up 28 users (14 pairs) for Crown 1
2. Complete all 14 sonnets → Crown 1 marks "complete"
3. Sign up 2 more users → Crown 2 auto-creates (Generation 2)
4. Dropdown now shows Crowns 1 and 2
5. Crown 2 seed = first completed sonnet from Crown 1
6. Repeat to test Crown 3, 4, etc.

## Production Deployment

**Live URL:** https://psny-mayday.onrender.com

**Render Setup:**
- Web Service: `psny-mayday` (auto-deploys from main branch)
- Database: PostgreSQL `mayday-db` (Oregon region)
- Environment: `DATABASE_URL` auto-configured by Render

## Admin Tools

### Database Reset & Reseed
To completely reset the database and reseed with Lady Mary Wroth's poem:

```bash
curl -X POST "https://psny-mayday.onrender.com/admin/reset?key=YOUR_ADMIN_SECRET"
```

**Requirements:**
- `ADMIN_SECRET` environment variable must be set on Render
- Returns JSON confirmation with seed poem details

**Use cases:**
- Before testing cycles
- After corrupted data
- Resetting for demos

**Response:**
```json
{
  "success": true,
  "message": "Database reset and reseeded",
  "seed_poem": {
    "title": "In this strange labyrinth how shall I turn",
    "author": "Lady Mary Wroth",
    "lines": 14
  },
  "crown_id": 1
}
```

## Important Notes

### Changing the Seed Poem
To use a different classic seed poem:

1. **Update `seed.py`**: Change title and all 14 lines
2. **Update `app.py`**: Search for `"Lady Mary Wroth"` (appears 4 times) and replace with new author name

All other titles, first lines, and authors for collaborative sonnets are **fully dynamic** from database.

### Auto-Spawning Logic
When a sonnet completes (line 13 added):
1. `spawn_source_sonnet_from_completed()` creates new SourceSonnet
2. Copies all 14 lines to SourceLine table
3. Sets `source_type="collaborative"` and tracks parent

When users sign up after a Crown completes:
1. `try_pair_users()` finds next unused SourceSonnet
2. Creates new Crown with proper generation tracking
3. New Crown appears in dropdown immediately

---

**Status**: ✅ Live on Render | See `FEATURE_ROADMAP.md` for known issues and planned features
