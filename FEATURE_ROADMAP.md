# Feature Roadmap: Abort/Reset, AI Pairing & Fractal Visualization

*Comprehensive implementation plan for the next development session*

---

## Overview

This document covers three interconnected features discussed for Mayday:

1. **Abort/Reset Flow** — Handle partner abandonment gracefully
2. **AI Pairing Option** — Write with Claude when no human partner is available
3. **Fractal Visualization** — New 2D zoomable view of the growing poetry ecosystem

These features are designed to work together and build on the existing architecture.

---

# Feature 1: Abort/Reset Flow

## Problem Statement

When a user's partner stops responding, the remaining user is stuck. We need a way for them to:
- Abort the current collaboration
- Preserve their slot (same bookend lines)
- Get re-paired with a new partner (or AI)

## Key Insight: Slot vs. Completion Order

The system already separates **structural position** from **completion timing**:

| Field | Purpose | Determines |
|-------|---------|------------|
| `source_line_start` | Slot position (1-14) | Which bookend lines, position in crown |
| `completion_order` | When they finished | Display effects only |

This means a late-finishing pair still slots into the correct crown position.

---

## Scenario 1: One User Aborts

**Goal:** Remaining user keeps their slot and gets a new partner.

### Implementation Steps

#### Step 1: Add "Orphaned" Status to Pair Model

**File:** `models.py`

```python
class Pair(SQLModel, table=True):
    # ... existing fields ...
    status: str = "writing"  # "writing" | "complete" | "orphaned" | "abandoned"
```

No schema migration needed — just use new status values.

#### Step 2: Create Abort Endpoint

**File:** `app.py`

```python
@app.post("/abort")
async def abort_collaboration(
    request: Request,
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.code == u)).first()
    if not user or not user.pair_id:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    # Determine who is aborting vs remaining
    aborting_user = user
    remaining_user_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
    remaining_user = session.exec(select(User).where(User.id == remaining_user_id)).first()

    # Mark pair as orphaned (slot preserved)
    pair.status = "orphaned"

    # Clear the aborting user's slot
    if pair.user_1_id == aborting_user.id:
        pair.user_1_id = remaining_user.id  # Remaining user becomes user_1
        pair.user_2_id = None  # Slot open for new partner
    else:
        pair.user_2_id = None  # Slot open for new partner

    # Reset aborting user
    aborting_user.status = "waiting"
    aborting_user.pair_id = None

    # Keep remaining user linked to the pair
    remaining_user.status = "waiting_for_partner"  # New status

    # Delete incomplete sonnet and lines, create fresh one
    sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
    if sonnet:
        # Delete existing lines
        session.exec(delete(Line).where(Line.sonnet_id == sonnet.id))
        # Delete turn
        session.exec(delete(Turn).where(Turn.sonnet_id == sonnet.id))
        # Delete sonnet
        session.delete(sonnet)

    session.add_all([pair, aborting_user, remaining_user])
    session.commit()

    # Redirect remaining user to options page
    return RedirectResponse(f"/reset-options?u={remaining_user.code}", status_code=303)
```

#### Step 3: Create Reset Options Page

**File:** `templates/reset_options.html`

```html
{% extends "base.html" %}
{% block content %}
<div class="reset-options">
    <h1>Your collaboration has been reset</h1>
    <p>Your partner has left. You can continue with the same starting lines.</p>

    <div class="options">
        <form action="/wait-for-partner" method="post">
            <input type="hidden" name="u" value="{{ user.code }}">
            <button type="submit">Wait for a new partner</button>
        </form>

        <form action="/pair-with-ai" method="post">
            <input type="hidden" name="u" value="{{ user.code }}">
            <button type="submit">Continue with AI</button>
        </form>
    </div>
</div>
{% endblock %}
```

#### Step 4: Update Pairing Logic to Fill Orphaned Pairs First

**File:** `app.py` — Modify `try_pair_users()`

