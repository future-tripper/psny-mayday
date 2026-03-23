# Mayday — Product Requirements

## What Is Mayday?

A web-based collaborative poetry platform where strangers write sonnets together in pairs. Every completed sonnet seeds new ones, creating an infinitely growing fractal tree of interconnected poetry. Built for the Poetry Society of New York.

The name comes from the French "m'aider" (help me) — poets answering each other's call through shared verse.

## Core User Flow

### 1. Sign Up
- User enters a pen name (required) and email (optional, for PSNY CRM)
- Receives a unique secret code — their only way to return to their poem
- No accounts, no passwords, no authentication friction

### 2. Pairing
- User enters a waiting room until another poet signs up
- System automatically pairs two waiting poets
- Each pair receives two "bookend" lines from a seed sonnet (consecutive lines, e.g. lines 3 and 4)
- These bookend lines become line 1 and line 14 of their new sonnet

### 3. Writing
- Poets alternate writing lines between the two bookends (turn-based)
- Each poet writes 6 lines (lines 2-13, alternating)
- The interface shows all 14 line slots, with bookends pre-filled and collaborative lines appearing as they're written
- Poet can return anytime using their secret code

### 4. Completion
- When line 13 is submitted, the sonnet is complete
- Both poets see a celebration page
- The completed sonnet automatically becomes a seed for future Crowns

### 5. Visualization
- Three views of the growing poetry collection:
  - **Threads** — Horizontal card layout showing each sonnet
  - **Scroll** — Vertical reading view with bookend lines highlighted
  - **Cosmos** — Star-field visualization: crowns as rings of stars, click to read

## The Crown of Sonnets

A Crown of Sonnets is a traditional poetic form where sonnets are linked together. In Mayday:

- **One Crown = 14 pairs**, each writing between consecutive lines of the seed poem
- **Pair 1** gets lines 1-2, **Pair 2** gets lines 2-3, ... **Pair 14** gets lines 14-1 (wrapping around)
- When all 14 pairs complete their sonnets, the Crown is complete
- Each of those 14 sonnets becomes a seed for a new Crown (next generation)

### Fractal Growth
- **Generation 1**: Seeded from Lady Mary Wroth's "In this strange labyrinth how shall I turn" (1621)
- **Generation 2**: 14 Crowns seeded from Generation 1's completed sonnets
- **Generation 3+**: Each generation spawns 14x more Crowns
- Growth is organic — new Crowns only form when poets sign up

## Partner Abandonment

### User-initiated leave
- Poet clicks "Leave collaboration" → sees poem preview, can copy their work
- Chooses: return to waiting room (get re-paired) or exit completely
- Remaining partner sees options: restart with same bookend lines, get new lines, or exit

### 12-hour timeout
- If neither poet writes for 12 hours, the pair is marked abandoned
- Both users' slots are freed, the incomplete sonnet is deleted
- The Crown slot becomes available for a new pair

## Non-Functional Requirements

### No barriers to entry
- No accounts, no email required, no login
- Pen name is per-poem (not a persistent identity)
- Same pen name used by multiple people is fine — it's communal poetry

### Data integrity
- Every poem traceable through generations back to the original seed
- Completed sonnets are permanent — never deleted or modified
- Secret codes are 128-bit tokens (cryptographically secure)

### Performance
- Works on mobile browsers (responsive design)
- Cosmos visualization supports pan/zoom with touch and mouse

## Seed Poem

Crown 1 is seeded from Lady Mary Wroth's sonnet (1621):

> In this strange labyrinth how shall I turn?
> Shall I turn to the left, or to the right?
> ...
> Paths lie on every side, yet still I stray.

To change the seed poem: update `seed.py` and replace "Lady Mary Wroth" references in `app.py` (4 occurrences).

## Success Criteria

For the initial live test with PSNY poets:

1. Two poets can sign up, get paired, and write a complete sonnet
2. The completed sonnet appears in all three visualization views
3. A second pair signing up gets different bookend lines from the same seed
4. Return-to-poem flow works via secret code
5. The experience feels intentional and poetic, not like a tech demo
