"""
Generate multi-generation Crown test data for fractal visualization testing.

Structure:
- Gen 1: 1 classic seed sonnet (Ted Berrigan's Sonnet 1)
- Gen 1: Crown 1 with 14 complete sonnets from seed
- Gen 2:
  - Crown 2 from sonnet #1 of Crown 1 (14 sonnets complete)
  - Crown 3 from sonnet #2 of Crown 1 (7 sonnets complete, partial)
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

    # Create SourceSonnet - title is the full first line
    source_sonnet = SourceSonnet(
        title=lines[0].text,
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
        # ===== GENERATION 1: Classic Seed =====
        print("📜 Generation 1: Creating classic seed sonnet (Ted Berrigan's Sonnet 1)")

        seed_sonnet = SourceSonnet(
            title="Sonnet 1",
            source_type="classic",
            parent_sonnet_id=None
        )
        session.add(seed_sonnet)
        session.commit()
        session.refresh(seed_sonnet)

        # Ted Berrigan's Sonnet 1
        berrigan_lines = [
            "His piercing pince-nez. Some dim frieze",
            "Hands point to a dim frieze, in the dark night.",
            "In the book of his music the corners have straightened:",
            "Which owe their presence to our sleeping hands.",
            "The ox-blood from the hands which play",
            "For fire for warmth for hands for growth",
            "Is there room in the room that you room in?",
            "Upon his structured tomb:",
            "Still they mean something. For the dance",
            "And the architecture.",
            "Weave among incidents",
            "May be portentous to him",
            "We are the sleeping fragments of his sky,",
            "Wind giving presence to fragments."
        ]

        for i, text in enumerate(berrigan_lines, 1):
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
            # Get the two source lines: start line and the next line (wrapping at 14)
            start_line = session.exec(
                select(SourceLine)
                .where(SourceLine.source_sonnet_id == seed_sonnet.id)
                .where(SourceLine.line_number == source_line_start)
            ).first()

            end_line_num = (source_line_start % 14) + 1
            end_line = session.exec(
                select(SourceLine)
                .where(SourceLine.source_sonnet_id == seed_sonnet.id)
                .where(SourceLine.line_number == end_line_num)
            ).first()

            line_1 = Line(
                sonnet_id=sonnet.id,
                line_number=1,
                text=start_line.text,
                author_user_id=user_1.id,
                created_at=start_date + timedelta(days=pair_num)
            )
            line_14 = Line(
                sonnet_id=sonnet.id,
                line_number=14,
                text=end_line.text,
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

        print(f"\n✅ Multi-generation test data complete!")
        print(f"📊 Summary:")
        print(f"   - Gen 1: 1 classic seed (Ted Berrigan's Sonnet 1)")
        print(f"   - Gen 1: Crown 1 with 14 complete sonnets")
        print(f"   - Gen 2: Crown 2 with 14 complete sonnets (from Crown 1, Sonnet 1)")
        print(f"   - Gen 2: Crown 3 with 7 partial sonnets (from Crown 1, Sonnet 2)")
        print(f"   - Total: 35 sonnets across 2 generations + 3 Crowns")

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
        start_line = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == parent_source.id)
            .where(SourceLine.line_number == source_line_start)
        ).first()

        end_line_num = (source_line_start % 14) + 1
        end_line = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == parent_source.id)
            .where(SourceLine.line_number == end_line_num)
        ).first()

        line_1 = Line(
            sonnet_id=sonnet.id,
            line_number=1,
            text=start_line.text,
            author_user_id=user_1.id,
            created_at=start_date + timedelta(days=pair_num)
        )
        line_14 = Line(
            sonnet_id=sonnet.id,
            line_number=14,
            text=end_line.text,
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
