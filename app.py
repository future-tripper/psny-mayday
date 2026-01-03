import os
from typing import Optional
from fastapi import FastAPI, Request, Form, Depends, Query
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from sqlmodel import Session, select
from sqlalchemy import text
from database import get_session, run_migrations
from models import User, Sonnet, Line, Turn, Crown, Pair, SourceSonnet, SourceLine
import secrets
import logging
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Stale pair threshold (12 hours)
STALE_THRESHOLD_HOURS = 12

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


# Run migrations on startup
@app.on_event("startup")
def on_startup():
    run_migrations()


# Global exception handler - catch unexpected errors gracefully
@app.exception_handler(Exception)
async def poetic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error at {request.url}: {exc}", exc_info=True)

    error_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>A Momentary Pause | Mayday</title>
        <style>
            body {
                font-family: 'EB Garamond', Georgia, serif;
                background: #FFFBE2;
                color: #2b2b2b;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                text-align: center;
            }
            .container {
                max-width: 500px;
            }
            h1 {
                font-family: 'Josefin Sans', sans-serif;
                font-size: 1.5rem;
                margin-bottom: 2rem;
                color: #F8B098;
            }
            .poem {
                font-style: italic;
                line-height: 1.8;
                margin-bottom: 2rem;
            }
            a {
                color: #2b2b2b;
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>A Momentary Pause</h1>
            <p class="poem">
                Even sonnets stumble mid-verse,<br>
                a breath between the words—<br>
                the page awaits, patient as always.<br>
                Try again, dear poet.
            </p>
            <p><a href="/signup">Return to the beginning</a></p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=error_html, status_code=500)


def spawn_source_sonnet_from_completed(sonnet_id: int, session: Session):
    """
    When a sonnet is completed, automatically create a new SourceSonnet from it.
    This allows completed sonnets to become seeds for future Crowns.
    """
    # Get the completed sonnet and its lines
    sonnet = session.exec(select(Sonnet).where(Sonnet.id == sonnet_id)).first()
    if not sonnet:
        return None

    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet_id)
        .order_by(Line.line_number)
    ).all()

    if len(lines) != 14:
        return None

    # Get the pair info for authors
    pair = session.exec(select(Pair).where(Pair.sonnet_id == sonnet_id)).first()
    if not pair:
        return None

    user1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
    user2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()

    # Create title from first line
    title = lines[0].text

    # Create new SourceSonnet
    new_source = SourceSonnet(
        title=title,
        source_type="collaborative",
        parent_sonnet_id=sonnet_id
    )
    session.add(new_source)
    session.commit()
    session.refresh(new_source)

    # Copy all 14 lines to SourceLine
    for line in lines:
        source_line = SourceLine(
            source_sonnet_id=new_source.id,
            line_number=line.line_number,
            text=line.text
        )
        session.add(source_line)

    # Mark that this sonnet spawned a source
    sonnet.spawned_source_sonnet_id = new_source.id
    session.add(sonnet)

    session.commit()

    print(f"✨ Spawned new SourceSonnet #{new_source.id} from Sonnet #{sonnet_id}")
    print(f"   Title: \"{title}\"")
    print(f"   Authors: {user1.pen_name if user1 else '?'} & {user2.pen_name if user2 else '?'}")

    return new_source


def find_stale_pairs(session: Session, threshold_hours: int = STALE_THRESHOLD_HOURS):
    """Find pairs with no activity for X hours."""
    threshold = datetime.utcnow() - timedelta(hours=threshold_hours)

    active_pairs = session.exec(
        select(Pair).where(Pair.status == "writing")
    ).all()

    stale_pairs = []
    for pair in active_pairs:
        # Find most recent line in their sonnet
        latest_line = session.exec(
            select(Line)
            .where(Line.sonnet_id == pair.sonnet_id)
            .order_by(Line.created_at.desc())
        ).first()

        # If last line is older than threshold → stale
        if latest_line and latest_line.created_at < threshold:
            stale_pairs.append(pair)

    return stale_pairs


def cleanup_stale_pairs(session: Session):
    """Mark stale pairs as abandoned, freeing their slots."""
    stale_pairs = find_stale_pairs(session, STALE_THRESHOLD_HOURS)

    for pair in stale_pairs:
        pair.status = "abandoned"

        # Clean up incomplete sonnet
        sonnet = session.exec(
            select(Sonnet).where(Sonnet.id == pair.sonnet_id)
        ).first()
        if sonnet:
            # Delete lines
            lines = session.exec(select(Line).where(Line.sonnet_id == sonnet.id)).all()
            for line in lines:
                session.delete(line)
            # Delete turn
            turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()
            if turn:
                session.delete(turn)
            # Delete sonnet
            session.delete(sonnet)

        # Reset both users to waiting
        for user_id in [pair.user_1_id, pair.user_2_id]:
            if user_id:
                user = session.exec(select(User).where(User.id == user_id)).first()
                if user:
                    user.status = "waiting"
                    user.pair_id = None
                    session.add(user)

        session.add(pair)

    session.commit()

    if stale_pairs:
        print(f"🧹 Cleaned up {len(stale_pairs)} stale pair(s)")

    return len(stale_pairs)


