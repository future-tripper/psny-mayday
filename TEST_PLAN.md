# Mayday Manual Test Plan

A step-by-step checklist for testing the complete Mayday flow before launch.

---

## Prerequisites

Before testing, reset the database to start fresh:

```bash
# Local
rm mayday.db
python seed.py

# Production (Render)
# 1. Truncate all tables via SQL or delete/recreate database
# 2. Run: python seed.py
```

---

## Test 1: First Pair Signup and Sonnet Completion

### 1.1 User Signup (Poet A)

- [ ] Navigate to `/signup`
- [ ] Enter pen name (e.g., "Alice")
- [ ] Optionally enter email
- [ ] Submit → See "Your Secret Code" page
- [ ] **Verify:** Code is displayed (22-character string)
- [ ] **Verify:** "Continue" button present
- [ ] Click Continue → See waiting room
- [ ] **Verify:** Waiting message displayed

### 1.2 Second User Signup (Poet B)

- [ ] Open new browser/incognito window
- [ ] Navigate to `/signup`
- [ ] Enter pen name (e.g., "Bob")
- [ ] Submit → Get code → Continue
- [ ] **Verify:** Both users now see writing interface (not waiting room)

### 1.3 Writing Interface Check

- [ ] **Verify:** Line 1 shows: "In this strange labyrinth, how shall I turn?"
- [ ] **Verify:** Line 14 shows: "Paths lie on every side, yet still I stray."
- [ ] **Verify:** Lines 2-13 are empty input areas
- [ ] **Verify:** One user sees "Your turn" indicator
- [ ] **Verify:** Other user sees "Waiting for partner" indicator
- [ ] **Verify:** Partner's pen name is displayed
- [ ] **Verify:** Progress indicator shows "0/12 lines written"

### 1.4 Turn-Based Writing

- [ ] Active user submits line 2
- [ ] **Verify:** Page refreshes, line 2 now visible
- [ ] **Verify:** Turn switches to other user
- [ ] **Verify:** Progress shows "1/12 lines written"
- [ ] Continue alternating until line 13 is submitted

### 1.5 Sonnet Completion

After line 13 is submitted:

- [ ] **Verify:** Redirected to `/complete` page
- [ ] **Verify:** Celebration message displayed
- [ ] **Verify:** Partner's name shown
- [ ] **Verify:** Link to view the completed sonnet

### 1.6 Database Verification (After First Sonnet)

Check these in the database or via API:

```bash
# API check
curl http://localhost:8000/api/crown/1/stats
```

- [ ] **Verify:** Sonnet status = "complete"
- [ ] **Verify:** Pair status = "complete"
- [ ] **Verify:** Pair.completion_order = 1
- [ ] **Verify:** Crown status still = "forming" (need 13 more)
- [ ] **Verify:** New SourceSonnet created (id=2, source_type="collaborative")
- [ ] **Verify:** SourceSonnet.parent_sonnet_id points to completed sonnet
- [ ] **Verify:** Sonnet.spawned_source_sonnet_id points to new SourceSonnet
- [ ] **Verify:** 14 SourceLines exist for new SourceSonnet

### 1.7 Visualization Check (After First Sonnet)

- [ ] Navigate to `/crown/1/visualize`
- [ ] **THREADS view:** One sonnet card visible with authors "Alice & Bob"
- [ ] **SCROLL view:** One sonnet with all 14 lines, bookends highlighted
- [ ] **COSMOS view:** Crown ring with one lit star (position 1)
- [ ] Click on sonnet → Opens poem reader with full text

### 1.8 Contributors Page

- [ ] Navigate to `/contributors`
- [ ] **Verify:** "Alice" listed with 1 sonnet
- [ ] **Verify:** "Bob" listed with 1 sonnet
- [ ] **Verify:** Each shows partner name and link to sonnet

### 1.9 Individual Sonnet Page

- [ ] Navigate to `/sonnet/1`
- [ ] **Verify:** All 14 lines displayed
- [ ] **Verify:** Authors shown: "Alice & Bob"
- [ ] **Verify:** Crown info shown (Crown I, position 1)
- [ ] **Verify:** Source lines info (lines 1-2 from seed)

---

## Test 2: Complete Crown (All 14 Pairs)

### 2.1 Sign Up Remaining 26 Users

Repeat signup and completion for pairs 2-14:

