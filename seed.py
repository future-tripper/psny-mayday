from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import User, Sonnet, Line, Turn


def seed_data():
    create_db_and_tables()

    with Session(engine) as session:
        existing_users = session.exec(select(User)).first()
        if existing_users:
            print("Database already seeded!")
            return

        user_alpha = User(display_name="Alpha", code="ALPHA")
        user_beta = User(display_name="Beta", code="BETA")
        session.add(user_alpha)
        session.add(user_beta)
        session.commit()
        session.refresh(user_alpha)
        session.refresh(user_beta)

        sonnet = Sonnet(status="active")
        session.add(sonnet)
        session.commit()
        session.refresh(sonnet)

        first_line = Line(
            sonnet_id=sonnet.id,
            line_number=1,
            text="Shall I compare thee to a summer's day?",
            author_user_id=user_alpha.id
        )
        session.add(first_line)
        session.commit()

        turn = Turn(sonnet_id=sonnet.id, next_user_id=user_beta.id)
        session.add(turn)
        session.commit()

        print("✨ Database seeded successfully!")
        print(f"- Created users: {user_alpha.display_name} and {user_beta.display_name}")
        print(f"- Created sonnet #{sonnet.id} with first line")
        print(f"- It's {user_beta.display_name}'s turn to add line 2")


if __name__ == "__main__":
    seed_data()