def try_pair_users(session: Session):
    # FIRST: Clean up stale pairs (frees abandoned slots)
    cleanup_stale_pairs(session)

    waiting_users = session.exec(
        select(User).where(User.status == "waiting").order_by(User.id)
    ).all()

    # PRIORITY 1: Fill orphaned pairs first
    if len(waiting_users) >= 1:
        orphaned_pair = session.exec(
            select(Pair).where(Pair.status == "orphaned").order_by(Pair.created_at)
        ).first()

        if orphaned_pair:
            new_partner = waiting_users[0]

            # Get the remaining user (user_1)
            remaining_user = session.exec(
                select(User).where(User.id == orphaned_pair.user_1_id)
            ).first()

            # Get crown and source lines for this slot
            crown = session.exec(select(Crown).where(Crown.id == orphaned_pair.crown_id)).first()

            first_line_num = orphaned_pair.source_line_start
            second_line_num = 1 if first_line_num == 14 else first_line_num + 1

            source_lines = session.exec(
                select(SourceLine)
                .where(SourceLine.source_sonnet_id == crown.source_sonnet_id)
                .where(SourceLine.line_number.in_([first_line_num, second_line_num]))
                .order_by(SourceLine.line_number)
            ).all()

            # Create fresh sonnet
            new_sonnet = Sonnet(status="active")
            session.add(new_sonnet)
            session.commit()
            session.refresh(new_sonnet)

            # Add bookend lines
            line_1 = Line(
                sonnet_id=new_sonnet.id,
                line_number=1,
                text=source_lines[0].text,
                author_user_id=remaining_user.id
            )
            session.add(line_1)

            line_14 = Line(
                sonnet_id=new_sonnet.id,
                line_number=14,
                text=source_lines[1].text,
                author_user_id=new_partner.id
            )
            session.add(line_14)

            # Create turn
            turn = Turn(sonnet_id=new_sonnet.id, next_user_id=remaining_user.id)
            session.add(turn)

            # Update pair
            orphaned_pair.user_2_id = new_partner.id
            orphaned_pair.sonnet_id = new_sonnet.id
            orphaned_pair.status = "writing"
            session.add(orphaned_pair)

            # Update users
            remaining_user.status = "paired"
            remaining_user.pair_id = orphaned_pair.id
            new_partner.status = "paired"
            new_partner.pair_id = orphaned_pair.id
            session.add(remaining_user)
            session.add(new_partner)

            session.commit()

            print(f"🔗 Filled orphaned pair with {new_partner.pen_name}")
            return orphaned_pair

    # PRIORITY 2: Normal pairing
    if len(waiting_users) < 2:
        return None

    crown = session.exec(select(Crown).where(Crown.status == "forming")).first()

    # If no forming Crown, try to create a new one from next available SourceSonnet
    if not crown:
        # Get the next unused SourceSonnet (one that hasn't spawned a Crown yet)
        unused_source = session.exec(
            select(SourceSonnet)
            .where(~SourceSonnet.id.in_(
                select(Crown.source_sonnet_id)
            ))
            .order_by(SourceSonnet.id)
        ).first()

        if not unused_source:
            print("⚠️  No unused SourceSonnets available to create new Crown")
            return None

        # Get the parent Crown's generation (if collaborative)
        parent_generation = 1
        if unused_source.source_type == "collaborative" and unused_source.parent_sonnet_id:
            parent_sonnet = session.exec(
                select(Sonnet).where(Sonnet.id == unused_source.parent_sonnet_id)
            ).first()
            if parent_sonnet:
                parent_pair = session.exec(
                    select(Pair).where(Pair.sonnet_id == parent_sonnet.id)
                ).first()
                if parent_pair:
                    parent_crown = session.exec(
                        select(Crown).where(Crown.id == parent_pair.crown_id)
                    ).first()
                    if parent_crown:
                        parent_generation = parent_crown.generation

        # Create new Crown
        new_crown = Crown(
            source_sonnet_id=unused_source.id,
            parent_sonnet_id=unused_source.parent_sonnet_id,
            generation=parent_generation + 1 if unused_source.source_type == "collaborative" else 1,
            status="forming"
        )
        session.add(new_crown)
        session.commit()
        session.refresh(new_crown)

        crown = new_crown

        print(f"🌟 Created new Crown #{crown.id} (Generation {crown.generation})")
        print(f"   Seed: \"{unused_source.title}\" ({unused_source.source_type})")

    # Exclude abandoned pairs when counting slots (they can be backfilled)
    existing_pairs = session.exec(
        select(Pair)
        .where(Pair.crown_id == crown.id)
        .where(Pair.status != "abandoned")
    ).all()

    if len(existing_pairs) >= 14:  # Allow 14 pairs for true Crown
        return None

    user_1 = waiting_users[0]
    user_2 = waiting_users[1]

    # Only count non-abandoned pairs for slot assignment
    assigned_line_starts = {pair.source_line_start for pair in existing_pairs if pair.status != "abandoned"}

    first_line_num = None
    second_line_num = None

    # Check regular pairs (1→2, 2→3, ..., 13→14)
    for i in range(1, 14):
        if i not in assigned_line_starts:
            first_line_num = i
            second_line_num = i + 1
            break

    # Check crown closure pair (14→1) if all regular pairs are assigned
    if first_line_num is None and 14 not in assigned_line_starts:
        first_line_num = 14
        second_line_num = 1  # Crown closure: line 14 connects back to line 1

    if first_line_num is None:
        return None

    source_lines = session.exec(
        select(SourceLine)
        .where(SourceLine.source_sonnet_id == crown.source_sonnet_id)
        .where(SourceLine.line_number.in_([first_line_num, second_line_num]))
        .order_by(SourceLine.line_number)
    ).all()

    if len(source_lines) != 2:
        return None

    new_sonnet = Sonnet(status="active")
    session.add(new_sonnet)
    session.commit()
    session.refresh(new_sonnet)

    line_1 = Line(
        sonnet_id=new_sonnet.id,
        line_number=1,
        text=source_lines[0].text,
        author_user_id=user_1.id
    )
    session.add(line_1)

    line_14 = Line(
        sonnet_id=new_sonnet.id,
        line_number=14,
        text=source_lines[1].text,
        author_user_id=user_2.id
    )
    session.add(line_14)
    session.commit()

    new_pair = Pair(
        crown_id=crown.id,
        user_1_id=user_1.id,
        user_2_id=user_2.id,
        source_line_start=first_line_num,
        sonnet_id=new_sonnet.id,
        status="writing"
    )
    session.add(new_pair)
    session.commit()
    session.refresh(new_pair)

    user_1.status = "paired"
    user_1.pair_id = new_pair.id
    user_2.status = "paired"
    user_2.pair_id = new_pair.id
    session.add(user_1)
    session.add(user_2)

    turn = Turn(sonnet_id=new_sonnet.id, next_user_id=user_1.id)
    session.add(turn)

    session.commit()

    return new_pair


@app.get("/")
async def landing(request: Request):
    return RedirectResponse("/signup", status_code=303)


@app.get("/signup")
async def signup_page(request: Request, error: str = None):
    return templates.TemplateResponse("signup.html", {
        "request": request,
        "error": error
    })


