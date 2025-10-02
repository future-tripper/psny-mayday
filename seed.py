from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import SourceSonnet, SourceLine, Crown


def seed_data():
    create_db_and_tables()

    with Session(engine) as session:
        session.exec(select(SourceSonnet)).first()

        source_sonnet = SourceSonnet(
            title="Sonnet 1",
            source_type="classic",
            parent_sonnet_id=None
        )
        session.add(source_sonnet)
        session.commit()
        session.refresh(source_sonnet)

        lines = [
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