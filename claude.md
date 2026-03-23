# PSNY MAYDAY

Collaborative poetry platform for PSNY. Poets pair up, write sonnets between bookend lines from a seed poem. Each completed sonnet becomes a seed for new Crowns — infinite fractal growth.

**Live:** https://psny-mayday.onrender.com

## Stack

- **Backend**: FastAPI + SQLModel, Starlette 1.0+, PostgreSQL (Render) / SQLite (local)
- **Frontend**: Jinja2 templates, vanilla JS (ES6 modules), Canvas 2D (Cosmos viz)
- **Deploy**: Render auto-deploys from `main`. Config in `render.yaml`, build in `build.sh`

## Key Convention: TemplateResponse

Starlette 1.0+ API — `request` is the **first** arg, not in the context dict:
```python
templates.TemplateResponse(request, "template.html", {"key": value})
```

## Architecture

- `app.py` — Monolithic server (routes, business logic, API). Refactor planned in ISSUES_AND_ROADMAP.md
- `models.py` — SQLModel schema: User, Sonnet, Line, Turn, Crown, Pair, SourceSonnet, SourceLine
- `database.py` — DB connection. `seed.py` — Seeds Lady Mary Wroth's poem
- `templates/` — 14 Jinja2 templates. `static/viz/` — ES6 visualization modules

## Auth Model

No accounts. Pen name + 128-bit code per poem. Email optional (CRM only).

## Auto-Spawning

Sonnet completes → `spawn_source_sonnet_from_completed()` creates SourceSonnet → next signup triggers `try_pair_users()` → new Crown if needed. Abandoned pairs (12h timeout) cleaned up via `cleanup_stale_pairs()`.

## Pair Statuses

- **writing** — Active collaboration
- **complete** — Sonnet finished, spawned a SourceSonnet
- **orphaned** — One partner left, remaining poet can restart or leave
- **abandoned** — 12h timeout, slot freed for backfill

## Key Endpoints

| Route | Purpose |
|-------|---------|
| `POST /signup` | Create user, trigger pairing |
| `GET /poet?u=CODE` | Writing interface |
| `POST /lines` | Submit a line (turn-based) |
| `GET /crown/{id}/visualize` | Threads / Scroll / Cosmos views |
| `GET /cosmos` | Full-screen cosmos |
| `GET /api/crown/{id}/nodes` | Crown data API |
| `GET /api/crown/{id}/scroll` | Scroll view API |
| `GET /api/fractal/tree` | Full fractal tree API |
| `POST /admin/reset?key=SECRET` | Reset & reseed DB |

## Local Dev

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py
uvicorn app:app --reload
```

## Changing the Seed Poem

1. Update `seed.py` with new title and 14 lines
2. Update `app.py` — search for `"Lady Mary Wroth"` (4 occurrences) and replace

## Docs

- `ISSUES_AND_ROADMAP.md` — Known issues, planned features
- `VISION_BOARD.md` — Long-term ideas
- `TEST_PLAN.md` — Manual QA checklist
- `TESTING.md` — pytest guide for devs