@app.post("/signup")
async def signup(
    request: Request,
    pen_name: str = Form(...),
    email: Optional[str] = Form(None),
    session: Session = Depends(get_session)
):
    # Input validation
    pen_name = pen_name.strip()
    if not pen_name or len(pen_name) > 100:
        return templates.TemplateResponse("signup.html", {
            "request": request,
            "error": "Pen name must be between 1 and 100 characters."
        })

    if email and len(email) > 254:  # RFC 5321 max email length
        return templates.TemplateResponse("signup.html", {
            "request": request,
            "error": "Email address is too long."
        })

    # Generate secure token (16 bytes = 128 bits of entropy)
    code = secrets.token_urlsafe(16)

    new_user = User(
        email=email if email and email.strip() else None,
        pen_name=pen_name,
        code=code,
        status="waiting"
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    try_pair_users(session)

    # Show the user their secret code before continuing
    return templates.TemplateResponse("your_code.html", {
        "request": request,
        "user": new_user
    })


@app.post("/return")
async def return_to_poem(
    request: Request,
    code: str = Form(...),
    session: Session = Depends(get_session)
):
    # Look up user by their secret code
    user = session.exec(select(User).where(User.code == code.strip())).first()
    if not user:
        return templates.TemplateResponse("signup.html", {
            "request": request,
            "error": "Code not found. Please check your code and try again."
        })

    # Redirect to their poet page
    return RedirectResponse(f"/poet?u={user.code}", status_code=303)


@app.get("/about")
async def about_page(request: Request):
    return templates.TemplateResponse("about.html", {
        "request": request
    })


@app.get("/contributors")
async def contributors_page(request: Request, session: Session = Depends(get_session)):
    """Contributors page - lists all authors with their sonnets"""
    # Get all completed pairs with their users and sonnets
    completed_pairs = session.exec(
        select(Pair)
        .where(Pair.status == "complete")
    ).all()

    # Build author data
    author_map = {}  # pen_name -> {sonnets: [], count: 0}

    for pair in completed_pairs:
        # Get both users
        user_1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
        user_2 = session.exec(select(User).where(User.id == pair.user_2_id)).first() if pair.user_2_id else None

        # Get sonnet first line
        sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first() if pair.sonnet_id else None
        first_line = None
        if sonnet:
            line = session.exec(
                select(Line)
                .where(Line.sonnet_id == sonnet.id)
                .order_by(Line.line_number)
            ).first()
            first_line = line.text if line else None

        sonnet_info = {
            "id": pair.sonnet_id,
            "first_line": first_line or "Untitled",
            "crown_id": pair.crown_id,
            "partner": user_2.pen_name if user_2 else "Unknown"
        }

        # Add to user_1's list
        if user_1:
            if user_1.pen_name not in author_map:
                author_map[user_1.pen_name] = {"sonnets": [], "count": 0}
            sonnet_info_1 = {**sonnet_info, "partner": user_2.pen_name if user_2 else "Unknown"}
            author_map[user_1.pen_name]["sonnets"].append(sonnet_info_1)
            author_map[user_1.pen_name]["count"] += 1

        # Add to user_2's list
        if user_2:
            if user_2.pen_name not in author_map:
                author_map[user_2.pen_name] = {"sonnets": [], "count": 0}
            sonnet_info_2 = {**sonnet_info, "partner": user_1.pen_name if user_1 else "Unknown"}
            author_map[user_2.pen_name]["sonnets"].append(sonnet_info_2)
            author_map[user_2.pen_name]["count"] += 1

    # Convert to sorted list
    authors = [
        {"pen_name": name, "sonnets": data["sonnets"], "count": data["count"]}
        for name, data in author_map.items()
    ]
    authors.sort(key=lambda a: a["pen_name"].lower())

    return templates.TemplateResponse("contributors.html", {
        "request": request,
        "authors": authors,
        "total_authors": len(authors)
    })


@app.get("/poet")
async def poet_home(request: Request, u: str = None, session: Session = Depends(get_session)):
    if not u:
        return RedirectResponse("/signup", status_code=303)

    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup?error=User not found", status_code=303)

    # User is waiting for initial pairing
    if user.status == "waiting":
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    # User marked as inactive (they left completely)
    if user.status == "inactive":
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    # Pair completed
    if pair.status == "complete":
        return RedirectResponse(f"/complete?u={u}", status_code=303)

    # Partner left - show options to remaining user (if they haven't chosen yet)
    # Check if sonnet still exists (means they haven't made a choice)
    if pair.status == "orphaned" and user.id == pair.user_1_id:
        if pair.sonnet_id:
            # Sonnet exists - show options page
            return RedirectResponse(f"/partner-left?u={u}", status_code=303)
        else:
            # User already chose to restart, waiting for new partner
            return templates.TemplateResponse("waiting.html", {
                "request": request,
                "user": user
            })

    # Session expired (pair was abandoned due to timeout)
    if pair.status == "abandoned":
        return RedirectResponse(f"/session-expired?u={u}", status_code=303)

    # User is waiting for new partner (after they made a choice)
    if user.status == "waiting_for_partner":
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    partner_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
    partner = session.exec(select(User).where(User.id == partner_id)).first()

    sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
    if not sonnet:
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet.id)
        .order_by(Line.line_number)
    ).all()

    turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()

    is_my_turn = turn and turn.next_user_id == user.id

    lines_dict = {line.line_number: line for line in lines}
    next_line_number = 2
    for i in range(2, 14):
        if i not in lines_dict:
            next_line_number = i
            break

    lines_written = len([l for l in lines if 1 < l.line_number < 14])
    total_lines_to_write = 12

    display_lines = []
    for i in range(1, 15):
        if i in lines_dict:
            display_lines.append(lines_dict[i])
        else:
            placeholder_line = type('obj', (object,), {
                'line_number': i,
                'text': ''
            })()
            display_lines.append(placeholder_line)

    return templates.TemplateResponse("index.html", {
        "request": request,
        "current_user": user,
        "partner": partner,
        "lines": display_lines,
        "is_my_turn": is_my_turn,
        "next_line_number": next_line_number,
        "sonnet": sonnet,
        "show_celebration": False,
        "lines_written": lines_written,
        "total_lines_to_write": total_lines_to_write
    })