```python
def try_pair_users(session: Session):
    waiting_users = session.exec(
        select(User).where(User.status == "waiting").order_by(User.id)
    ).all()

    if len(waiting_users) < 1:
        return None

    # PRIORITY 1: Fill orphaned pairs first
    orphaned_pair = session.exec(
        select(Pair).where(Pair.status == "orphaned").order_by(Pair.created_at)
    ).first()

    if orphaned_pair and len(waiting_users) >= 1:
        new_partner = waiting_users[0]

        # Fill the vacancy
        orphaned_pair.user_2_id = new_partner.id
        orphaned_pair.status = "writing"

        # Get the remaining user who was waiting
        remaining_user = session.exec(
            select(User).where(User.id == orphaned_pair.user_1_id)
        ).first()

        # Create fresh sonnet with same bookend lines
        # ... (recreate sonnet, lines 1 & 14, turn)

        return orphaned_pair

    # PRIORITY 2: Normal pairing (existing logic)
    if len(waiting_users) < 2:
        return None

    # ... rest of existing pairing logic ...
```

---

## Scenario 2: Both Users Abort

**Goal:** Slot becomes available for next pair of users (backfill).

### Implementation

#### Update Abort Logic for Complete Abandonment

```python
# In abort endpoint, if remaining user ALSO chooses to leave:
@app.post("/abandon-completely")
async def abandon_completely(u: str = Form(...), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.code == u)).first()
    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()

    # Mark pair as fully abandoned
    pair.status = "abandoned"

    # Clean up sonnet/lines/turn
    # ... same cleanup as above ...

    # Reset user
    user.status = "waiting"
    user.pair_id = None

    session.commit()
```

#### Update Slot Detection to Exclude Abandoned Pairs

**File:** `app.py` — In `try_pair_users()`

```python
# Change this:
existing_pairs = session.exec(
    select(Pair).where(Pair.crown_id == crown.id)
).all()

# To this:
existing_pairs = session.exec(
    select(Pair)
    .where(Pair.crown_id == crown.id)
    .where(Pair.status.not_in(["abandoned"]))  # Exclude abandoned
).all()
```

Abandoned slots naturally become available for the next pair.

---

## Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| What happens to aborting user? | A) Back to waiting queue B) Removed from system | A — they may want to try again |
| Track abandonment history? | A) Delete pair B) Keep with "abandoned" status | B — useful for analytics |
| Time limit before auto-abandon? | A) None B) 24h C) 48h D) 1 week | Start with none, add later if needed |
| Notify remaining user? | A) Email B) In-app only C) Both | Start with B, add email later |

---

# Feature 2: AI Pairing Option

## Problem Statement

Users waiting for partners may get impatient. Offer them the option to collaborate with Claude instead.

## Entry Points

1. **New user in waiting screen** — "Write with AI instead" button
2. **User after abort/reset** — Option alongside "wait for partner"

---

## Implementation Steps

### Step 1: Create Virtual AI User

**File:** `seed.py` — Add to seeding logic

```python
def seed_ai_user(session: Session):
    """Create the virtual AI user for AI-pairing feature."""
    existing = session.exec(
        select(User).where(User.email == "claude@anthropic.com")
    ).first()

    if not existing:
        ai_user = User(
            email="claude@anthropic.com",
            pen_name="Claude",
            code="AI_PARTNER_SYSTEM",
            status="ai"  # Special status, never goes to "waiting"
        )
        session.add(ai_user)
        session.commit()
        print("✨ Created AI partner user")
```

### Step 2: Create AI Pairing Endpoint

**File:** `app.py`

```python
AI_USER_CODE = "AI_PARTNER_SYSTEM"

@app.post("/pair-with-ai")
async def pair_with_ai(
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    ai_user = session.exec(
        select(User).where(User.code == AI_USER_CODE)
    ).first()

    if not ai_user:
        # Create AI user if missing
        ai_user = User(
            email="claude@anthropic.com",
            pen_name="Claude",
            code=AI_USER_CODE,
            status="ai"
        )
        session.add(ai_user)
        session.commit()
        session.refresh(ai_user)

    # Check if user has an orphaned pair (from abort flow)
    orphaned_pair = session.exec(
        select(Pair)
        .where(Pair.user_1_id == user.id)
        .where(Pair.status == "orphaned")
    ).first()

    if orphaned_pair:
        # Fill with AI partner
        orphaned_pair.user_2_id = ai_user.id
        orphaned_pair.status = "writing"

        # Recreate sonnet with same slot
        # ... create sonnet, bookend lines, turn ...

        pair = orphaned_pair
    else:
        # Create new pair with AI (normal slot assignment)
        # ... use existing try_pair_users logic but with AI as user_2 ...
        pair = create_pair_with_ai(user, ai_user, session)

    user.status = "paired"
    user.pair_id = pair.id
    session.add(user)
    session.commit()

    return RedirectResponse(f"/poet?u={u}", status_code=303)
```

