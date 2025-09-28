from fastapi import FastAPI, Request, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_session
from models import User, Sonnet, Line, Turn

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@app.get("/")
async def home(request: Request, u: str = None, session: Session = Depends(get_session)):
    if not u:
        return templates.TemplateResponse("index.html", {
            "request": request,
            "error": "Please add ?u=ALPHA or ?u=BETA to the URL"
        })

    current_user = session.exec(select(User).where(User.code == u)).first()
    if not current_user:
        return templates.TemplateResponse("index.html", {
            "request": request,
            "error": f"User code '{u}' not found"
        })

    active_sonnet = session.exec(select(Sonnet).where(Sonnet.status == "active")).first()
    if not active_sonnet:
        return templates.TemplateResponse("index.html", {
            "request": request,
            "error": "No active sonnet found"
        })

    lines = session.exec(
        select(Line)
        .where(Line.sonnet_id == active_sonnet.id)
        .order_by(Line.line_number)
    ).all()

    turn = session.exec(select(Turn).where(Turn.sonnet_id == active_sonnet.id)).first()

    is_my_turn = turn and turn.next_user_id == current_user.id
    next_line_number = len(lines) + 1

    return templates.TemplateResponse("index.html", {
        "request": request,
        "current_user": current_user,
        "lines": lines,
        "is_my_turn": is_my_turn,
        "next_line_number": next_line_number,
        "sonnet": active_sonnet
    })


@app.post("/lines")
async def add_line(
    request: Request,
    u: str = Form(...),
    text: str = Form(...),
    session: Session = Depends(get_session)
):
    current_user = session.exec(select(User).where(User.code == u)).first()
    if not current_user:
        return RedirectResponse(f"/?u={u}", status_code=303)

    active_sonnet = session.exec(select(Sonnet).where(Sonnet.status == "active")).first()
    if not active_sonnet:
        return RedirectResponse(f"/?u={u}", status_code=303)

    turn = session.exec(select(Turn).where(Turn.sonnet_id == active_sonnet.id)).first()

    if not turn or turn.next_user_id != current_user.id:
        return RedirectResponse(f"/?u={u}", status_code=303)

    lines = session.exec(
        select(Line).where(Line.sonnet_id == active_sonnet.id)
    ).all()
    next_line_number = len(lines) + 1

    new_line = Line(
        sonnet_id=active_sonnet.id,
        line_number=next_line_number,
        text=text.strip(),
        author_user_id=current_user.id
    )
    session.add(new_line)

    if next_line_number == 14:
        active_sonnet.status = "complete"
        session.add(active_sonnet)

        new_sonnet = Sonnet(status="active")
        session.add(new_sonnet)
        session.commit()
        session.refresh(new_sonnet)

        first_line_of_new = Line(
            sonnet_id=new_sonnet.id,
            line_number=1,
            text=text.strip(),
            author_user_id=current_user.id
        )
        session.add(first_line_of_new)

        all_users = session.exec(select(User)).all()
        other_user = [u for u in all_users if u.id != current_user.id][0]

        new_turn = Turn(sonnet_id=new_sonnet.id, next_user_id=other_user.id)
        session.add(new_turn)

        session.delete(turn)
    else:
        all_users = session.exec(select(User)).all()
        other_user = [u for u in all_users if u.id != current_user.id][0]

        turn.next_user_id = other_user.id
        session.add(turn)

    session.commit()

    return RedirectResponse(f"/?u={u}", status_code=303)