@app.post("/lines")
async def add_line(
    request: Request,
    u: str = Form(...),
    text: str = Form(...),
    session: Session = Depends(get_session)
):
    # Input validation - poem lines should be reasonable length
    text = text.strip()
    if not text or len(text) > 500:
        # Redirect back with the line rejected (too long or empty)
        return RedirectResponse(f"/poet?u={u}", status_code=303)

    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse(f"/poet?u={u}", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse(f"/poet?u={u}", status_code=303)

    sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
    if not sonnet:
        return RedirectResponse(f"/poet?u={u}", status_code=303)

    turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()
    if not turn or turn.next_user_id != user.id:
        return RedirectResponse(f"/poet?u={u}", status_code=303)

    lines = session.exec(
        select(Line).where(Line.sonnet_id == sonnet.id)
    ).all()

    lines_dict = {line.line_number: line for line in lines}
    next_line_number = 2
    for i in range(2, 14):
        if i not in lines_dict:
            next_line_number = i
            break

    new_line = Line(
        sonnet_id=sonnet.id,
        line_number=next_line_number,
        text=text,  # Already stripped in validation above
        author_user_id=user.id
    )
    session.add(new_line)

    if next_line_number == 13:
        sonnet.status = "complete"
        pair.status = "complete"

        completed_pairs_count = session.exec(
            select(Pair)
            .where(Pair.crown_id == pair.crown_id)
            .where(Pair.status == "complete")
        ).all()
        pair.completion_order = len(completed_pairs_count) + 1

        session.add(sonnet)
        session.add(pair)
        session.delete(turn)

        # Check if all 14 pairs are complete - if so, mark Crown as complete
        if len(completed_pairs_count) + 1 == 14:  # +1 because we just completed this pair (14 pairs for true Crown)
            crown = session.exec(select(Crown).where(Crown.id == pair.crown_id)).first()
            if crown:
                crown.status = "complete"
                session.add(crown)

        session.commit()

        # 🌱 Spawn a new SourceSonnet from this completed sonnet
        spawn_source_sonnet_from_completed(sonnet.id, session)

        return RedirectResponse(f"/complete?u={u}", status_code=303)
    else:
        other_user_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
        turn.next_user_id = other_user_id
        session.add(turn)
        session.commit()

    return RedirectResponse(f"/poet?u={u}", status_code=303)


@app.get("/complete")
async def completion_page(request: Request, u: str = None, session: Session = Depends(get_session)):
    if not u:
        return RedirectResponse("/signup", status_code=303)

    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    partner = None
    crown_complete = False

    if pair:
        partner_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
        partner = session.exec(select(User).where(User.id == partner_id)).first()

        # Check if the Crown is complete
        crown = session.exec(select(Crown).where(Crown.id == pair.crown_id)).first()
        if crown and crown.status == "complete":
            crown_complete = True

    return templates.TemplateResponse("complete.html", {
        "request": request,
        "user": user,
        "partner": partner,
        "crown_complete": crown_complete
    })


@app.get("/sonnet/{sonnet_id}")
async def sonnet_view(request: Request, sonnet_id: int, u: str = None, session: Session = Depends(get_session)):
    user = None
    if u:
        user = session.exec(select(User).where(User.code == u)).first()

    sonnet = session.exec(select(Sonnet).where(Sonnet.id == sonnet_id)).first()
    if not sonnet:
        return RedirectResponse("/crown", status_code=303)

    # Get the pair that created this sonnet
    pair = session.exec(select(Pair).where(Pair.sonnet_id == sonnet_id)).first()
    if not pair:
        return RedirectResponse("/crown", status_code=303)

    # Get both authors
    user_1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
    user_2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()

    # Get all lines
    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet_id)
        .order_by(Line.line_number)
    ).all()

    # Get Crown info
    crown = session.exec(select(Crown).where(Crown.id == pair.crown_id)).first()

    # Get source lines that this pair was writing between
    # Handle wrap-around: pair 14 gets lines 14 and 1 (completing the crown)
    second_line = 1 if pair.source_line_start == 14 else pair.source_line_start + 1
    source_lines = session.exec(
        select(SourceLine)
        .where(SourceLine.source_sonnet_id == crown.source_sonnet_id)
        .where(SourceLine.line_number.in_([pair.source_line_start, second_line]))
        .order_by(SourceLine.line_number)
    ).all()

    return templates.TemplateResponse("sonnet.html", {
        "request": request,
        "user": user,
        "sonnet": sonnet,
        "pair": pair,
        "user_1": user_1,
        "user_2": user_2,
        "lines": lines,
        "crown": crown,
        "source_lines": source_lines,
        "source_line_start": pair.source_line_start
    })


# VISUALIZATION API ENDPOINTS

@app.get("/api/crown/{crown_id}/nodes")
async def crown_nodes_api(crown_id: int, session: Session = Depends(get_session)):
    """Return JSON data for Crown visualization"""

    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return JSONResponse({"error": "Crown not found"}, status_code=404)

    source_sonnet = session.exec(
        select(SourceSonnet).where(SourceSonnet.id == crown.source_sonnet_id)
    ).first()

    pairs = session.exec(
        select(Pair)
        .where(Pair.crown_id == crown_id)
        .where(Pair.status == "complete")
        .order_by(Pair.source_line_start)
    ).all()

    nodes = []
    connections = []

    for pair in pairs:
        # Get first and last lines for preview and metadata
        lines = session.exec(
            select(Line)
            .where(Line.sonnet_id == pair.sonnet_id)
            .order_by(Line.line_number)
        ).all()

        first_line = lines[0].text if lines else ""
        last_line = lines[-1].text if lines else ""

        started_at = lines[0].created_at if lines else None
        completed_at = lines[-1].created_at if lines else None
        duration_seconds = None
        if started_at and completed_at:
            duration_seconds = int((completed_at - started_at).total_seconds())

        # Get both authors
        user_1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
        user_2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()

        node = {
            "id": pair.sonnet_id,
            "pair_id": pair.id,
            "position": pair.source_line_start,
            "authors": f"{user_1.pen_name} & {user_2.pen_name}" if user_1 and user_2 else "Unknown",
            "first_line": first_line,
            "last_line": last_line,
            "completion_order": pair.completion_order,
            "line_count": len(lines),
            "started_at": started_at.isoformat() if started_at else None,
            "completed_at": completed_at.isoformat() if completed_at else None,
            "duration_seconds": duration_seconds,
            "lineage_depth": 1,
            "source_line_range": [
                pair.source_line_start,
                1 if pair.source_line_start == 14 else pair.source_line_start + 1
            ]
        }
        nodes.append(node)

        # Create connection to next node (Crown is circular)
        next_position = pair.source_line_start + 1

        # Handle regular connections (1→2, 2→3, ..., 13→14)
        if next_position <= 14:
            next_pair = session.exec(
                select(Pair)
                .where(Pair.crown_id == crown_id)
                .where(Pair.source_line_start == next_position)
            ).first()

            if next_pair:
                connection = {
                    "from": pair.sonnet_id,
                    "to": next_pair.sonnet_id,
                    "shared_line": last_line if lines else ""
                }
                connections.append(connection)

        # Handle Crown closure: connect 14th back to 1st (completing the circle)
        elif pair.source_line_start == 14:
            first_pair = session.exec(
                select(Pair)
                .where(Pair.crown_id == crown_id)
                .where(Pair.source_line_start == 1)
            ).first()

            if first_pair:
                connection = {
                    "from": pair.sonnet_id,
                    "to": first_pair.sonnet_id,
                    "shared_line": last_line if lines else ""
                }
                connections.append(connection)

    # Get source sonnet first line and authors for seed star
    source_first_line = None
    source_authors = None
    if source_sonnet:
        source_lines = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == source_sonnet.id)
            .order_by(SourceLine.line_number)
        ).all()
        if source_lines:
            source_first_line = source_lines[0].text

        # Get authors from parent sonnet if this is a collaborative source
        if source_sonnet.source_type == "collaborative" and source_sonnet.parent_sonnet_id:
            parent_pair = session.exec(
                select(Pair)
                .where(Pair.sonnet_id == source_sonnet.parent_sonnet_id)
            ).first()
            if parent_pair:
                user_1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user_2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()
                if user_1 and user_2:
                    source_authors = f"{user_1.pen_name} & {user_2.pen_name}"
        elif source_sonnet.source_type == "classic":
            source_authors = "Lady Mary Wroth"

    return {
        "crown_id": crown_id,
        "status": crown.status,
        "source_title": source_sonnet.title if source_sonnet else "Unknown",
        "source_first_line": source_first_line,
        "source_authors": source_authors,
        "total_nodes": len(nodes),
        "nodes": nodes,
        "connections": connections
    }


