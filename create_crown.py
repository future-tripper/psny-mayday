#!/usr/bin/env python3
"""
Manual Crown Creation Script for V2 Testing
Creates a new Crown from an existing completed sonnet or fresh source.
"""

from sqlmodel import Session, select
from database import engine
from models import Crown, SourceSonnet, SourceLine, Sonnet, Line
import sys


def create_crown_from_sonnet(sonnet_id: int):
    """Create a new Crown from an existing completed sonnet"""
    with Session(engine) as session:
        # Get the completed sonnet
        sonnet = session.exec(select(Sonnet).where(Sonnet.id == sonnet_id)).first()
        if not sonnet:
            print(f"❌ Sonnet {sonnet_id} not found")
            return

        if sonnet.status != "complete":
            print(f"❌ Sonnet {sonnet_id} is not complete")
            return

        # Get all lines from the sonnet
        lines = session.exec(
            select(Line)
            .where(Line.sonnet_id == sonnet_id)
            .order_by(Line.line_number)
        ).all()

        if len(lines) != 14:
            print(f"❌ Sonnet {sonnet_id} doesn't have 14 lines")
            return

        # Create new SourceSonnet
        source_sonnet = SourceSonnet(title=f"Generated from Sonnet {sonnet_id}")
        session.add(source_sonnet)
        session.commit()
        session.refresh(source_sonnet)

        # Copy lines as SourceLines
        for line in lines:
            source_line = SourceLine(
                source_sonnet_id=source_sonnet.id,
                line_number=line.line_number,
                text=line.text
            )
            session.add(source_line)

        # Create new Crown
        crown = Crown(
            source_sonnet_id=source_sonnet.id,
            status="forming"
        )
        session.add(crown)
        session.commit()
        session.refresh(crown)

        print(f"✨ Created Crown #{crown.id} from Sonnet {sonnet_id}")
        print(f"   Source: '{source_sonnet.title}'")
        print(f"   Status: {crown.status}")
        print(f"   Ready for 14 new pairs to form!")
        return crown.id


def list_available_sonnets():
    """List all completed sonnets that could spawn new Crowns"""
    with Session(engine) as session:
        sonnets = session.exec(
            select(Sonnet).where(Sonnet.status == "complete")
        ).all()

        if not sonnets:
            print("No completed sonnets available")
            return

        print("\n📝 Completed sonnets available for Crown creation:")
        for sonnet in sonnets:
            print(f"   Sonnet #{sonnet.id} (created {sonnet.created_at.strftime('%Y-%m-%d')})")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python create_crown.py list              # List available sonnets")
        print("  python create_crown.py from <sonnet_id>  # Create Crown from sonnet")
        return

    command = sys.argv[1]

    if command == "list":
        list_available_sonnets()
    elif command == "from" and len(sys.argv) > 2:
        try:
            sonnet_id = int(sys.argv[2])
            create_crown_from_sonnet(sonnet_id)
        except ValueError:
            print("❌ Invalid sonnet ID")
    else:
        print("❌ Invalid command")


if __name__ == "__main__":
    main()