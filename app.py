from fastapi import FastAPI, Request, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select
from database import get_session
from visualization_dev.viz_database import get_viz_session
from models import User, Sonnet, Line, Turn, Crown, Pair, SourceSonnet, SourceLine
import secrets

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


def try_pair_users(session: Session):
    waiting_users = session.exec(
        select(User).where(User.status == "waiting").order_by(User.id)
    ).all()

    if len(waiting_users) < 2:
        return None

    crown = session.exec(select(Crown).where(Crown.status == "forming")).first()
    if not crown:
        return None

    existing_pairs = session.exec(
        select(Pair).where(Pair.crown_id == crown.id)
    ).all()

    if len(existing_pairs) >= 14:  # Allow 14 pairs for true Crown
        return None

    user_1 = waiting_users[0]
    user_2 = waiting_users[1]

    assigned_line_starts = {pair.source_line_start for pair in existing_pairs}

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
    email: str = Form(...),
    pen_name: str = Form(...),
    session: Session = Depends(get_session)
):
    existing_user = session.exec(select(User).where(User.email == email)).first()
    if existing_user:
        return RedirectResponse(f"/poet?u={existing_user.code}", status_code=303)

    code = secrets.token_urlsafe(8)

    new_user = User(
        email=email,
        pen_name=pen_name,
        code=code,
        status="waiting"
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    try_pair_users(session)

    return RedirectResponse(f"/poet?u={new_user.code}", status_code=303)


@app.get("/about")
async def about_page(request: Request):
    return templates.TemplateResponse("about.html", {
        "request": request
    })


@app.get("/poet")
async def poet_home(request: Request, u: str = None, session: Session = Depends(get_session)):
    if not u:
        return RedirectResponse("/signup", status_code=303)

    user = session.exec(select(User).where(User.code == u)).first()
    if not user:
        return RedirectResponse("/signup?error=User not found", status_code=303)

    if user.status == "waiting":
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    pair = session.exec(select(Pair).where(Pair.id == user.pair_id)).first()
    if not pair:
        return templates.TemplateResponse("waiting.html", {
            "request": request,
            "user": user
        })

    if pair.status == "complete":
        return RedirectResponse(f"/complete?u={u}", status_code=303)

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
        text=text.strip(),
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
    source_lines = session.exec(
        select(SourceLine)
        .where(SourceLine.source_sonnet_id == crown.source_sonnet_id)
        .where(SourceLine.line_number.in_([pair.source_line_start, pair.source_line_start + 1]))
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


@app.get("/crown")
async def crown_view(request: Request, u: str = None, session: Session = Depends(get_session)):
    user = None
    if u:
        user = session.exec(select(User).where(User.code == u)).first()

    crown = session.exec(select(Crown)).first()
    if not crown:
        return templates.TemplateResponse("crown.html", {
            "request": request,
            "user": user,
            "error": "No crown found"
        })

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
        if first_line_obj:
            seed_first_line = first_line_obj.text

        # Get authors based on source type
        if source_sonnet.source_type == "classic":
            seed_authors = source_sonnet.title
        elif source_sonnet.source_type == "collaborative" and source_sonnet.parent_sonnet_id:
            parent_pair = session.exec(
                select(Pair).where(Pair.sonnet_id == source_sonnet.parent_sonnet_id)
            ).first()
            if parent_pair:
                user1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()
                if user1 and user2:
                    seed_authors = f"{user1.pen_name} & {user2.pen_name}"

    pairs = session.exec(
        select(Pair)
        .where(Pair.crown_id == crown.id)
        .where(Pair.status == "complete")
        .order_by(Pair.source_line_start)
    ).all()

    crown_sonnets = []
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

        sonnet_data = {
            "sonnet_id": pair.sonnet_id,
            "pair_id": pair.id,
            "source_line_start": pair.source_line_start,
            "lines": [{"text": line.text, "is_source": line.line_number in [1, 14]} for line in lines],
            "authors": f"{user_1.pen_name} & {user_2.pen_name}"
        }
        crown_sonnets.append(sonnet_data)

    return templates.TemplateResponse("crown.html", {
        "request": request,
        "user": user,
        "crown": crown,
        "source_sonnet": source_sonnet,
        "seed_first_line": seed_first_line,
        "seed_authors": seed_authors,
        "crown_sonnets": crown_sonnets,
        "pairs_with_sonnets": len(pairs)
    })


@app.get("/crown/{crown_id}")
async def crown_view_by_id(request: Request, crown_id: int, u: str = None, session: Session = Depends(get_viz_session)):
    """Crown scroll view for specific crown ID"""
    user = None
    if u:
        user = session.exec(select(User).where(User.code == u)).first()

    crown = session.exec(select(Crown).where(Crown.id == crown_id)).first()
    if not crown:
        return templates.TemplateResponse("crown.html", {
            "request": request,
            "user": user,
            "error": f"Crown {crown_id} not found"
        })

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
        if first_line_obj:
            seed_first_line = first_line_obj.text

        # Get authors based on source type
        if source_sonnet.source_type == "classic":
            seed_authors = source_sonnet.title
        elif source_sonnet.source_type == "collaborative" and source_sonnet.parent_sonnet_id:
            parent_pair = session.exec(
                select(Pair).where(Pair.sonnet_id == source_sonnet.parent_sonnet_id)
            ).first()
            if parent_pair:
                user1 = session.exec(select(User).where(User.id == parent_pair.user_1_id)).first()
                user2 = session.exec(select(User).where(User.id == parent_pair.user_2_id)).first()
                if user1 and user2:
                    seed_authors = f"{user1.pen_name} & {user2.pen_name}"

    pairs = session.exec(
        select(Pair)
        .where(Pair.crown_id == crown.id)
        .where(Pair.status == "complete")
        .order_by(Pair.source_line_start)
    ).all()

    crown_sonnets = []
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

        sonnet_data = {
            "sonnet_id": pair.sonnet_id,
            "pair_id": pair.id,
            "source_line_start": pair.source_line_start,
            "lines": [{"text": line.text, "is_source": line.line_number in [1, 14]} for line in lines],
            "authors": f"{user_1.pen_name} & {user_2.pen_name}"
        }
        crown_sonnets.append(sonnet_data)

    return templates.TemplateResponse("crown.html", {
        "request": request,
        "user": user,
        "crown": crown,
        "source_sonnet": source_sonnet,
        "seed_first_line": seed_first_line,
        "seed_authors": seed_authors,
        "crown_sonnets": crown_sonnets,
        "pairs_with_sonnets": len(pairs)
    })


# VISUALIZATION API ENDPOINTS (uses viz_database for testing)

@app.get("/api/crown/{crown_id}/nodes")
async def crown_nodes_api(crown_id: int, session: Session = Depends(get_viz_session)):
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

    # Get source sonnet first line for seed star
    source_first_line = None
    if source_sonnet:
        source_lines = session.exec(
            select(SourceLine)
            .where(SourceLine.source_sonnet_id == source_sonnet.id)
            .order_by(SourceLine.line_number)
        ).all()
        if source_lines:
            source_first_line = source_lines[0].text

    return {
        "crown_id": crown_id,
        "status": crown.status,
        "source_title": source_sonnet.title if source_sonnet else "Unknown",
        "source_first_line": source_first_line,
        "total_nodes": len(nodes),
        "nodes": nodes,
        "connections": connections
    }


@app.get("/api/crown/{crown_id}/stats")
async def crown_stats_api(crown_id: int, session: Session = Depends(get_viz_session)):
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
async def crown_context_api(crown_id: int, session: Session = Depends(get_viz_session)):
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
            # For classic poems, use the title as author indicator (e.g., "Percy Shelley")
            # Extract author from title if formatted as "Title by Author" or use title
            source_authors = source_sonnet.title  # For now use title, can be enhanced
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
async def sonnet_lines_api(sonnet_id: int, session: Session = Depends(get_viz_session)):
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


@app.get("/crown/{crown_id}/visualize")
async def crown_visualization(request: Request, crown_id: int, u: str = None, session: Session = Depends(get_session)):
    """Crown visualization page"""
    user = None
    if u:
        user = session.exec(select(User).where(User.code == u)).first()

    # Read the HTML file directly
    import os
    html_path = os.path.join("visualization_dev", "crown_viz.html")
    with open(html_path, "r") as f:
        html_content = f.read()

    # Simple template replacement for crown_id and user
    html_content = html_content.replace("{{ crown_id }}", str(crown_id))
    if u:
        html_content = html_content.replace('href="/crown/1"', f'href="/crown/1?u={u}"')
        html_content = html_content.replace('href="/crown"', f'href="/crown?u={u}"')

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)