@app.get("/api/crown/{crown_id}/stats")
async def crown_stats_api(crown_id: int, session: Session = Depends(get_session)):
    """Return Crown statistics for visualization"""

    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return JSONResponse({"error": "Crown not found"}, status_code=404)

    pairs = session.exec(
        select(Pair).where(Pair.crown_id == crown_id)
    ).all()

    completed_pairs = [p for p in pairs if p.status == "complete"]

    return {
        "crown_id": crown_id,
        "status": crown.status,
        "total_pairs": len(pairs),
        "completed_pairs": len(completed_pairs),
        "completion_percentage": (len(completed_pairs) / 14) * 100 if completed_pairs else 0,
        "is_complete": len(completed_pairs) == 14
    }


@app.get("/api/crown/{crown_id}/context")
async def crown_context_api(crown_id: int, session: Session = Depends(get_session)):
    """Return Crown with full genealogical context for fractal navigation"""

    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return JSONResponse({"error": "Crown not found"}, status_code=404)

    # Get source sonnet
    source_sonnet = session.exec(
        select(SourceSonnet).where(SourceSonnet.id == crown.source_sonnet_id)
    ).first()

    source_first_line = None
    source_authors = None
    if source_sonnet:
        first_line_obj = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == source_sonnet.id)
            .where(SourceLine.line_number == 1)
        ).first()
        if first_line_obj:
            source_first_line = first_line_obj.text

        # Get authors based on source type
        if source_sonnet.source_type == "classic":
            # For classic source sonnet, use author name
            source_authors = "Lady Mary Wroth"
        elif source_sonnet.source_type == "collaborative" and source_sonnet.parent_sonnet_id:
            # For collaborative, get the parent sonnet's authors
            parent_pair = session.exec(
                select(Pair).where(Pair.sonnet_id == source_sonnet.parent_sonnet_id)
            ).first()
            if parent_pair:
                user1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()
                if user1 and user2:
                    source_authors = f"{user1.pen_name} & {user2.pen_name}"

    # Get pairs for completion progress
    pairs = session.exec(select(Pair).where(Pair.crown_id == crown_id)).all()
    completed_pairs = [p for p in pairs if p.status == "complete"]

    # Parent info (if this Crown has a parent)
    parent_info = None
    if crown.parent_sonnet_id:
        parent_sonnet = session.exec(
            select(Sonnet).where(Sonnet.id == crown.parent_sonnet_id)
        ).first()

        if parent_sonnet:
            # Get parent Crown
            parent_pair = session.exec(
                select(Pair).where(Pair.sonnet_id == parent_sonnet.id)
            ).first()

            if parent_pair:
                parent_crown = session.exec(
                    select(Crown).where(Crown.id == parent_pair.crown_id)
                ).first()

                # Get authors
                user1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()

                # Get sonnet first line
                parent_first_line = session.exec(
                    select(Line)
                    .where(Line.sonnet_id == parent_sonnet.id)
                    .where(Line.line_number == 1)
                ).first()

                parent_info = {
                    "crown_id": parent_crown.id if parent_crown else None,
                    "sonnet_id": parent_sonnet.id,
                    "sonnet_title": parent_first_line.text[:40] + "..." if parent_first_line else "Untitled",
                    "authors": f"{user1.pen_name} & {user2.pen_name}" if user1 and user2 else "Unknown",
                    "generation": parent_crown.generation if parent_crown else 0
                }

    # Children info (Crowns spawned from this Crown's sonnets)
    children_info = []

    # Get all completed sonnets in this Crown
    completed_sonnet_ids = [p.sonnet_id for p in completed_pairs]

    # Find Crowns that have these sonnets as parents
    child_crowns = session.exec(
        select(Crown)
        .where(Crown.parent_sonnet_id.in_(completed_sonnet_ids))
    ).all()

    for child_crown in child_crowns:
        # Find which sonnet spawned this
        parent_pair = session.exec(
            select(Pair)
            .where(Pair.sonnet_id == child_crown.parent_sonnet_id)
            .where(Pair.crown_id == crown_id)
        ).first()

        # Get child Crown stats
        child_pairs = session.exec(
            select(Pair).where(Pair.crown_id == child_crown.id)
        ).all()
        child_completed = [p for p in child_pairs if p.status == "complete"]

        children_info.append({
            "crown_id": child_crown.id,
            "sonnet_id": child_crown.parent_sonnet_id,
            "sonnet_position": parent_pair.completion_order if parent_pair else None,
            "status": child_crown.status,
            "completion": f"{len(child_completed)}/14",
            "generation": child_crown.generation
        })

    # Get current Crown's nodes (existing endpoint logic)
    nodes_response = await crown_nodes_api(crown_id, session)

    return {
        "crown": {
            "id": crown.id,
            "generation": crown.generation,
            "status": crown.status,
            "completion_progress": f"{len(completed_pairs)}/14",
            "created_at": crown.created_at.isoformat()
        },
        "source": {
            "id": source_sonnet.id if source_sonnet else None,
            "title": source_sonnet.title if source_sonnet else "Unknown",
            "type": source_sonnet.source_type if source_sonnet else "classic",
            "first_line": source_first_line,
            "authors": source_authors
        },
        "parent": parent_info,
        "children": children_info,
        "nodes": nodes_response.get("nodes", []),
        "connections": nodes_response.get("connections", [])
    }


@app.get("/api/sonnet/{sonnet_id}/lines")
async def sonnet_lines_api(sonnet_id: int, session: Session = Depends(get_session)):
    """Return all lines of a specific sonnet for poetry revelation"""

    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == sonnet_id)
        .order_by(Line.line_number)
    ).all()

    if not lines:
        return JSONResponse({"error": "Sonnet not found"}, status_code=404)

    # Get pair info for authors
    pair = session.exec(
        select(Pair).where(Pair.sonnet_id == sonnet_id)
    ).first()

    authors = ""
    if pair:
        user1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
        user2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()
        if user1 and user2:
            authors = f"{user1.pen_name} & {user2.pen_name}"

    started_at = lines[0].created_at if lines else None
    completed_at = lines[-1].created_at if lines else None

    return {
        "sonnet_id": sonnet_id,
        "authors": authors,
        "lines": [{"number": line.line_number, "text": line.text} for line in lines],
        "total_lines": len(lines),
        "position_in_crown": pair.source_line_start if pair else None,
        "started_at": started_at.isoformat() if started_at else None,
        "completed_at": completed_at.isoformat() if completed_at else None
    }