### Step 3: AI Line Generation

**File:** `app.py` or new file `ai_partner.py`

```python
import anthropic
import os

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def generate_ai_line(sonnet_id: int, session: Session) -> str:
    """Generate the next line of the sonnet using Claude."""

    # Get current sonnet state
    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet_id)
        .order_by(Line.line_number)
    ).all()

    lines_text = "\n".join([f"Line {l.line_number}: {l.text}" for l in lines])

    # Find next line number
    existing_numbers = {l.line_number for l in lines}
    next_line = 2
    for i in range(2, 14):
        if i not in existing_numbers:
            next_line = i
            break

    prompt = f"""You are collaborating on a sonnet with a human poet. You are writing together, alternating lines.

The sonnet's structure:
- Line 1 (given, sets the opening): {lines[0].text if lines else ""}
- Line 14 (given, sets the conclusion): {next(l.text for l in lines if l.line_number == 14) if any(l.line_number == 14 for l in lines) else ""}

Lines written so far:
{lines_text}

Write line {next_line} of 14.

Guidelines:
- Continue the imagery, tone, and rhythm established
- Aim for roughly 10 syllables (iambic pentameter feel)
- Build toward the concluding line
- Be creative but cohesive with what's been written

Respond with ONLY the line itself, no explanation or line number."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text.strip()
```

### Step 4: Integrate AI Response into Line Submission

**File:** `app.py` — Modify `add_line()` endpoint

```python
@app.post("/lines")
async def add_line(
    request: Request,
    u: str = Form(...),
    text: str = Form(...),
    session: Session = Depends(get_session)
):
    # ... existing validation ...

    # Add human's line
    new_line = Line(
        sonnet_id=sonnet.id,
        line_number=next_line_number,
        text=text.strip(),
        author_user_id=user.id
    )
    session.add(new_line)

    # Check if partner is AI
    ai_user = session.exec(
        select(User).where(User.code == AI_USER_CODE)
    ).first()

    partner_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
    is_ai_partner = (partner_id == ai_user.id) if ai_user else False

    if next_line_number == 13:
        # Sonnet complete — existing completion logic
        # ...
    elif is_ai_partner:
        # AI partner — generate response immediately
        session.commit()  # Save human's line first

        ai_line_text = await generate_ai_line(sonnet.id, session)
        ai_next_line = next_line_number + 1

        if ai_next_line < 14:  # Don't overwrite the bookend
            ai_line = Line(
                sonnet_id=sonnet.id,
                line_number=ai_next_line,
                text=ai_line_text,
                author_user_id=ai_user.id
            )
            session.add(ai_line)
            session.commit()

        # Check if AI's line completed the sonnet (line 13)
        if ai_next_line == 13:
            # ... completion logic ...
    else:
        # Human partner — flip turn as usual
        turn.next_user_id = partner_id
        session.add(turn)
        session.commit()

    return RedirectResponse(f"/poet?u={u}", status_code=303)
```

### Step 5: Update Attribution Display

**File:** `app.py` — Where authors are displayed

```python
def get_pair_authors(pair: Pair, session: Session) -> str:
    user_1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
    user_2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()

    if user_2 and user_2.status == "ai":
        return f"{user_1.pen_name} + Claude"
    elif user_1 and user_2:
        return f"{user_1.pen_name} & {user_2.pen_name}"
    else:
        return "Unknown"
```

### Step 6: Update Waiting Page UI

**File:** `templates/waiting.html`

```html
{% extends "base.html" %}
{% block content %}
<div class="waiting-room">
    <h1>Waiting for a partner...</h1>
    <p>You'll be paired with another poet soon.</p>

    <div class="ai-option">
        <p>Don't want to wait?</p>
        <form action="/pair-with-ai" method="post">
            <input type="hidden" name="u" value="{{ user.code }}">
            <button type="submit" class="ai-button">Write with Claude instead</button>
        </form>
    </div>
</div>
{% endblock %}
```

---

## Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| AI model to use | A) claude-sonnet-4-20250514 B) claude-haiku C) claude-opus | A — good balance of quality/speed |
| AI attribution name | A) "Claude" B) "AI Muse" C) Custom per session | A — clear and honest |
| Can AI sonnets become seeds? | A) Yes B) No | A — they're still valid poems |
| Rate limiting | A) None B) 1/sec C) Add delay for pacing | B or C for UX pacing |
| Prompt customization | A) Fixed prompt B) User can set tone | A first, B later |

