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
- **Crown 1** (Generation 1): Seeded from Ted Berrigan's "Sonnet 1" (classic)
- **Crown 2-15** (Generation 2): Seeded from Crown 1's 14 completed sonnets
- **Crown 16+** (Generation 3+): Seeded from Crown 2's sonnets, and so on...

## Current Status: ✅ PRODUCTION READY (Local Testing)

### Unified System Architecture
- **One database**: `mayday.db` (SQLite with fractal Crown schema)
- **One seamless flow**: Signup → Writing → Visualization
- **Auto-spawning**: Sonnets → SourceSonnets → new Crowns (all automatic)
- **Full lineage tracking**: Every element traceable through generations

### User Journey
1. **Sign Up** → `/signup` - Join and get paired with a partner
2. **Writing** → `/poet?u=CODE` - Collaborate on your sonnet (turn-based)
3. **Completion** → Celebration page when sonnet finishes
4. **View Crown** → `/crown/{id}/visualize` - Three integrated views:
   - **JEWELS**: 3D immersive orbital visualization (Three.js)
   - **THREADS**: Horizontal timeline of lineage
   - **SCROLL**: Vertical list of all sonnets
5. **About** → `/about` - Learn about Mayday and Crown of Sonnets

### Visualization Features
**JEWELS View** (Three.js WebGL):
- Golden seed star at center with pulsing rays
- 14 breathing orbs (varied geometry based on depth)
- Hover overlays show first line + authors
- Click orbs to open side panel with full sonnet
- Drag to rotate, scroll to zoom
- Click outside panel to close

**THREADS View**: Horizontal scrolling cards with lineage timeline

**SCROLL View**: Vertical list of all sonnets with bookend lines highlighted

**Dynamic Dropdown**: Only shows Crowns that exist in database

## Tech Stack
- **Backend**: FastAPI + SQLModel
- **Database**: SQLite (local), PostgreSQL (production on Render)
- **Frontend**: Jinja2 templates + vanilla JavaScript (ES6 modules)
- **3D Graphics**: Three.js
- **Styling**: Custom CSS with PSNY branding

## File Structure

### Core Application Files
```
psny-mayday/
├── app.py                      # Main FastAPI server with fractal auto-spawning
├── models.py                   # Database models with fractal Crown schema
├── database.py                 # Database connection
├── seed.py                     # Seeds DB with Ted Berrigan's "Sonnet 1"
├── create_crown.py             # Manual Crown creation tool
├── mayday.db                   # Production SQLite database (gitignored)
├── requirements.txt            # Python dependencies
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
│   └── about.html             # About Mayday page
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
│       │   ├── OrreryView.js       # 3D Jewels view (Three.js)
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
  - user_1_id, user_2_id: int
  - source_line_start: int (1-14, which line pair starts from)
  - sonnet_id: int
  - status: "writing" | "complete"
  - completion_order: int (1-14 within Crown)
```

## Local Development

### Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn sqlmodel jinja2 python-multipart

# Seed database with Ted Berrigan's "Sonnet 1"
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

## Next: Deploy to Render

### Database Migration (SQLite → PostgreSQL)
- Will need to migrate schema and seed data
- Update `database.py` to use PostgreSQL connection string
- Update `models.py` if any Postgres-specific changes needed

### Environment Variables for Render
- `DATABASE_URL`: PostgreSQL connection string (auto-provided by Render)
- Any other config as needed

## Important Notes

### Changing the Seed Poem
To use a different classic seed poem (not Ted Berrigan's "Sonnet 1"):

1. **Update `seed.py`**: Change title and all 14 lines
2. **Update `app.py`**: Search for `"Ted Berrigan"` (appears 4 times) and replace with new author name

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

**Status**: Ready for local testing → Deploy to Render
