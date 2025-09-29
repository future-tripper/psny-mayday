#!/usr/bin/env python3
"""
Generate Test Database for Crown Visualization Development
Creates test_database.db with a completed Crown (14 sonnets) for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel, Session, create_engine
from models import User, Sonnet, Line, Turn, Crown, Pair, SourceSonnet, SourceLine
from datetime import datetime, timedelta
import random
import os

# Use separate test database
TEST_DB_URL = "sqlite:///test_database.db"
test_engine = create_engine(TEST_DB_URL)


def generate_poetry_line():
    """Generate a realistic-looking poetry line"""
    templates = [
        "The {adj} {noun} {verb} through {adj2} {noun2}",
        "In {noun} we find our {adj} {noun2}",
        "Where {noun} and {noun2} {verb} as one",
        "{Adj} {noun} beneath the {adj2} sky",
        "Through {noun} the {adj} world {verb}",
        "And {verb} the {adj} {noun} of time",
        "We {verb} beyond the {adj} {noun}",
        "Like {noun} upon the {adj} {noun2}",
        "The {noun} {verb} with {adj} grace",
        "Until the {adj} {noun} {verb} no more",
    ]

    words = {
        "adj": ["ancient", "silver", "golden", "weary", "gentle", "distant", "eternal", "hidden", "sacred", "luminous"],
        "adj2": ["morning", "evening", "autumn", "winter", "starlit", "moonlit", "endless", "frozen", "burning", "fading"],
        "Adj": ["Silent", "Broken", "Whispered", "Forgotten", "Eternal", "Sacred", "Hidden", "Distant", "Ancient", "Gentle"],
        "noun": ["shadows", "light", "memory", "dreams", "waters", "echoes", "voices", "moments", "gardens", "pathways"],
        "noun2": ["sorrow", "beauty", "wonder", "silence", "thunder", "wisdom", "longing", "futures", "stories", "prayers"],
        "verb": ["dance", "whisper", "wander", "shimmer", "glimmer", "tremble", "linger", "beckon", "falter", "flourish"],
    }

    template = random.choice(templates)
    for word_type, word_list in words.items():
        template = template.replace("{" + word_type + "}", random.choice(word_list), 1)

    return template


def create_test_database():
    """Create and populate test database with completed Crown"""

    # Remove old test database if exists
    if os.path.exists("test_database.db"):
        os.remove("test_database.db")
        print("Removed old test database")

    # Create all tables
    SQLModel.metadata.create_all(test_engine)
    print("Created test database schema")

    with Session(test_engine) as session:
        # 1. Create source sonnet (same as production)
        source_sonnet = SourceSonnet(title="Wind Giving Presence")
        session.add(source_sonnet)
        session.commit()
        session.refresh(source_sonnet)

        lines_text = [
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

        for i, line_text in enumerate(lines_text, start=1):
            source_line = SourceLine(
                source_sonnet_id=source_sonnet.id,
                line_number=i,
                text=line_text
            )
            session.add(source_line)

        session.commit()
        print(f"Created source sonnet with {len(lines_text)} lines")

        # 2. Create Crown
        crown = Crown(source_sonnet_id=source_sonnet.id, status="complete")
        session.add(crown)
        session.commit()
        session.refresh(crown)
        print(f"Created Crown #{crown.id}")

        # 3. Create 28 users (14 pairs)
        pen_names = [
            "Moonweaver", "Starwhisper", "Nightingale", "Riverstone",
            "Windchaser", "Sunseeker", "Cloudwalker", "Fireheart",
            "Oceanmind", "Earthkeeper", "Skydancer", "Shadowpoet",
            "Lightbringer", "Dreamweaver", "Soulscribe", "Heartstring",
            "Mindbridge", "Spiritsong", "Timebender", "Spacemaker",
            "Voidwalker", "Echomaster", "Silentvoice", "Thunderword",
            "Frostwriter", "Flamekeeper", "Stormcaller", "Peacekeeper"
        ]

        users = []
        for i, pen_name in enumerate(pen_names[:28]):
            user = User(
                email=f"{pen_name.lower()}@poetry.test",
                pen_name=pen_name,
                code=f"TEST{i:03d}",
                status="paired"
            )
            session.add(user)
            users.append(user)

        session.commit()
        print(f"Created {len(users)} test users")

        # 4. Create 14 pairs with completed sonnets (for true Crown)
        base_time = datetime.utcnow() - timedelta(days=7)

        for pair_num in range(14):
            user1_idx = pair_num * 2
            user2_idx = pair_num * 2 + 1
            user1 = users[user1_idx]
            user2 = users[user2_idx]

            # Create sonnet
            sonnet_time = base_time + timedelta(hours=pair_num * 3)
            sonnet = Sonnet(
                created_at=sonnet_time,
                status="complete"
            )
            session.add(sonnet)
            session.commit()
            session.refresh(sonnet)

            # Create pair
            pair = Pair(
                crown_id=crown.id,
                user_1_id=user1.id,
                user_2_id=user2.id,
                source_line_start=pair_num + 1,  # Lines 1-2, 2-3, ..., 13-14, 14-1
                sonnet_id=sonnet.id,
                status="complete",
                completion_order=pair_num + 1,
                created_at=sonnet_time
            )
            session.add(pair)

            # Update users' pair_id
            user1.pair_id = pair.id
            user2.pair_id = pair.id
            session.add(user1)
            session.add(user2)

            session.commit()
            session.refresh(pair)

            # Get source lines for this pair
            source_lines = session.query(SourceLine).filter(
                SourceLine.source_sonnet_id == source_sonnet.id,
                SourceLine.line_number.in_([pair_num + 1, pair_num + 2])
            ).order_by(SourceLine.line_number).all()

            # Create 14 lines for the sonnet
            for line_num in range(1, 15):
                if line_num == 1:
                    # First line from source
                    text = source_lines[0].text
                    author = user1
                elif line_num == 14:
                    # Last line from source
                    text = source_lines[1].text if len(source_lines) > 1 else "Wind giving presence to fragments."
                    author = user2
                else:
                    # Generated poetry line
                    text = generate_poetry_line()
                    # Alternate authors for middle lines
                    author = user1 if line_num % 2 == 0 else user2

                line = Line(
                    sonnet_id=sonnet.id,
                    line_number=line_num,
                    text=text,
                    author_user_id=author.id,
                    created_at=sonnet_time + timedelta(minutes=line_num)
                )
                session.add(line)

            session.commit()
            print(f"Created Pair {pair_num + 1}: {user1.pen_name} & {user2.pen_name} (Sonnet #{sonnet.id})")

        print("\n✨ Test database created successfully!")
        print(f"   Crown #{crown.id} with 14 completed sonnets")
        print(f"   28 test users paired up")
        print(f"   196 lines of poetry (14 lines × 14 sonnets)")
        print(f"   Database: test_database.db")
        print("\n📝 To view the test Crown:")
        print("   1. Temporarily modify database.py to use 'test_database.db'")
        print("   2. Visit http://localhost:8000/crown")
        print("   3. Remember to switch back to 'database.db' when done!")


if __name__ == "__main__":
    create_test_database()