---

## Environment Setup Required

```bash
# Add to .env or environment
ANTHROPIC_API_KEY=sk-ant-...
```

**File:** `requirements.txt` — Add:
```
anthropic>=0.18.0
```

---

# Feature 3: Fractal Visualization (Hybrid Galaxy + Circle Packing)

## Vision

A 2D zoomable visualization where users can:
- See the entire poetry ecosystem at a glance
- Zoom into individual crowns
- Click through to read sonnets
- Understand lineage and connections

## The Hybrid Approach

### Zoom Level 1: Galaxy View (Zoomed Out)

```
    ● ─── ● ─── ●          Each ● = one Crown
     \   / \   /           Lines = parent→child lineage
      ● ─── ●              Color = generation depth
       \   /
        ●   ← Original seed crown
```

- Each crown appears as a **single dot** or **small cluster**
- Lines connect parent sonnets to their child crowns
- Color gradient shows generation (warm→cool)
- Pan and zoom across the entire "galaxy"

### Zoom Level 2: Crown View (Zoomed In)

```
      ○   ○   ○
    ○           ○
   ○      ●      ○    ← 14 sonnets in a ring
    ○           ○       Center = seed sonnet
      ○   ○   ○
```

- When zoomed into a crown, it expands to show 14 sonnets
- Arranged in a circle (honoring the crown structure)
- Center shows the seed that started this crown
- Sonnets that spawned children have a glow/indicator

### Zoom Level 3: Sonnet View (Panel)

```
┌─────────────────────────────────┐
│ "The wind gives presence..."    │
│ Authors: Jane + Claude          │
│ Completed: Dec 15, 2024         │
│ Position: 3rd in Crown          │
│ Spawned: Crown #47              │
│                                 │
│ [Full Poem]                     │
│ Line 1: The wind gives...       │
│ Line 2: ...                     │
│ ...                             │
│ Line 14: ...                    │
│                                 │
│ [View Child Crown]              │
│ [View Parent Lineage]           │
└─────────────────────────────────┘
```

- Click any sonnet node to open detail panel
- Shows full text, authors, lineage links
- Can navigate to child crown or parent crown

---

## Implementation Steps

### Step 1: Choose a Library

**Recommended: D3.js + Canvas**

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **D3.js** | Powerful, flexible, great zoom/pan | Learning curve | ✅ Best for custom viz |
| Cytoscape.js | Easy graph layouts | Less flexible styling | Good for quick prototype |
| vis.js | Simple API | Limited customization | Backup option |
| Three.js (current) | 3D capabilities | Overkill for 2D, struggling | Replace with D3 |

### Step 2: Create New Visualization Files

**Directory structure:**
```
static/viz/
├── fractal/
│   ├── FractalView.js        # Main visualization class
│   ├── GalaxyRenderer.js     # Zoomed-out crown view
│   ├── CrownRenderer.js      # Zoomed-in sonnet ring
│   ├── SonnetPanel.js        # Detail panel component
│   └── fractal.css           # Styles
```

### Step 3: Data API Endpoint

**File:** `app.py`

```python
@app.get("/api/fractal/tree")
async def get_fractal_tree(session: Session = Depends(get_session)):
    """Return the complete crown/sonnet tree for visualization."""

    crowns = session.exec(select(Crown).order_by(Crown.generation)).all()

    nodes = []
    edges = []

    for crown in crowns:
        # Crown node
        crown_node = {
            "id": f"crown-{crown.id}",
            "type": "crown",
            "generation": crown.generation,
            "status": crown.status,
            "source_sonnet_id": crown.source_sonnet_id,
            "parent_sonnet_id": crown.parent_sonnet_id,
        }

        # Get sonnets in this crown
        pairs = session.exec(
            select(Pair).where(Pair.crown_id == crown.id)
        ).all()

        sonnets = []
        for pair in pairs:
            sonnet = session.exec(
                select(Sonnet).where(Sonnet.id == pair.sonnet_id)
            ).first()

            if sonnet:
                sonnets.append({
                    "id": sonnet.id,
                    "position": pair.source_line_start,
                    "status": sonnet.status,
                    "spawned_crown": sonnet.spawned_source_sonnet_id is not None,
                    "completion_order": pair.completion_order
                })

        crown_node["sonnets"] = sonnets
        crown_node["completion"] = f"{len([s for s in sonnets if s['status'] == 'complete'])}/14"
        nodes.append(crown_node)

        # Edge from parent sonnet to this crown
        if crown.parent_sonnet_id:
            edges.append({
                "from": f"sonnet-{crown.parent_sonnet_id}",
                "to": f"crown-{crown.id}"
            })

    return {"nodes": nodes, "edges": edges}
```

