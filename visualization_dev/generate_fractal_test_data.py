"""
Generate multi-generation Crown test data for fractal visualization testing.

Structure:
- Gen 0: 1 classic seed sonnet (Ozymandias)
- Gen 1: Crown 1 with 14 complete sonnets
- Gen 2:
  - Crown 2 from sonnet #1 (14 sonnets complete)
  - Crown 3 from sonnet #2 (7 sonnets complete)
  - Crown 4 from sonnet #3 (2 sonnets complete)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel, Session, create_engine, select
from models import User, Sonnet, Line, SourceSonnet, SourceLine, Crown, Pair
from datetime import datetime, timedelta
import random

# Test database
TEST_DB_PATH = "visualization_dev/test_database.db"
engine = create_engine(f"sqlite:///{TEST_DB_PATH}", echo=False)

# Sample poem lines for generation
POEM_FRAGMENTS = [
    "In whispered tones the evening speaks",
    "Where shadows dance on moonlit shores",
    "The silver thread of hope remains",
    "Through valleys deep and mountains high",
    "A single star illuminates the way",
    "In silence found, the truth emerges",
    "Where words fail, the heart remembers",
    "Beyond the veil of morning mist",
    "The echo of a distant song",
    "In dreams we find our truest selves",
    "The weight of time cannot erase",
    "What once was lost is now reclaimed"
]

def generate_line():
    """Generate a poetic line."""
    return random.choice(POEM_FRAGMENTS)

def create_source_sonnet_from_completed(sonnet, session):
    """
    When a sonnet completes, automatically create SourceSonnet entry.
    This simulates the auto-seed logic.
    """
    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet.id)
        .order_by(Line.line_number)
    ).all()

    if len(lines) < 14:
        return None

    # Create SourceSonnet
    source_sonnet = SourceSonnet(
        title=f"{lines[0].text[:40]}...",
        source_type="collaborative",
        parent_sonnet_id=sonnet.id
    )
    session.add(source_sonnet)
    session.commit()
    session.refresh(source_sonnet)

    # Create SourceLines
    for line in lines:
        source_line = SourceLine(
            source_sonnet_id=source_sonnet.id,
            line_number=line.line_number,
            text=line.text
        )
        session.add(source_line)

    # Link sonnet back to source
    sonnet.spawned_source_sonnet_id = source_sonnet.id
    session.add(sonnet)
    session.commit()

    return source_sonnet

def create_complete_sonnet(pair, user_1, user_2, session, start_time):
    """Create a complete 14-line sonnet for a pair."""
    sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()

    # Get source lines for bookends
    source_lines = session.exec(
        select(SourceLine)
        .where(SourceLine.source_sonnet_id == session.exec(
            select(Crown.source_sonnet_id).where(Crown.id == pair.crown_id)
        ).first())
        .where(SourceLine.line_number.in_([pair.source_line_start, pair.source_line_start + 1]))
        .order_by(SourceLine.line_number)
    ).all()

    # Create 12 interior lines (alternating between users)
    for i in range(2, 14):
        author = user_1 if i % 2 == 0 else user_2
        line = Line(
            sonnet_id=sonnet.id,
            line_number=i,
            text=generate_line(),
            author_user_id=author.id,
            created_at=start_time + timedelta(hours=i)
        )
        session.add(line)

    sonnet.status = "complete"
    pair.status = "complete"
    session.add(sonnet)
    session.add(pair)
    session.commit()

    return sonnet

def main():
    print("🌱 Creating fractal multi-generation test data...\n")

    # Drop and recreate all tables
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # ===== GENERATION 0: Classic Seed =====
        print("📜 Generation 0: Creating classic seed sonnet (Ozymandias)")

        seed_sonnet = SourceSonnet(
            title="Ozymandias",
            source_type="classic",
            parent_sonnet_id=None
        )
        session.add(seed_sonnet)
        session.commit()
        session.refresh(seed_sonnet)

        # Ozymandias lines
        ozymandias_lines = [
            "I met a traveller from an antique land,",
            "Who said—'Two vast and trunkless legs of stone",
            "Stand in the desert. . . . Near them, on the sand,",
            "Half sunk a shattered visage lies, whose frown,",
            "And wrinkled lip, and sneer of cold command,",
            "Tell that its sculptor well those passions read",
            "Which yet survive, stamped on these lifeless things,",
            "The hand that mocked them, and the heart that fed;",
            "And on the pedestal, these words appear:",
            "My name is Ozymandias, King of Kings;",
            "Look on my Works, ye Mighty, and despair!",
            "Nothing beside remains. Round the decay",
            "Of that colossal Wreck, boundless and bare",
            "The lone and level sands stretch far away.'"
        ]

        for i, text in enumerate(ozymandias_lines, 1):
            source_line = SourceLine(
                source_sonnet_id=seed_sonnet.id,
                line_number=i,
                text=text
            )
            session.add(source_line)
        session.commit()

        # ===== GENERATION 1: Crown 1 (Complete) =====
        print("👑 Generation 1: Creating Crown 1 (14 complete sonnets)\n")

        crown_1 = Crown(
            source_sonnet_id=seed_sonnet.id,
            parent_sonnet_id=None,
            generation=1,
            status="complete"
        )
        session.add(crown_1)
        session.commit()
        session.refresh(crown_1)

        # Create 14 pairs and complete sonnets for Crown 1
        gen1_sonnets = []
        start_date = datetime.now() - timedelta(days=30)

        for pair_num in range(1, 15):
            # Create users
            user_1 = User(
                email=f"gen1_user{pair_num*2-1}@test.com",
                pen_name=f"Gen1 Poet {pair_num}A",
                code=f"GEN1U{pair_num*2-1}",
                status="complete",
                pair_id=None
            )
            user_2 = User(
                email=f"gen1_user{pair_num*2}@test.com",
                pen_name=f"Gen1 Poet {pair_num}B",
                code=f"GEN1U{pair_num*2}",
                status="complete",
                pair_id=None
            )
            session.add(user_1)
            session.add(user_2)
            session.commit()
            session.refresh(user_1)
            session.refresh(user_2)

            # Create sonnet
            sonnet = Sonnet(
                status="active",
                created_at=start_date + timedelta(days=pair_num)
            )
            session.add(sonnet)
            session.commit()
            session.refresh(sonnet)

            # Determine source lines (1→2, 2→3, ..., 14→1)
            if pair_num < 14:
                source_line_start = pair_num
            else:
                source_line_start = 14

            # Create pair
            pair = Pair(
                crown_id=crown_1.id,
                user_1_id=user_1.id,
                user_2_id=user_2.id,
                source_line_start=source_line_start,
                sonnet_id=sonnet.id,
                status="writing",
                completion_order=pair_num,
                created_at=start_date + timedelta(days=pair_num)
            )
            session.add(pair)
            session.commit()
            session.refresh(pair)

            # Update user pair_ids
            user_1.pair_id = pair.id
            user_2.pair_id = pair.id
            session.add(user_1)
            session.add(user_2)

            # Add bookend lines
            source_lines = session.exec(
                select(SourceLine)
                .where(SourceLine.source_sonnet_id == seed_sonnet.id)
                .where(SourceLine.line_number.in_([source_line_start, (source_line_start % 14) + 1]))
                .order_by(SourceLine.line_number)
            ).all()

            line_1 = Line(
                sonnet_id=sonnet.id,
                line_number=1,
                text=source_lines[0].text,
                author_user_id=user_1.id,
                created_at=start_date + timedelta(days=pair_num)
            )
            line_14 = Line(
                sonnet_id=sonnet.id,
                line_number=14,
                text=source_lines[1].text if len(source_lines) > 1 else source_lines[0].text,
                author_user_id=user_2.id,
                created_at=start_date + timedelta(days=pair_num)
            )
            session.add(line_1)
            session.add(line_14)
            session.commit()

            # Complete the sonnet
            complete_sonnet = create_complete_sonnet(
                pair, user_1, user_2, session,
                start_date + timedelta(days=pair_num)
            )

            # Auto-create SourceSonnet from this completed sonnet
            new_source = create_source_sonnet_from_completed(complete_sonnet, session)
            gen1_sonnets.append((complete_sonnet, new_source))

            print(f"  ✓ Sonnet {pair_num}/14 complete (spawned SourceSonnet #{new_source.id})")

        print(f"\n✅ Crown 1 complete with {len(gen1_sonnets)} sonnets\n")

        # ===== GENERATION 2: Multiple Crowns (varying completion) =====
        print("👑 Generation 2: Creating child Crowns...\n")

        # Crown 2: Spawned from sonnet #1, COMPLETE (14 sonnets)
        print("  Creating Crown 2 from Gen1 Sonnet #1 (14/14 complete)")
        create_gen2_crown(gen1_sonnets[0], 2, 14, session)

        # Crown 3: Spawned from sonnet #2, IN PROGRESS (7 sonnets)
        print("  Creating Crown 3 from Gen1 Sonnet #2 (7/14 complete)")
        create_gen2_crown(gen1_sonnets[1], 3, 7, session)

        # Crown 4: Spawned from sonnet #3, JUST STARTED (2 sonnets)
        print("  Creating Crown 4 from Gen1 Sonnet #3 (2/14 complete)")
        create_gen2_crown(gen1_sonnets[2], 4, 2, session)

        print(f"\n✅ Multi-generation test data complete!")
        print(f"📊 Summary:")
        print(f"   - Gen 0: 1 classic seed")
        print(f"   - Gen 1: 1 Crown (14 sonnets, all complete)")
        print(f"   - Gen 2: 3 Crowns (14, 7, and 2 sonnets)")
        print(f"   - Total: 37 sonnets across 3 generations")

def create_gen2_crown(parent_data, crown_num, num_complete, session):
    """Create a generation 2 Crown with specified number of complete sonnets."""
    parent_sonnet, parent_source = parent_data

    # Create Crown
    crown = Crown(
        source_sonnet_id=parent_source.id,
        parent_sonnet_id=parent_sonnet.id,
        generation=2,
        status="complete" if num_complete == 14 else "forming"
    )
    session.add(crown)
    session.commit()
    session.refresh(crown)

    start_date = datetime.now() - timedelta(days=20)

    for pair_num in range(1, num_complete + 1):
        # Create users
        user_1 = User(
            email=f"gen2_c{crown_num}_user{pair_num*2-1}@test.com",
            pen_name=f"Gen2 C{crown_num} Poet {pair_num}A",
            code=f"G2C{crown_num}U{pair_num*2-1}",
            status="complete",
            pair_id=None
        )
        user_2 = User(
            email=f"gen2_c{crown_num}_user{pair_num*2}@test.com",
            pen_name=f"Gen2 C{crown_num} Poet {pair_num}B",
            code=f"G2C{crown_num}U{pair_num*2}",
            status="complete",
            pair_id=None
        )
        session.add(user_1)
        session.add(user_2)
        session.commit()
        session.refresh(user_1)
        session.refresh(user_2)

        # Create sonnet
        sonnet = Sonnet(
            status="active",
            created_at=start_date + timedelta(days=pair_num)
        )
        session.add(sonnet)
        session.commit()
        session.refresh(sonnet)

        # Source lines
        if pair_num < 14:
            source_line_start = pair_num
        else:
            source_line_start = 14

        # Create pair
        pair = Pair(
            crown_id=crown.id,
            user_1_id=user_1.id,
            user_2_id=user_2.id,
            source_line_start=source_line_start,
            sonnet_id=sonnet.id,
            status="writing",
            completion_order=pair_num,
            created_at=start_date + timedelta(days=pair_num)
        )
        session.add(pair)
        session.commit()
        session.refresh(pair)

        # Update user pair_ids
        user_1.pair_id = pair.id
        user_2.pair_id = pair.id
        session.add(user_1)
        session.add(user_2)

        # Add bookend lines
        source_lines = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == parent_source.id)
            .where(SourceLine.line_number.in_([source_line_start, (source_line_start % 14) + 1]))
            .order_by(SourceLine.line_number)
        ).all()

        line_1 = Line(
            sonnet_id=sonnet.id,
            line_number=1,
            text=source_lines[0].text,
            author_user_id=user_1.id,
            created_at=start_date + timedelta(days=pair_num)
        )
        line_14 = Line(
            sonnet_id=sonnet.id,
            line_number=14,
            text=source_lines[1].text if len(source_lines) > 1 else source_lines[0].text,
            author_user_id=user_2.id,
            created_at=start_date + timedelta(days=pair_num)
        )
        session.add(line_1)
        session.add(line_14)
        session.commit()

        # Complete the sonnet
        create_complete_sonnet(
            pair, user_1, user_2, session,
            start_date + timedelta(days=pair_num)
        )

    print(f"    ✓ Crown {crown_num} created ({num_complete}/14 sonnets)")

if __name__ == "__main__":
    main()
