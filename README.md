# PSNY MAYDAY - Fractal Poetry Ecosystem

A collaborative poetry platform for the Poetry Society of New York (PSNY) where poets create an infinite, self-perpetuating Crown of Sonnets.

**Live:** https://psny-mayday.onrender.com

## The Fractal System

1. **Users sign up** → Get paired with another poet → Receive 2 bookend lines from a seed sonnet
2. **Pairs write** → Alternate writing lines between bookends → Complete a 14-line sonnet
3. **Sonnets spawn** → Each completed sonnet becomes a seed for future Crowns
4. **Crowns complete** → New Crowns auto-create from the next available seed
5. **Pattern repeats infinitely** → Fractal tree of poetry grows organically

Crown 1 is seeded from Lady Mary Wroth's "In this strange labyrinth how shall I turn" (1621).

## Visualization

Visit `/crown/{id}/visualize` to explore three integrated views:

- **THREADS**: Horizontal scrolling cards with lineage timeline
- **SCROLL**: Vertical list of all sonnets with bookend lines highlighted
- **COSMOS**: Canvas star-field visualization of the fractal crown system

Standalone cosmos: `/cosmos`

## Quick Start

```bash
# Setup
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Seed database with Lady Mary Wroth's sonnet
python seed.py

# Run server
uvicorn app:app --reload
# Visit http://localhost:8000
```

## Tech Stack

- **Backend**: FastAPI + SQLModel
- **Database**: SQLite (local), PostgreSQL (production on Render)
- **Frontend**: Jinja2 templates + vanilla JavaScript (ES6 modules)
- **Visualization**: Canvas 2D (Cosmos), HTML/CSS (Threads, Scroll)
- **Deployment**: Render (auto-deploys from `main`)

## Testing

```bash
pytest                    # Run all tests
pytest tests/ -v          # Verbose output
```

See `TESTING.md` for the full testing guide and `TEST_PLAN.md` for the manual test checklist.

## Documentation

- `CLAUDE.md` — Full technical docs, DB schema, user journey, all endpoints
- `FEATURE_ROADMAP.md` — Known issues and planned features
- `VISION_BOARD.md` — Future ideas and expansion concepts

## Admin

Reset and reseed the database:
```bash
curl -X POST "https://psny-mayday.onrender.com/admin/reset?key=$ADMIN_SECRET"
```

Requires `ADMIN_SECRET` env var on Render. See `.env.example`.
