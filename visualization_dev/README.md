# Visualization Development Files

This directory contains all files needed for developing the interactive Crown visualization **without breaking the main v1 app**.

## Files in This Directory

### Core Development Files
- **`viz_database.py`** - Database configuration that switches between test/production data
- **`test_database.db`** - Complete test Crown with 13 sonnets and 26 users
- **`generate_test_data.py`** - Script to regenerate test database
- **`test_viz_api.py`** - Test script to verify API endpoints work

### Visualization Files (when built)
- **`crown_viz.html`** – Entry HTML served for the experimental visualization
- **`static/viz/`** – Modular JavaScript bundle (data services, state, legacy orbit renderer)
- **`viz_styles.css`** – CSS specific to visualization components

## How to Switch Between Test and Production Data

### For Visualization Development (Use Test Data)
```bash
# Set environment variable to use test database
export MAYDAY_VIZ_TEST=true
uvicorn app:app --reload
```

**What happens:**
- Main app (signup, writing, completion) uses production `mayday.db`
- Visualization endpoints (`/api/crown/*/nodes`, `/api/crown/*/stats`) use `test_database.db`
- You get 13 completed sonnets to work with for visualization

### For Production (Use Real Data)
```bash
# Unset or set to false
export MAYDAY_VIZ_TEST=false
# OR simply:
uvicorn app:app --reload
```

**What happens:**
- Everything uses production `mayday.db`
- Visualization shows real Crown data (may be empty during testing)

## Development Workflow

1. **Start with test data**: `export MAYDAY_VIZ_TEST=true`
2. **Build visualization** using `/api/crown/1/nodes` and `/api/crown/1/stats`
3. **Test with rich data** (13 sonnets, connections, authors)
4. **When ready**: `export MAYDAY_VIZ_TEST=false` to use production
5. **Deploy** with visualization pointing to real Crown data

## Immersive Crown Visualization Roadmap

### Experience North Star
- Transform the static crown into an "Orrery" of poetry: a living 3D stage where the seed sonnet glows at the core, finished sonnets orbit on translucent rings, and shared lines arc between them as lumen trails that pulse to the cadence of the inherited verse.
- Layer three signature modes:
  - **Overview Orbit** – panoramic crown view with timeline scrub and ambient narration.
  - **Lineage Tunnel** – guided dive through a line's generational branches highlighting lineage depth.
  - **Poet Studio** – intimate focus scene blending the full sonnet, annotations, and optional audio commentary.
- Maintain complete isolation from the production (v1) stack by confining all experimental assets, bundlers, and data adapters to `visualization_dev/`.

### Phased Build Plan
1. **Foundation & Data Layer** – Modularize data fetching, support crown selection, cache sonnet metadata, and enrich APIs with lineage depth, completion timing, and thematic tags without touching production tables.
2. **Experience Architecture** – Introduce a dedicated visualization front-end bundle (e.g., Vite + modular components) that coexists alongside the FastAPI app, integrate Three.js (or similar) for the orrery, and define an event bus so view modes, audio, and overlays stay synchronized.
3. **Signature Interactions** – Implement the three hero modes with smooth transitions, deep-linking, story cards, and responsive layouts that translate gracefully to mobile.
4. **Sensory Layering** – Add Web Audio-driven generative soundscapes, optional narrated snippets, reduced-motion fallbacks, and haptic/visual alternates for accessibility.
5. **Polish & Ops** – Performance profiling, GPU/CPU fallbacks, automated visual regression snapshots, curator authoring tools for spotlight stories, and full contributor documentation.

### Success Metrics (measure during each iteration)
- **Immersion & Interaction**
  - ≥70% of users trigger at least one mode transition (Orbit ↔ Tunnel ↔ Studio) during usability tests.
  - Average session dwell time on the visualization exceeds 3 minutes with at least two story-card interactions.
- **Performance & Reliability**
  - Maintain ≥55 FPS on mid-tier laptops (integrated graphics) in Orbit mode; degrade gracefully with level-of-detail fallbacks on low-end hardware.
  - Initial load bundle under 3.5 MB (gzipped) with lazy loading for heavy 3D/audio modules.
- **Accessibility & Inclusivity**
  - 100% keyboard navigable and screen-reader describable paths for all core actions.
  - Provide opt-in audio with captions/transcripts and a reduced-motion setting that keeps the experience compelling.
- **Operational Safety**
  - No writes or schema changes bleed into production databases when `MAYDAY_VIZ_TEST=true`.
  - Automated checks confirm visualization assets remain within `visualization_dev/` and `static/` namespaced files.

## Regenerating Test Data

```bash
cd visualization_dev
python generate_test_data.py
```

This creates a fresh `test_database.db` with:
- 1 complete Crown (13 sonnets)
- 26 test users with creative pen names
- Generated poetry lines between source lines
- Full connection/lineage data

## Testing API Endpoints

```bash
# Start server with test data
export MAYDAY_VIZ_TEST=true
uvicorn app:app --reload

# In another terminal:
cd visualization_dev
python test_viz_api.py
```

Should show:
- ✅ 13 nodes returned
- ✅ 12 connections
- ✅ 100% completion

## Safety Features

- ✅ Main v1 app never touches test database
- ✅ Visualization development never touches production database
- ✅ Easy switch between test/production with environment variable
- ✅ All visualization files isolated in this directory

## Current Immersive Build Snapshot

- **Orbit Orrery** – Three.js starfield with interactive sonnet planets, ambient rotation, and hover/click cues.
- **Lineage Tunnel** – Scrollable completion timeline highlighting authors, first and last lines, and keyboard-accessible navigation.
- **Poet Studio** – Typewriter reveal of full sonnets with meta context, deep linking to `/sonnet/<id>`, and interaction metrics surfaced via `window.__maydayVizMetrics`.
- **Metrics instrumentation** tracks view switching, node selections, and lines revealed so usability goals can be measured during testing.