@app.get("/api/crown/{crown_id}/scroll")
async def crown_scroll_api(crown_id: int, session: Session = Depends(get_session)):
    """API endpoint for scroll view data"""
    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return JSONResponse({"error": f"Crown {crown_id} not found"}, status_code=404)

    source_sonnet = session.exec(
        select(SourceSonnet).where(SourceSonnet.id == crown.source_sonnet_id)
    ).first()

    # Get seed first line and authors
    seed_first_line = None
    seed_authors = None
    if source_sonnet:
        first_line_obj = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == source_sonnet.id)
            .where(SourceLine.line_number == 1)
        ).first()

        if source_sonnet.source_type == "classic":
            seed_first_line = source_sonnet.title
            seed_authors = "Ted Berrigan"
        elif source_sonnet.source_type == "collaborative" and source_sonnet.parent_sonnet_id:
            seed_first_line = first_line_obj.text if first_line_obj else None
            parent_pair = session.exec(
                select(Pair).where(Pair.sonnet_id == source_sonnet.parent_sonnet_id)
            ).first()
            if parent_pair:
                user1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()
                if user1 and user2:
                    seed_authors = f"{user1.pen_name} & {user2.pen_name}"

    # Get completed pairs/sonnets
    pairs = session.exec(
        select(Pair)
        .where(Pair.crown_id == crown.id)
        .where(Pair.status == "complete")
        .order_by(Pair.source_line_start)
    ).all()

    sonnets = []
    for pair in pairs:
        lines = session.exec(
            select(Line)
            .where(Line.sonnet_id == pair.sonnet_id)
            .order_by(Line.line_number)
        ).all()

        user_1 = session.exec(select(User).where(User.id == pair.user_1_id)).first()
        user_2 = session.exec(select(User).where(User.id == pair.user_2_id)).first()

        if not user_1 or not user_2:
            continue

        sonnets.append({
            "id": pair.sonnet_id,
            "authors": f"{user_1.pen_name} & {user_2.pen_name}",
            "lines": [
                {"text": line.text, "is_source": line.line_number in [1, 14]}
                for line in lines
            ]
        })

    # Calculate completion
    pairs_with_sonnets = len(pairs)
    total_pairs = 14
    completion = f"{pairs_with_sonnets}/{total_pairs}"

    return {
        "crown_id": crown_id,
        "status": crown.status,
        "completion": completion,
        "seed_first_line": seed_first_line,
        "seed_authors": seed_authors,
        "generation": crown.generation if crown.generation else 1,
        "sonnets": sonnets
    }


@app.get("/crown/{crown_id}/visualize")
async def crown_visualization(request: Request, crown_id: int, u: str = None, session: Session = Depends(get_session)):
    """Crown visualization page"""
    user = None
    if u:
        user = session.exec(select(User).where(User.code == u)).first()

    # Get all available crowns and find max ID
    available_crowns = session.exec(select(Crown)).all()
    max_crown_id = max((c.id for c in available_crowns), default=1)

    # Verify the requested crown exists
    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return templates.TemplateResponse("crown_visualization.html", {
            "request": request,
            "crown_id": 1,  # Default to Crown 1
            "max_crown_id": max_crown_id,
            "available_crowns": available_crowns,
            "user": user
        })

    return templates.TemplateResponse("crown_visualization.html", {
        "request": request,
        "crown_id": crown_id,
        "max_crown_id": max_crown_id,
        "available_crowns": available_crowns,
        "user": user
    })


# ============================================
# ABORT/RESET FLOW ENDPOINTS
# ============================================

def get_poem_lines_for_display(pair, session):
    """Get lines formatted for display in reset pages."""
    if not pair or not pair.sonnet_id:
        return []

    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == pair.sonnet_id)
        .order_by(Line.line_number)
    ).all()

    lines_dict = {line.line_number: line for line in lines}

    display_lines = []
    for i in range(1, 15):
        if i in lines_dict:
            display_lines.append(lines_dict[i])
        else:
            placeholder = type('obj', (object,), {
                'line_number': i,
                'text': ''
            })()
            display_lines.append(placeholder)

    return display_lines


@app.get("/confirm-leave")
async def confirm_leave_page(request: Request, u: str, session: Session = Depends(get_session)):
    """Page shown when user clicks 'Leave collaboration'"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    lines = get_poem_lines_for_display(pair, session)

    return templates.TemplateResponse("confirm_leave.html", {
        "request": request,
        "user": user,
        "lines": lines
    })


@app.get("/partner-left")
async def partner_left_page(request: Request, u: str, session: Session = Depends(get_session)):
    """Page shown when user's partner has left (pair is orphaned)"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    lines = get_poem_lines_for_display(pair, session)

    return templates.TemplateResponse("partner_left.html", {
        "request": request,
        "user": user,
        "lines": lines
    })


@app.get("/session-expired")
async def session_expired_page(request: Request, u: str, session: Session = Depends(get_session)):
    """Page shown when user returns after 12h timeout"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    return templates.TemplateResponse("session_expired.html", {
        "request": request,
        "user": user
    })


@app.get("/goodbye")
async def goodbye_page(request: Request):
    """Friendly goodbye page"""
    return templates.TemplateResponse("goodbye.html", {
        "request": request
    })


@app.post("/abort")
async def abort_collaboration(
    request: Request,
    u: str = Form(...),
    action: str = Form(...),
    session: Session = Depends(get_session)
):
    """User initiates leaving their collaboration"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user or not user.pair_id:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    # Get the other user (partner)
    partner_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
    partner = session.exec(select(User).where(User.id == partner_id)).first()

    # Mark pair as orphaned (partner can continue with new user)
    pair.status = "orphaned"

    # Make the partner user_1 (the one waiting for new partner)
    if partner:
        pair.user_1_id = partner.id
        pair.user_2_id = None
        partner.status = "waiting_for_partner"
        session.add(partner)

    # Reset the leaving user
    user.status = "waiting" if action == "waiting" else "inactive"
    user.pair_id = None
    session.add(user)
    session.add(pair)

    # Note: We keep the sonnet/lines for the partner-left page to show
    # They will be deleted when the partner makes their choice

    session.commit()

    if action == "waiting":
        # Try to pair them immediately
        try_pair_users(session)
        return RedirectResponse(f"/poet?u={u}", status_code=303)
    else:
        return RedirectResponse("/goodbye", status_code=303)


