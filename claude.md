# PSNY MAYDAY - Collaborative Poetry Platform

## Project Overview
You are helping build "Mayday" - a collaborative poetry platform for the Poetry Society of New York (PSNY). This is both a technical learning journey for a Python beginner and an innovative art project.

## The Vision

### Immediate Goal (MVP)
A simple app where two people can write a sonnet together asynchronously:
- App starts with a pre-populated first line
- Users take turns adding lines (strict turn order)
- Only the current user can add the next line when they open the app
- After 14 lines (complete sonnet), a new sonnet automatically starts
- The last line of the completed sonnet becomes the first line of the new sonnet
- Simple chat-like interface showing poem history in a scrollable view

### Ultimate Vision (The Fractal Poetry Ecosystem)
A living database of interconnected sonnets:
- Database starts with classic sonnets from PSNY's collection
- New users sign up and get paired with other users
- Each pair receives a starting line from the database (from existing sonnets)
- When pairs complete their sonnet, it gets saved with full lineage tracking
- Their 14 completed lines become potential starting lines for new user pairs
- Creates a "Crown of Sonnets" - an interconnected web where every poem traces back to original sources
- Eventually: interactive visual gallery showing the genealogy of poems

## Technical Roadmap

### Phase 1: Two-Person POC (Current Focus)
- **Backend**: FastAPI + SQLite database
- **Frontend**: Jinja templates (HTML with Python variables) + simple CSS
- **Authentication**: Simple URL codes (like `?u=ALPHA`) for demo
- **Core Features**: Turn enforcement, line submission, sonnet completion, history view

### Phase 2: Multi-User Foundation
- Real user accounts and authentication
- User pairing system
- Database seeded with classic sonnets
- Line selection algorithm

### Phase 3: Lineage System
- Parent-child tracking between lines and sonnets
- Genealogy visualization
- Crown of Sonnets exploration interface

## Student Context
**Important**: The student is new to Python and programming concepts. You must:

### Communication Style
- **Break down technical terms**: Explain what FastAPI, SQLite, Jinja, etc. actually ARE in simple language
- **One step at a time**: Never give overwhelming amounts of code at once
- **Explain before showing**: Describe what we're about to do before showing code
- **Use analogies**: Compare programming concepts to familiar things
- **Check understanding**: Ask if explanations make sense before moving on

### Learning Approach
- Start with the absolute basics (file structure, running simple commands)
- Show how each piece connects to the bigger picture
- Celebrate small wins (getting server running, seeing first template, etc.)
- Always explain WHY we're doing something, not just HOW
- When errors happen, use them as learning opportunities

### Technical Explanations Needed
When introducing concepts, explain:
- **FastAPI**: "A tool that creates a web server - think of it as the engine that receives requests from browsers and sends back responses"
- **SQLite**: "A simple database - like a smart filing cabinet that stores information and lets you search through it"
- **Jinja**: "A way to create HTML pages with variables - like a template where you can fill in the blanks"
- **Models**: "Blueprints that define what our data looks like (like defining what a 'sonnet' or 'user' contains)"

### Project Structure
Always start by explaining the folder structure and what each file does before diving into code.

## Current Session Guidelines
1. **Start where the student is**: Ask what they've tried or where they're stuck
2. **Explain the next small step**: What exactly are we building next?
3. **Show minimal code**: Give just enough to make progress
4. **Test immediately**: Get something working before adding more
5. **Connect to vision**: Explain how this small step fits the bigger picture

## Success Metrics for Each Phase
- **Phase 1**: Two people can successfully write a sonnet together using the app
- **Phase 2**: Multiple pairs can be using the app simultaneously with proper user accounts
- **Phase 3**: Users can explore the interconnected web of sonnets and see lineage

## Technical Specifications

### Data Models (Phase 1)
```python
# User: id, display_name, code (like "ALPHA", "BETA")
# Sonnet: id, created_at, status ("active" or "complete")
# Line: id, sonnet_id, line_number (1-14), text, author_user_id, created_at
# Turn: sonnet_id, next_user_id (who can add the next line)
```

### API Endpoints (Phase 1)
```python
# GET / → Render main page with current sonnet, whose turn, form, and history
# POST /lines → Submit new line (validates turn, adds line, advances turn)
```

### Turn Logic Rules
1. App starts with sonnet containing pre-filled line 1, next_user_id set to first user
2. On line submit: validate user == next_user_id, create new Line, increment line_number
3. If line_number == 14: mark sonnet complete, create new sonnet with line 1 = previous line 14
4. Otherwise: set next_user_id to the other user
5. Always redirect back to main page

### File Structure
```
psny-mayday/
├── app.py              # FastAPI server and routes
├── models.py           # Database models (User, Sonnet, Line)
├── database.py         # Database connection and setup
├── seed.py             # Initial data (users, first sonnet)
├── templates/
│   └── index.html      # Main page template
├── static/
│   └── styles.css      # Simple styling
└── requirements.txt    # Python packages needed
```