### Step 4: Main Visualization Class

**File:** `static/viz/fractal/FractalView.js`

```javascript
class FractalView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.data = null;
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.selectedNode = null;

        this.setupCanvas();
        this.setupInteractions();
    }

    async load() {
        const response = await fetch('/api/fractal/tree');
        this.data = await response.json();
        this.layoutNodes();
        this.render();
    }

    layoutNodes() {
        // Force-directed or hierarchical layout
        // Position crowns based on generation (rings or tree)
        const nodes = this.data.nodes;
        const generations = {};

        nodes.forEach(node => {
            const gen = node.generation;
            if (!generations[gen]) generations[gen] = [];
            generations[gen].push(node);
        });

        // Radial layout: center = gen 1, expand outward
        Object.entries(generations).forEach(([gen, genNodes]) => {
            const radius = parseInt(gen) * 200;
            const angleStep = (2 * Math.PI) / genNodes.length;

            genNodes.forEach((node, i) => {
                node.x = Math.cos(i * angleStep) * radius;
                node.y = Math.sin(i * angleStep) * radius;
            });
        });
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.canvas.width / 2 + this.pan.x, this.canvas.height / 2 + this.pan.y);
        ctx.scale(this.zoom, this.zoom);

        // Draw edges
        this.data.edges.forEach(edge => {
            this.drawEdge(edge);
        });

        // Draw nodes
        this.data.nodes.forEach(node => {
            this.drawCrown(node);
        });

        ctx.restore();
    }

    drawCrown(crown) {
        const ctx = this.ctx;
        const { x, y, generation, status } = crown;

        // Color by generation
        const hue = 200 - (generation * 30); // Blue → warm
        const color = `hsl(${hue}, 70%, 50%)`;

        if (this.zoom < 2) {
            // Galaxy view: single dot per crown
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Glow for complete crowns
            if (status === 'complete') {
                ctx.shadowColor = color;
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        } else {
            // Crown view: show 14 sonnets in a ring
            this.drawCrownDetail(crown, x, y);
        }
    }

    drawCrownDetail(crown, cx, cy) {
        const ctx = this.ctx;
        const sonnets = crown.sonnets || [];
        const radius = 50;

        sonnets.forEach((sonnet, i) => {
            const angle = (i / 14) * Math.PI * 2 - Math.PI / 2;
            const sx = cx + Math.cos(angle) * radius;
            const sy = cy + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.fillStyle = sonnet.status === 'complete' ? '#4CAF50' : '#FFC107';
            ctx.fill();

            // Indicator for sonnets that spawned children
            if (sonnet.spawned_crown) {
                ctx.strokeStyle = '#FF5722';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    setupInteractions() {
        // Zoom with mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));
            this.render();
        });

        // Pan with drag
        let dragging = false;
        let lastPos = { x: 0, y: 0 };

        this.canvas.addEventListener('mousedown', (e) => {
            dragging = true;
            lastPos = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (dragging) {
                this.pan.x += e.clientX - lastPos.x;
                this.pan.y += e.clientY - lastPos.y;
                lastPos = { x: e.clientX, y: e.clientY };
                this.render();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            dragging = false;
        });

        // Click to select
        this.canvas.addEventListener('click', (e) => {
            const node = this.getNodeAtPosition(e.offsetX, e.offsetY);
            if (node) {
                this.showSonnetPanel(node);
            }
        });
    }

    showSonnetPanel(node) {
        // Show detail panel for clicked sonnet/crown
        // ... implementation ...
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const viz = new FractalView('fractal-container');
    viz.load();
});
```

### Step 5: Create Visualization Page

**File:** `templates/fractal.html`

