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

## Current Status: V1 Complete + Visualization Exploration

### ✅ V1 Production System Complete

**Crown Completion System:**
- Crown automatically marks as "complete" when 14th pair finishes (corrected from 13)
- User completion page shows special celebration when entire Crown is done
- Crown page displays "Crown Complete: All 14 sonnets woven" when finished
- Waiting page blocks new pairs once Crown has 14 pairs

**Individual Sonnet Views:**
- `/sonnet/<id>` endpoint shows individual completed sonnets
- Displays both authors, all 14 lines, position in Crown
- Author names on Crown page link to individual sonnet views
- CSS styling for clickable links with hover states

**Crown Page Updates:**
- Updated copy: "Here lies the Crown woven from voices near and far..."
- Shows completion status dynamically
- Each sonnet has clickable author names linking to detail view

**Manual Crown Creation (V2 Prep):**
- `create_crown.py` script for spawning new Crowns from completed sonnets
- Commands: `python create_crown.py list` and `python create_crown.py from <sonnet_id>`
- Foundation for multi-generational Crown system

### 🧪 Visualization Exploration in Progress

**Safe Development Environment:**
- `visualization_dev/` directory contains all test/dev files
- Environment variable `MAYDAY_VIZ_TEST=true/false` switches data source
- Production v1 app never touches test database
- Visualization development never touches production database

**Test Data & APIs Built:**
- Complete test database with 14 finished sonnets (`visualization_dev/test_database.db`)
- API endpoints available:
  - `/api/crown/1/nodes` - Returns node/connection data
  - `/api/crown/1/stats` - Returns completion statistics
  - `/api/sonnet/{id}/lines` - Returns full sonnet lines for poetry revelation
- 28 test users with realistic pen names
- 196 lines of generated poetry for testing

**Current Visualization Experiments:**
- Interactive Crown circle with Sigma.js WebGL
- Poetry revelation with typewriter effects
- Atmospheric breathing nodes and flowing connection text
- Multiple view modes: Crown Circle, Seed Focus, Individual Sonnets

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

**Visualization Development Files:**
```
visualization_dev/
├── README.md              # Full instructions for switching test/production
├── viz_database.py        # Database config with environment switching
├── test_database.db       # Complete test Crown with 14 sonnets
├── generate_test_data.py  # Regenerate test database
└── test_viz_api.py        # Test API endpoints
```

### 🔄 How to Switch Test/Production

**For Visualization Development:**
```bash
export MAYDAY_VIZ_TEST=true
uvicorn app:app --reload
# Main app uses production DB, visualization uses test DB
```

**For Production:**
```bash
export MAYDAY_VIZ_TEST=false  # or unset
uvicorn app:app --reload
# Everything uses production DB
```

### 🎨 Visualization Exploration

We're actively exploring different approaches to visualize the Crown of Sonnets, including:

- Interactive Crown circle layouts using Sigma.js WebGL
- Poetry revelation interfaces with typewriter effects
- Multi-level view systems (Crown → Seed → Individual)
- Atmospheric and animated poetry presentations

**Test Environment:**
```bash
export MAYDAY_VIZ_TEST=true
uvicorn app:app --reload
# Visit: http://localhost:8000/crown/1/visualize
```

The visualization development is isolated from production and uses test data for experimentation.

---

## Remember
This is as much about learning to code as it is about building the app. Prioritize understanding over speed. Every small step should feel achievable and connected to the magical bigger vision of fractal, interconnected poetry.