@app.post("/restart-same-lines")
async def restart_same_lines(
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    """Remaining user wants to restart with same bookend lines"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user or not user.pair_id:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    # Delete existing sonnet and lines
    if pair.sonnet_id:
        sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
        if sonnet:
            lines = session.exec(select(Line).where(Line.sonnet_id == sonnet.id)).all()
            for line in lines:
                session.delete(line)
            turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()
            if turn:
                session.delete(turn)
            session.delete(sonnet)

    # Keep pair as orphaned, user waits for new partner
    pair.status = "orphaned"
    pair.sonnet_id = None
    pair.user_1_id = user.id
    pair.user_2_id = None

    user.status = "waiting_for_partner"

    session.add(pair)
    session.add(user)
    session.commit()

    # Try to fill the vacancy
    try_pair_users(session)

    return RedirectResponse(f"/poet?u={u}", status_code=303)


@app.post("/restart-new-lines")
async def restart_new_lines(
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    """User wants completely fresh start with new lines"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user or not user.pair_id:
        return RedirectResponse("/signup", status_code=303)

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return RedirectResponse("/signup", status_code=303)

    # Delete existing sonnet and lines
    if pair.sonnet_id:
        sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
        if sonnet:
            lines = session.exec(select(Line).where(Line.sonnet_id == sonnet.id)).all()
            for line in lines:
                session.delete(line)
            turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()
            if turn:
                session.delete(turn)
            session.delete(sonnet)

    # Mark pair as abandoned (slot freed for backfill)
    pair.status = "abandoned"
    session.add(pair)

    # Reset user to waiting
    user.status = "waiting"
    user.pair_id = None
    session.add(user)

    session.commit()

    # Try to pair them with someone
    try_pair_users(session)

    return RedirectResponse(f"/poet?u={u}", status_code=303)


@app.post("/leave-completely")
async def leave_completely(
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    """User wants to exit entirely"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/goodbye", status_code=303)

    pair = None
    if user.pair_id:
        pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()

    if pair:
        # Delete existing sonnet and lines
        if pair.sonnet_id:
            sonnet = session.exec(select(Sonnet).where(Sonnet.id == pair.sonnet_id)).first()
            if sonnet:
                lines = session.exec(select(Line).where(Line.sonnet_id == sonnet.id)).all()
                for line in lines:
                    session.delete(line)
                turn = session.exec(select(Turn).where(Turn.sonnet_id == sonnet.id)).first()
                if turn:
                    session.delete(turn)
                session.delete(sonnet)

        # Mark pair as abandoned
        pair.status = "abandoned"
        session.add(pair)

    # Reset user
    user.status = "inactive"
    user.pair_id = None
    session.add(user)

    session.commit()

    return RedirectResponse("/goodbye", status_code=303)


@app.post("/rejoin")
async def rejoin_waiting(
    u: str = Form(...),
    session: Session = Depends(get_session)
):
    """User rejoins waiting room after session expired"""
    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup", status_code=303)

    user.status = "waiting"
    user.pair_id = None
    session.add(user)
    session.commit()

    # Try to pair immediately
    try_pair_users(session)

    return RedirectResponse(f"/poet?u={u}", status_code=303)


# ============================================
# FRACTAL COSMOS VISUALIZATION API
# ============================================

def romanize(num: int) -> str:
    """Convert number to Roman numeral."""
    roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV']
    return roman[num - 1] if 1 <= num <= 14 else str(num)


@app.get("/api/fractal/tree")
async def fractal_tree_api(session: Session = Depends(get_session)):
    """
    Return the complete fractal tree structure for cosmos visualization.
    Maps database to the format expected by fractal-cosmos.js

    Optimized to use batch queries instead of N+1 pattern.
    """
    import math

    # === BATCH FETCH ALL DATA UPFRONT ===

    # Get all crowns
    crowns = session.exec(
        select(Crown).order_by(Crown.generation, Crown.id)
    ).all()

    if not crowns:
        return {"crowns": [], "originalSeed": None}

    # Get all source sonnets and build lookup
    all_source_sonnets = session.exec(select(SourceSonnet)).all()
    source_sonnet_lookup = {ss.id: ss for ss in all_source_sonnets}

    # Get all source lines and group by source_sonnet_id
    all_source_lines = session.exec(
        select(SourceLine).order_by(SourceLine.source_sonnet_id, SourceLine.line_number)
    ).all()
    source_lines_by_sonnet = {}
    for sl in all_source_lines:
        if sl.source_sonnet_id not in source_lines_by_sonnet:
            source_lines_by_sonnet[sl.source_sonnet_id] = []
        source_lines_by_sonnet[sl.source_sonnet_id].append(sl)

    # Get all pairs and group by crown_id
    all_pairs = session.exec(select(Pair)).all()
    pairs_by_crown = {}
    pairs_by_sonnet_id = {}
    for pair in all_pairs:
        if pair.crown_id not in pairs_by_crown:
            pairs_by_crown[pair.crown_id] = []
        pairs_by_crown[pair.crown_id].append(pair)
        if pair.sonnet_id:
            pairs_by_sonnet_id[pair.sonnet_id] = pair

    # Get all users and build lookup
    all_users = session.exec(select(User)).all()
    user_lookup = {u.id: u for u in all_users}

    # Get all lines and group by sonnet_id
    all_lines = session.exec(
        select(Line).order_by(Line.sonnet_id, Line.line_number)
    ).all()
    lines_by_sonnet = {}
    for line in all_lines:
        if line.sonnet_id not in lines_by_sonnet:
            lines_by_sonnet[line.sonnet_id] = []
        lines_by_sonnet[line.sonnet_id].append(line)

    # Get all sonnets and build lookup
    all_sonnets = session.exec(select(Sonnet)).all()
    sonnet_lookup = {s.id: s for s in all_sonnets}

    # Build crown lookup for child crown detection
    crown_by_source_sonnet = {c.source_sonnet_id: c for c in crowns}

    # === BUILD ORIGINAL SEED ===

    original_source = next(
        (ss for ss in all_source_sonnets if ss.source_type == "classic"),
        None
    )

    original_seed = None
    if original_source:
        source_lines = source_lines_by_sonnet.get(original_source.id, [])
        original_seed = {
            "title": original_source.title,
            "author": "Lady Mary Wroth",
            "lines": [sl.text for sl in source_lines]
        }

    # === CALCULATE POSITIONS ===

    def calculate_positions(crowns_list):
        positions = {}
        gen_counts = {}

        for crown in crowns_list:
            gen = crown.generation
            gen_counts[gen] = gen_counts.get(gen, 0) + 1

        gen_indices = {}
        for crown in crowns_list:
            gen = crown.generation
            if gen not in gen_indices:
                gen_indices[gen] = 0

            if gen == 1:
                positions[crown.id] = (0, 0)
            else:
                count_in_gen = gen_counts[gen]
                idx = gen_indices[gen]
                angle = (idx / max(count_in_gen, 1)) * 2 * math.pi - math.pi / 2
                radius = 350 * (gen - 1)
                x = math.cos(angle) * radius + (idx % 2) * 50
                y = math.sin(angle) * radius + ((idx + 1) % 2) * 50
                positions[crown.id] = (x, y)

            gen_indices[gen] += 1

        return positions

    positions = calculate_positions(crowns)

    # === BUILD CROWN DATA (no additional queries!) ===

    crown_data = []

    for crown in crowns:
        source_sonnet = source_sonnet_lookup.get(crown.source_sonnet_id)
        source_lines = source_lines_by_sonnet.get(crown.source_sonnet_id, [])

        # Build seed source info
        seed_source = {"type": "original", "title": "", "author": ""}
        parent_sonnet_data = None

        if source_sonnet:
            if source_sonnet.source_type == "classic":
                seed_source = {
                    "type": "original",
                    "title": source_sonnet.title,
                    "author": "Lady Mary Wroth"
                }
            elif source_sonnet.parent_sonnet_id:
                parent_pair = pairs_by_sonnet_id.get(source_sonnet.parent_sonnet_id)

                if parent_pair:
                    user1 = user_lookup.get(parent_pair.user_1_id)
                    user2 = user_lookup.get(parent_pair.user_2_id)
                    parent_lines = lines_by_sonnet.get(source_sonnet.parent_sonnet_id, [])

                    parent_sonnet_data = {
                        "id": f"crown-{parent_pair.crown_id}-sonnet-{parent_pair.source_line_start}",
                        "title": f"Sonnet {romanize(parent_pair.source_line_start)}",
                        "authors": f"{user1.pen_name} & {user2.pen_name}" if user1 and user2 else "Unknown",
                        "lines": [l.text for l in parent_lines]
                    }

                    seed_source = {
                        "type": "sonnet",
                        "parentSonnetId": parent_sonnet_data["id"],
                        "parentSonnetTitle": parent_sonnet_data["title"]
                    }

        # Get pairs for this crown (already filtered and sorted)
        crown_pairs = [
            p for p in pairs_by_crown.get(crown.id, [])
            if p.sonnet_id is not None
        ]
        crown_pairs.sort(key=lambda p: p.source_line_start)

        sonnets_data = []
        for pair in crown_pairs:
            user1 = user_lookup.get(pair.user_1_id)
            user2 = user_lookup.get(pair.user_2_id) if pair.user_2_id else None
            sonnet_lines = lines_by_sonnet.get(pair.sonnet_id, [])

            first_line_num = pair.source_line_start
            second_line_num = 1 if first_line_num == 14 else first_line_num + 1

            seed_line_a = ""
            seed_line_b = ""
            for sl in source_lines:
                if sl.line_number == first_line_num:
                    seed_line_a = sl.text
                if sl.line_number == second_line_num:
                    seed_line_b = sl.text

            # Check if this sonnet spawned a child crown
            sonnet_obj = sonnet_lookup.get(pair.sonnet_id)
            spawns_child = None
            if sonnet_obj and sonnet_obj.spawned_source_sonnet_id:
                child_crown = crown_by_source_sonnet.get(sonnet_obj.spawned_source_sonnet_id)
                if child_crown:
                    spawns_child = f"crown-{child_crown.id}"

            sonnet_status = "complete" if pair.status == "complete" else "forming"

            sonnets_data.append({
                "id": f"crown-{crown.id}-sonnet-{pair.source_line_start}",
                "position": pair.source_line_start,
                "title": f"Sonnet {romanize(pair.source_line_start)}",
                "authors": f"{user1.pen_name} & {user2.pen_name}" if user1 and user2 else (user1.pen_name if user1 else "Unknown"),
                "status": sonnet_status,
                "seedLines": {
                    "lineA": seed_line_a,
                    "lineB": seed_line_b,
                    "indices": f"{first_line_num}-{second_line_num}"
                },
                "spawnsChild": spawns_child,
                "lines": [l.text for l in sonnet_lines],
                "sonnetId": pair.sonnet_id
            })

        x, y = positions.get(crown.id, (0, 0))

        crown_data.append({
            "id": f"crown-{crown.id}",
            "name": f"Crown {romanize(crown.id)}" if crown.id <= 14 else f"Crown {crown.id}",
            "generation": crown.generation,
            "status": crown.status,
            "x": x,
            "y": y,
            "seedSource": seed_source,
            "parentSonnet": parent_sonnet_data,
            "sonnets": sonnets_data,
            "crownId": crown.id
        })

    return {
        "crowns": crown_data,
        "originalSeed": original_seed
    }


@app.get("/cosmos")
async def cosmos_view(request: Request, session: Session = Depends(get_session)):
    """Fractal Cosmos visualization page"""
    return templates.TemplateResponse("fractal_cosmos.html", {
        "request": request
    })


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@app.post("/admin/reset")
async def admin_reset_database(
    key: str = Query(..., description="Admin secret key"),
    session: Session = Depends(get_session)
):
    """
    Reset and reseed the database. Requires ADMIN_SECRET env var.

    Usage: curl -X POST "https://psny-mayday.onrender.com/admin/reset?key=YOUR_SECRET"
    """
    admin_secret = os.getenv("ADMIN_SECRET")

    if not admin_secret:
        return JSONResponse(
            status_code=500,
            content={"error": "ADMIN_SECRET not configured on server"}
        )

    if key != admin_secret:
        return JSONResponse(
            status_code=403,
            content={"error": "Invalid admin key"}
        )

    try:
        # Truncate all tables in correct order (respecting foreign keys)
        # Using raw SQL for CASCADE support
        # SQLModel creates lowercase table names: SourceSonnet -> sourcesonnet
        from database import engine
        with engine.connect() as conn:
            conn.execute(text('TRUNCATE line, sonnet, pair, "user", sourceline, crown, sourcesonnet RESTART IDENTITY CASCADE'))
            conn.commit()

        # Re-seed with Lady Mary Wroth's poem
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

        logger.info("Database reset and reseeded successfully")

        return JSONResponse(content={
            "success": True,
            "message": "Database reset and reseeded",
            "seed_poem": {
                "title": source_sonnet.title,
                "author": "Lady Mary Wroth",
                "lines": len(lines)
            },
            "crown_id": crown.id
        })

    except Exception as e:
        logger.error(f"Database reset failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Reset failed: {str(e)}"}
        )