```html
{% extends "base.html" %}
{% block content %}
<div id="fractal-container" class="fractal-view"></div>

<div id="sonnet-panel" class="sonnet-panel hidden">
    <button class="close-panel">&times;</button>
    <div id="panel-content"></div>
</div>

<div class="controls">
    <button id="zoom-in">+</button>
    <button id="zoom-out">-</button>
    <button id="reset-view">Reset</button>
</div>

<script src="/static/viz/fractal/FractalView.js"></script>
{% endblock %}
```

### Step 6: Add Route

**File:** `app.py`

```python
@app.get("/fractal")
async def fractal_view(request: Request, session: Session = Depends(get_session)):
    return templates.TemplateResponse("fractal.html", {"request": request})
```

---

## Visual Design Guidelines

### Color Palette

| Element | Color | Meaning |
|---------|-------|---------|
| Gen 1 crowns | Deep blue (#1a237e) | Original, foundational |
| Gen 2 crowns | Purple (#7b1fa2) | First generation |
| Gen 3+ crowns | Warm gradient → orange | Newer generations |
| Complete sonnets | Green (#4CAF50) | Finished |
| In-progress sonnets | Amber (#FFC107) | Being written |
| Spawned indicator | Orange ring (#FF5722) | Has children |
| Edges | Faint gray | Lineage connections |

### Interaction Feedback

- **Hover**: Highlight node, show tooltip with crown/sonnet info
- **Click**: Open detail panel
- **Drag**: Pan the view
- **Scroll**: Zoom in/out
- **Double-click crown**: Zoom to fit that crown

---

## Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Layout algorithm | A) Radial (gen = ring) B) Force-directed C) Tree | A for clarity, B for organic feel |
| Canvas vs SVG | A) Canvas B) SVG | A for performance with many nodes |
| Mobile support | A) Touch gestures B) Desktop only first | B first, add A later |
| Animation | A) Smooth transitions B) Instant | A for polish |
| Replace or coexist | A) Replace current views B) Add as option | B — keep existing as fallbacks |

---

## Performance Considerations

| Scale | Nodes | Approach |
|-------|-------|----------|
| Gen 1-2 | ~15 crowns | Direct rendering |
| Gen 3-4 | ~200 crowns | Clustering at zoom out |
| Gen 5+ | 2000+ crowns | Level-of-detail, only render visible |

For MVP, assume Gen 1-3 (under 200 crowns). Add optimization later.

---

# Implementation Order

## Phase 1: Abort/Reset Flow (Estimated: 1 session)

1. [ ] Add status values to Pair model
2. [ ] Create `/abort` endpoint
3. [ ] Create reset options page
4. [ ] Update `try_pair_users()` to prioritize orphaned pairs
5. [ ] Test: one user aborts → other gets same slot with new partner

## Phase 2: AI Pairing (Estimated: 1-2 sessions)

1. [ ] Create virtual AI user in seed.py
2. [ ] Create `/pair-with-ai` endpoint
3. [ ] Implement `generate_ai_line()` function
4. [ ] Integrate AI response into `/lines` endpoint
5. [ ] Update waiting page UI
6. [ ] Update attribution display
7. [ ] Test: user pairs with AI → writes full sonnet

## Phase 3: Fractal Visualization (Estimated: 2-3 sessions)

1. [ ] Create `/api/fractal/tree` endpoint
2. [ ] Set up D3/Canvas structure
3. [ ] Implement galaxy view (zoomed out)
4. [ ] Implement crown view (zoomed in)
5. [ ] Add zoom/pan interactions
6. [ ] Add click → sonnet panel
7. [ ] Style and polish
8. [ ] Test with multi-generation data

---

# Testing Checklist

## Abort/Reset Flow
- [ ] One user aborts → partner gets options page
- [ ] Partner waits → gets new human partner in same slot
- [ ] Partner chooses AI → pairs with AI in same slot
- [ ] Both abort → slot available for new pair
- [ ] Orphaned slots get filled before new slots

## AI Pairing
- [ ] New user can choose AI from waiting screen
- [ ] AI generates appropriate lines
- [ ] Turn alternates correctly
- [ ] Sonnet completes and spawns seed
- [ ] Attribution shows "Name + Claude"

## Fractal Visualization
- [ ] All crowns visible in galaxy view
- [ ] Zoom in shows 14 sonnets per crown
- [ ] Click opens sonnet detail
- [ ] Edges show correct lineage
- [ ] Colors indicate generation depth
- [ ] Pan and zoom work smoothly

---

*Document created: Session planning for abort/reset, AI pairing, and fractal visualization features*
