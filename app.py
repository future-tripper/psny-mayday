from fastapi import FastAPI, Request, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_session
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

    if len(existing_pairs) >= 13:
        return None

    user_1 = waiting_users[0]
    user_2 = waiting_users[1]

    pair_number = len(existing_pairs) + 1
    first_line_num = pair_number
    second_line_num = pair_number + 1

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
        session.add(sonnet)
        session.add(pair)
        session.delete(turn)
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
    if pair:
        partner_id = pair.user_2_id if user.id == pair.user_1_id else pair.user_1_id
        partner = session.exec(select(User).where(User.id == partner_id)).first()

    return templates.TemplateResponse("complete.html", {
        "request": request,
        "user": user,
        "partner": partner
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
            "lines": [{"text": line.text, "is_source": line.line_number in [1, 14]} for line in lines],
            "authors": f"{user_1.pen_name} & {user_2.pen_name}"
        }
        crown_sonnets.append(sonnet_data)

    return templates.TemplateResponse("crown.html", {
        "request": request,
        "user": user,
        "crown": crown,
        "source_sonnet": source_sonnet,
        "crown_sonnets": crown_sonnets,
        "pairs_with_sonnets": len(pairs)
    })