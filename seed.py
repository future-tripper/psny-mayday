from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import SourceSonnet, SourceLine, Crown


def seed_data():
    create_db_and_tables()

    with Session(engine) as session:
        # Check if database is already seeded
        existing = session.exec(select(SourceSonnet)).first()
        if existing:
            print("⚠️  Database already seeded. Skipping.")
            print(f"   Found existing source sonnet: '{existing.title}'")
            return

        source_sonnet = SourceSonnet(
            title="In this strange labyrinth how shall I turn",
            source_type="classic",
            parent_sonnet_id=None
        )
        session.add(source_sonnet)
        session.commit()
        session.refresh(source_sonnet)

        lines = [
            "In this strange labyrinth, how shall I turn?",
            "Paths lie on every side, yet still I stray.",
            "If to the right, there love makes me burn;",
            "If I go forward, danger bars the way.",
            "If to the left, suspicion spoils all bliss;",
            "If I turn back, shame cries that I should return.",
            "I dare not faint, though crosses strike my fate;",
            "To stand still is hardest, though it leads to mourn.",
            "So let me take the right or left-hand way,",
            "Go forward, stand still, or backward retreat;",
            "These doubts I must endure without delay,",
            "With no relief, but travel as my fate.",
            "Yet what most stirs my troubled heart above",
            "Is leaving all, to take the thread of Love."
        ]

        for i, line_text in enumerate(lines, start=1):
            source_line = SourceLine(
                source_sonnet_id=source_sonnet.id,
                line_number=i,
                text=line_text
            )
            session.add(source_line)

        session.commit()

        crown = Crown(
            source_sonnet_id=source_sonnet.id,
            generation=1,
            parent_sonnet_id=None,
            status="forming"
        )
        session.add(crown)
        session.commit()

        print("✨ Database seeded successfully!")
        print(f"- Created source sonnet: '{source_sonnet.title}'")
        print(f"- Added {len(lines)} lines")
        print(f"- Created Crown #{crown.id} (status: {crown.status})")
        print(f"- Ready for 14 poets to sign up and create 7 new sonnets!")


if __name__ == "__main__":
    seed_data()