# Mayday Vision Board 🚀

*A place to dream big about what Mayday could become*

---

## Purpose of This Document

This is where we capture exciting ideas for future features and extensions of Mayday. These are beyond the MVP but help us stay inspired and see the bigger picture. When we have breakthrough moments or "what if..." thoughts during development, we add them here!

---

# chatbot - About Page/Helper

**The Concept**
Add a chat bot that can tell the users what the experience is about, and sell membership/tell the user about upcoming events.

---

## Fundraising & Social Impact Features

### Mission-Based Poetry Crowns (Fundraising Gamification)

**The Concept:**
Transform poetry creation into a fundraising engine by connecting sonnet crowns to charitable missions.

**How It Works:**
- Users can create or join "mission groups" around causes (e.g., cancer research, animal rescue, environmental conservation)
- Groups write themed sonnets related to their mission
- Poetry creation becomes a "marathon" - teams compete to complete the most sonnet crowns within a timeframe
- Each completed crown unlocks donations or pledges
- Gamification elements: leaderboards, team progress bars, milestone celebrations

**Example:**
- "Hope & Healing" group (cancer research) vs "Rescue Rhymes" group (dog rescues)
- Both race to complete 10 sonnet crowns in 30 days
- Community members can pledge donations per completed sonnet or crown
- All poems reflect the themes of healing/hope or animal rescue
- Winning team's chosen charity receives the fundraising pool

**Key Differences from Core Vision:**
- This creates separate, themed poetry ecosystems rather than one universal fractal crown
- Adds competitive/collaborative elements for fundraising
- Time-bound challenges vs. continuous creation
- Could coexist with the main fractal crown concept

**Open Questions:**
- How do we ensure poetry quality isn't sacrificed for speed?
- Could this be a seasonal/event-based feature?
- Integration with donation platforms?
- How to keep it meaningful vs. purely transactional?

---

## Future Fundraising Ideas for PSNY

*Brainstorm zone - what other creative ways could Mayday generate revenue or support for poetry?*

**Potential Concepts to Explore:**
- Sponsored starting lines from famous poets
- NFT/collectible editions of completed crown genealogies
- "Adopt a sonnet" patronage model
- Poetry workshops unlocked through platform milestones
- Corporate team-building packages (companies write crowns together)
- Annual Mayday poetry galas showcasing the year's most interconnected crowns
- Publishing partnerships for crown anthologies

---

## Other Big Ideas

*Space reserved for non-fundraising future features*

### Fractal Crown-of-Crowns: Multi-Generational Poetry Ecosystem

**The Concept:**
Transform Mayday into a living, ever-growing fractal poetry ecosystem where completed sonnets spawn new Crowns, creating infinite layers of poetic lineage and connection.

**How It Works:**

**Generation 0 (Manual Seed):**
- PSNY curates classic seed sonnet ("Wind Giving Presence", etc.)
- 13 pairs write between consecutive lines (1-2, 2-3, 3-4... 13-14)
- Results in 13 completed sonnets
- Crown #1 status changes to "complete"

**Generation 1 (Auto-Spawned):**
- Each of the 13 completed Gen 0 sonnets automatically spawns its own new Crown
- Creates Crowns #2-14, each with status="forming"
- Each new Crown uses its parent sonnet's 14 lines as the seed
- 13 new pairs per Crown = 169 pairs total across Gen 1
- When each Crown gets 13 completed pairs, it closes and its poems spawn Gen 2

**Generation 2+ (Exponential Growth):**
- Each Gen 1 sonnet spawns a Gen 2 Crown (169 new Crowns)
- Pattern continues infinitely
- Growth: 1 → 13 → 169 → 2,197 → 28,561...

**Database Architecture:**

```
Crown Model:
- parent_sonnet_id (NULL for Gen 0, otherwise references Sonnet table)
- generation (0, 1, 2, 3...)
- status ("forming" or "complete")
- source_sonnet_id (which SourceSonnet has this Crown's seed lines)

When Pair Completes Sonnet:
1. Mark Pair as complete
2. Create new Crown with:
   - parent_sonnet_id = this completed sonnet ID
   - generation = parent_crown.generation + 1
   - status = "forming"
3. Copy all 14 lines from completed sonnet as SourceLines for new Crown
4. New Crown is ready to receive waiting pairs

Pairing Logic:
- Multiple "forming" Crowns exist simultaneously
- Could prioritize: lowest generation first, oldest Crown, or random
- Assigns pairs to first available slot in chosen Crown
```

