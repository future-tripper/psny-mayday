# Visualization Development Files

This directory contains all files needed for developing the interactive Crown visualization **without breaking the main v1 app**.

## Files in This Directory

### Core Development Files
- **`viz_database.py`** - Database configuration that switches between test/production data
- **`test_database.db`** - Complete test Crown with 13 sonnets and 26 users
- **`generate_test_data.py`** - Script to regenerate test database
- **`test_viz_api.py`** - Test script to verify API endpoints work

### Visualization Files (when built)
- **`crown_visualization.html`** - Interactive D3.js Crown visualization page
- **`crown_viz.js`** - D3.js code for rendering Crown nodes/connections
- **`viz_styles.css`** - CSS specific to visualization components

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