| Pair | Poets | Seed Lines | Expected Bookends |
|------|-------|------------|-------------------|
| 2 | C & D | 2-3 | "Paths lie on every side..." / "If to the right..." |
| 3 | E & F | 3-4 | "If to the right..." / "If I go forward..." |
| 4 | G & H | 4-5 | "If I go forward..." / "If to the left..." |
| 5 | I & J | 5-6 | "If to the left..." / "If I turn back..." |
| 6 | K & L | 6-7 | "If I turn back..." / "I dare not faint..." |
| 7 | M & N | 7-8 | "I dare not faint..." / "To stand still..." |
| 8 | O & P | 8-9 | "To stand still..." / "So let me take..." |
| 9 | Q & R | 9-10 | "So let me take..." / "Go forward, stand..." |
| 10 | S & T | 10-11 | "Go forward, stand..." / "These doubts I must..." |
| 11 | U & V | 11-12 | "These doubts I must..." / "With no relief..." |
| 12 | W & X | 12-13 | "With no relief..." / "Yet what most stirs..." |
| 13 | Y & Z | 13-14 | "Yet what most stirs..." / "Is leaving all..." |
| 14 | AA & BB | 14-1 | "Is leaving all..." / "In this strange labyrinth..." |

### 2.2 Verify Each Completion

For each pair completion, verify:

- [ ] Sonnet appears in all three visualization views
- [ ] Completion order increments correctly (1, 2, 3... 14)
- [ ] SourceSonnet spawned for each
- [ ] Contributors page updates with new authors

### 2.3 Crown Completion (After Pair 14)

When the 14th pair completes:

- [ ] **Verify:** Crown status changes to "complete"
- [ ] **Verify:** Completion celebration may mention "Crown complete!"

```bash
curl http://localhost:8000/api/crown/1/stats
# Should show: {"completed_pairs": 14, "is_complete": true}
```

### 2.4 Full Crown Visualization

- [ ] **THREADS:** All 14 sonnet cards visible, scrollable
- [ ] **SCROLL:** All 14 sonnets with full text
- [ ] **COSMOS:** Complete ring of 14 stars, all lit
- [ ] **COSMOS:** Connections visible between adjacent sonnets
- [ ] **COSMOS:** Crown label shows "Crown I" and "Complete"

### 2.5 Verify 14 SourceSonnets Created

```bash
curl http://localhost:8000/api/fractal/tree
```

- [ ] **Verify:** 14 SourceSonnets exist (IDs 2-15)
- [ ] **Verify:** Each has source_type = "collaborative"
- [ ] **Verify:** Each has correct parent_sonnet_id

---

## Test 3: Second Crown (Generation 2)

### 3.1 Trigger Crown 2 Creation

- [ ] Sign up 2 new users (CC & DD)
- [ ] **Verify:** They are paired successfully
- [ ] **Verify:** Writing interface shows NEW bookend lines (from a completed Crown 1 sonnet)

### 3.2 Verify Crown 2 Properties

```bash
curl http://localhost:8000/api/crown/2/context
```

- [ ] **Verify:** Crown 2 exists with generation = 2
- [ ] **Verify:** Crown 2 source_sonnet_id points to one of the spawned SourceSonnets
- [ ] **Verify:** Crown 2 parent_sonnet_id links to the original completed Sonnet
- [ ] **Verify:** Bookend lines match the parent sonnet's lines 1 & 2

### 3.3 Crown Dropdown

- [ ] Navigate to `/crown/1/visualize`
- [ ] **Verify:** Dropdown shows "Crown I" and "Crown II"
- [ ] Select Crown II → View updates
- [ ] **Verify:** Crown II visualization shows 1 forming pair

### 3.4 Cosmos Multi-Crown View

- [ ] Navigate to `/cosmos`
- [ ] **Verify:** Crown I visible as complete ring (center)
- [ ] **Verify:** Crown II visible as forming ring (orbiting)
- [ ] **Verify:** Connection line between Crown I sonnet and Crown II
- [ ] **Verify:** Generation colors: Gold (Gen 1), Blue (Gen 2)

### 3.5 Complete One Sonnet in Crown 2

- [ ] CC & DD complete their sonnet (12 lines)
- [ ] **Verify:** Completion page shows correctly
- [ ] **Verify:** Crown 2 now shows 1/14 complete
- [ ] **Verify:** New SourceSonnet created (for future Crown)
- [ ] **Verify:** Contributors page shows CC & DD

### 3.6 Seed Attribution Check

- [ ] View the Crown 2 sonnet
- [ ] **Verify:** Shows "Seeded from [first line]..."
- [ ] **Verify:** Shows original authors from Crown 1 (e.g., "Alice & Bob")

---

## Test 4: Return User Flow

### 4.1 Return to In-Progress Poem

- [ ] Start a new pair but don't complete
- [ ] Close browser
- [ ] Navigate to `/signup`
- [ ] Enter code in "Return to Your Poem" section
- [ ] **Verify:** Redirected to writing interface
- [ ] **Verify:** Previous lines still visible
- [ ] **Verify:** Correct turn state preserved

### 4.2 Invalid Code