### Setup Instructions
```bash
# 1. Create project folder and virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install required packages
pip install fastapi uvicorn sqlmodel jinja2 python-multipart

# 3. Run the app
python seed.py    # Create initial data
uvicorn app:app --reload  # Start server at http://localhost:8000
```

### Implementation Order (Phase 1)
1. **models.py** - Define User, Sonnet, Line models
2. **database.py** - Set up SQLite connection
3. **seed.py** - Create two users and first sonnet
4. **app.py** - Basic FastAPI app with GET / route
5. **templates/index.html** - Simple page showing "Hello World"
6. **Test**: Get server running and page loading
7. **Expand app.py** - Add POST /lines route and turn logic
8. **Expand template** - Show sonnet, turn info, and form
9. **static/styles.css** - Make it look nice
10. **Test**: Two people taking turns in different browser tabs

## Vision Board

There is a **VISION_BOARD.md** file in the project root for capturing exciting future ideas and features beyond the MVP.

**When to use it:**
- When the student shares a "what if..." or breakthrough idea during development
- When discussing potential monetization or expansion concepts
- When imagining how Mayday could evolve beyond Phase 3
- Proactively suggest adding ideas to it when creative concepts emerge in conversation

The Vision Board keeps motivation high by connecting today's small coding steps to tomorrow's magical possibilities.

## Current Status: V1 Production + V2 Immersive Visualization Complete

### ✅ V1 Production System
Multi-user collaborative poetry platform with Crown of Sonnets system fully operational:
- User signup, pairing, and turn-based sonnet writing
- Crown automatically completes when 14th pair finishes
- Individual sonnet views, Crown overview page
- Manual Crown creation tool (`create_crown.py`) for multi-generational poetry

### ✅ V2 Immersive 3D Visualization
**The Crown Visualization** at `/crown/1/visualize` - A living, breathing poetic universe:

**JEWELS View** (Three.js WebGL orbital experience):
- **Golden seed star** at center with 4 orbiting word sprites and 8 pulsing light rays
- **14 breathing orbs** with varied geometric shapes based on lineage depth:
  - Depth 1: Icosahedrons (20-sided origin)
  - Depth 2-3: Dodecahedrons (12-sided balanced)
  - Depth 4+: Octahedrons (8-sided crystalline)
  - In-progress: Spheres (unfinished potential)
- **Material variation**: Frosted glass → Clear glass → Crystal based on completion status
- **Floating word sprites** (2-3 words from each poem) with gentle animation
- **Text overlays** reveal full first line on zoom/hover
- **Connection lines** with flowing light particles showing relationships
- **800 atmospheric particles** drifting through space
- **12 volumetric god rays** emanating from seed star
- **Breathing animations** on all orbs with emissive pulsing

**THREADS View**: Horizontal scrolling lineage timeline

**Interactive Features**:
- Drag to rotate, scroll to zoom, click orbs/seed to view poems
- Side panel with full sonnet text (bookend lines highlighted)
- Mobile-responsive with full-screen overlay
- All text dynamically pulls from database

**Development Environment**:
- `MAYDAY_VIZ_TEST=true/false` environment variable switches between test/production databases
- Test database with 14 complete sonnets in `visualization_dev/test_database.db`
- APIs: `/api/crown/{id}/nodes`, `/api/crown/{id}/stats`, `/api/sonnet/{id}/lines`

### 🎯 File Organization

**Production Files (V1):**
```
app.py              # Main FastAPI app (uses production DB)
database.py         # Production database connection
mayday.db           # Production database
models.py           # Database models
templates/          # Jinja templates
static/            # CSS, images, JS
create_crown.py    # Manual Crown creation for V2
```

**Visualization Files (V2):**
```
static/viz/                    # ES6 module architecture
├── main.js                    # Boot sequence
├── ExperienceDirector.js      # View orchestration & state management
├── services/                  # Data layer
│   ├── AppState.js            # Reactive state with pub/sub
│   └── CrownDataService.js    # API fetching
├── views/                     # View components
│   ├── OrreryView.js          # Three.js immersive 3D experience
│   │                          # (seed star, orbs, particles, god rays, animations)
│   ├── LineageTunnelView.js   # Timeline view
│   └── PoetStudioView.js      # Poem reader panel
└── utils/                     # Helpers
    ├── formatters.js
    └── metrics.js

visualization_dev/             # Isolated test environment
├── crown_viz.html
├── test_database.db           # 14 complete sonnets
├── generate_test_data.py
└── README.md                  # Test/prod switching guide

static/viz_styles.css          # Visualization styling
```

### 🔄 How to Switch Test/Production

**For Visualization Development:**
```bash
export MAYDAY_VIZ_TEST=true
uvicorn app:app --reload
# Main app uses production DB, visualization uses test DB
# Visit: http://localhost:8000/crown/1/visualize
```

**For Production:**
```bash
export MAYDAY_VIZ_TEST=false  # or unset
uvicorn app:app --reload
# Everything uses production DB
```

---

## Remember
This is as much about learning to code as it is about building the app. Prioritize understanding over speed. Every small step should feel achievable and connected to the magical bigger vision of fractal, interconnected poetry.