**Visualization - Two Node Levels:**

**Poem Level (Within a Crown):**
- 13 sonnet nodes arranged in a circle
- Each connected to all others via shared seed lines
- Clicking a poem shows its full text and lineage

**Crown Level (Across Generations):**
- Each poem node has a line extending outward to its child Crown
- Zoomed out: Crown appears as single node connected to 13 child Crown nodes
- Creates fractal tree pattern: 1 trunk → 13 branches → 169 branches...

**Navigation:**
- Zoom in: See individual poems within a Crown, connected by shared lines
- Zoom out: See Crown-to-Crown connections across generations
- Trace lineage: Click any poem, see path back to Gen 0 seed
- Explore "cousins": Poems sharing grandparent but different parent

**Key Features:**
✅ Infinite scalability - never runs out of seed material
✅ Every poet contributes to future generations
✅ Complete lineage tracking from any poem back to original seeds
✅ Crowns close after 13 pairs (maintaining structure and meaning)
✅ Linear poem submission to database
✅ Relational structure connects generations meaningfully
✅ Creates "living organism" of interconnected poetry

**Technical Implementation Order:**
1. Add `parent_sonnet_id` and `generation` fields to Crown model
2. Update pair completion logic to auto-spawn new Crown
3. Update pairing logic to handle multiple simultaneous "forming" Crowns
4. Create Crown genealogy API endpoints for visualization
5. Build interactive node-based visualization (D3.js or similar)
6. Add "explore lineage" UI to trace poems through generations

**Open Questions:**
- How to prioritize which Crown gets next waiting pair? (FIFO, generation-based, random?)
- Should users see which generation they're contributing to before pairing?
- Display strategy: Show all Crowns or just the one user is in?
- Performance considerations as generations grow to thousands of Crowns?
- Export/archive strategy for completed Crown genealogies?

---

### AI Integration Possibilities

**The Concept:**
Integrate AI (Claude) into the poetry collaboration experience in thoughtful ways.

**Potential Roles for AI:**

1. **AI as Writing Partner**
   - Option when human partner unavailable or user prefers AI collaboration
   - Could match writing style/tone of seed lines
   - Respectful of the human creative process - enhances, doesn't replace

2. **AI as Seed Generator**
   - Generate new source sonnets to expand the cosmos
   - Could create themed seeds (seasonal, topical, style-based)
   - Curated by PSNY before becoming official seeds

3. **AI as Style Guide/Coach**
   - Help poets match tone/meter of seed lines
   - Suggest rhyme schemes, syllable counts
   - Gentle feedback without being prescriptive

4. **AI as Moderator**
   - Review submissions for quality/appropriateness
   - Flag potential issues for human review
   - Ensure safe, welcoming environment

**Considerations:**
- Always transparent when AI is involved
- Human creativity remains central
- AI as tool/assistant, not replacement
- Could be opt-in feature

---

### Communication Between Poetry Partners

**The Concept:**
Allow paired users to communicate with each other while writing sonnets together.

**Potential Approaches:**
- **In-app chat sidebar**: Real-time messaging alongside the sonnet view
- **Line comments**: Ability to react to or comment on specific lines
- **Voice notes**: Audio messages for a more personal touch
- **Timed prompts**: "Your partner added a line - want to send them a note?"
- **Post-sonnet reflection**: After completing a sonnet, partners can exchange thoughts about the experience

**Why This Matters:**
- Poetry is collaborative and conversational - communication deepens the connection
- Partners can discuss direction, offer encouragement, or simply connect as humans
- Could reduce friction if someone needs to step away (e.g., "Back in 2 hours!")
- Builds community and relationship beyond just the lines themselves

**Considerations:**
- Keep it optional - some may prefer silent, meditative collaboration
- Moderation needs for public/multi-user phases
- How to preserve the focus on poetry vs. becoming primarily a chat app
- Privacy and safety features

(Add new ideas here as they emerge!)

---

**Remember:** The best ideas often come while building the simple stuff. Keep this document alive!