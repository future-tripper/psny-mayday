# Database Unification Plan

## Current State
- **Production DB** (`mayday.db`): Has 4 pairs in Crown 1, but missing fractal Crown fields
- **Test DB** (`visualization_dev/test_database.db`): Has full schema with fractal features
- **Code**: Splits between two databases using `MAYDAY_VIZ_TEST` environment variable

## Goal
One seamless system: Signup → Writing → Crown visualization (Jewels/Threads/Scroll with dropdown)

## Steps to Unify

### Step 1: Backup Current Production Data
```bash
cp mayday.db mayday_backup_$(date +%Y%m%d).db
```

### Step 2: Update Models (Add Missing Fields)
File: `models.py`
- Add `generation` and `parent_sonnet_id` to Crown model
- Add `source_type` and `parent_sonnet_id` to SourceSonnet model
- Add `spawned_source_sonnet_id` to Sonnet model

### Step 3: Create Fresh Database
```bash
# Delete old database
rm mayday.db

# Create new database with updated schema
python seed.py
```

### Step 4: Update seed.py
- Set Crown generation=1 (classic seed)
- Set SourceSonnet source_type="classic"
- Use Ted Berrigan's "Sonnet 1" as seed

### Step 5: Remove Test Database Logic
Files to update:
- `database.py`: Remove `get_viz_session`, keep only `get_session`
- `app.py`: Replace all `Depends(get_viz_session)` with `Depends(get_session)`
- Remove `MAYDAY_VIZ_TEST` environment variable checks

### Step 6: Update Visualization Route
- `/crown/{id}/visualize` should use production database (already does after Step 5)
- Keep dropdown, Jewels, Threads, Scroll integrated

### Step 7: Test Full Flow
1. Signup at `/signup`
2. Get paired with another user
3. Write lines at `/poet?u=CODE`
4. View Crown at `/crown/1/visualize`
5. All three views work (Jewels, Threads, Scroll)
6. Dropdown switches between Crowns

## Files to Modify
1. ✅ `models.py` - Add missing fields
2. ✅ `database.py` - Remove test database logic
3. ✅ `app.py` - Use single database everywhere
4. ✅ `seed.py` - Set generation=1, source_type="classic"
5. ✅ Delete `visualization_dev/test_database.db` (no longer needed)

## After Unification
- One database: `mayday.db`
- One session function: `get_session()`
- All routes work together seamlessly
- Fractal Crown features ready for future (but not blocking current use)