- [ ] Enter fake code "NOTREAL123"
- [ ] **Verify:** Error message "Code not found"
- [ ] **Verify:** Stays on signup page

---

## Test 5: Abort/Reset Flow

### 5.1 User Initiates Leave

- [ ] Start a pair, write a few lines
- [ ] Click "Leave collaboration" link
- [ ] **Verify:** `/confirm-leave` page shows poem preview
- [ ] **Verify:** Two options: "Go to waiting room" / "Nah, I'm good"

### 5.2 Partner Left Options

After one user leaves:

- [ ] Other user's page shows `/partner-left`
- [ ] **Verify:** Three options displayed:
  - "Restart this poem" (keep lines)
  - "Get new lines" (fresh start)
  - "Nah, I'm good" (exit)

### 5.3 Restart Same Lines

- [ ] Choose "Restart this poem"
- [ ] **Verify:** User goes to waiting room
- [ ] **Verify:** When paired, gets SAME bookend lines
- [ ] **Verify:** Old partial poem deleted

### 5.4 Restart New Lines

- [ ] Choose "Get new lines"
- [ ] **Verify:** Old pair marked "abandoned"
- [ ] **Verify:** User gets fresh pairing with different slot

---

## Test 6: Edge Cases

### 6.1 Pair 14 Wrap-Around

- [ ] **Verify:** Pair 14 receives lines 14 and 1:
  - Line 1: "Is leaving all, to take the thread of Love."
  - Line 14: "In this strange labyrinth, how shall I turn?"
- [ ] This completes the "crown" circle

### 6.2 Long Pen Names

- [ ] Sign up with 100-character pen name
- [ ] **Verify:** Accepted and displays correctly
- [ ] Try 101 characters → **Verify:** Rejected with error

### 6.3 Long Lines

- [ ] Submit a poem line with 500 characters
- [ ] **Verify:** Accepted
- [ ] Submit 501 characters → **Verify:** Rejected (or truncated)

### 6.4 Empty Line

- [ ] Try to submit empty line
- [ ] **Verify:** Rejected, stays on page

### 6.5 Special Characters

- [ ] Submit line with: `<script>alert('xss')</script>`
- [ ] **Verify:** Displayed as text, not executed
- [ ] Submit line with emoji: "The heart ❤️ beats on"
- [ ] **Verify:** Emoji displays correctly

---

## Test 7: API Endpoints

### 7.1 Fractal Tree API

```bash
curl http://localhost:8000/api/fractal/tree
```

- [ ] Returns JSON with `crowns` array
- [ ] Each crown has `id`, `generation`, `status`, `sonnets`
- [ ] Sonnets have `authors`, `lines`, `seedLines`
- [ ] `originalSeed` contains Lady Mary Wroth poem

### 7.2 Crown Context API

```bash
curl http://localhost:8000/api/crown/1/context
```

- [ ] Returns crown metadata
- [ ] `parent` is null for Crown 1
- [ ] `children` lists any spawned Crown 2+ crowns
- [ ] `source.authors` is "Lady Mary Wroth" for Crown 1

### 7.3 Scroll API

```bash
curl http://localhost:8000/api/crown/1/scroll
```

- [ ] Returns sonnets with full line text
- [ ] `is_source` flags on lines 1 and 14
- [ ] `seed_authors` is "Lady Mary Wroth"

---

## Test 8: Visual/UI Checks

### 8.1 Mobile Responsiveness

- [ ] Test signup page on mobile viewport
- [ ] Test writing interface on mobile
- [ ] Test visualization on mobile (touch pan/zoom in Cosmos)
- [ ] Hamburger menu works

### 8.2 Cosmos Interactions

- [ ] Drag to pan
- [ ] Scroll/pinch to zoom
- [ ] Click star → Poem reader opens
- [ ] Hover crown → Label appears
- [ ] Legend shows generation colors

### 8.3 Cross-Browser

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Final Checklist Before Launch

- [ ] All 14 pairs can complete sonnets
- [ ] Crown 1 completes correctly
- [ ] Crown 2+ spawns from completed sonnets
- [ ] All visualization views work
- [ ] Contributors page populates
- [ ] Return flow works with codes
- [ ] Abort/reset flow works
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Database can be reset cleanly
- [ ] Seed poem is Lady Mary Wroth (not Ted Berrigan)

---

## Quick Smoke Test (5 minutes)

For rapid verification:

1. Reset database, seed
2. Sign up 2 users → Verify pairing
3. Complete 1 sonnet → Verify completion
4. Check `/crown/1/visualize` → All 3 views work
5. Check `/contributors` → Authors listed
6. Check `/cosmos` → Crown ring visible

If all pass, system is functional.

---

*Last updated: January 3, 2026*
