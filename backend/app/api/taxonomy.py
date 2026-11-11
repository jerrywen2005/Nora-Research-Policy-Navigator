"""Lists for pickers: every tag and every office. Any signed-in user may read them."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_session
from app.models import Office, Tag
from app.schemas.content import OfficeOut, TagOut

router = APIRouter(tags=["taxonomy"], dependencies=[Depends(get_current_user)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/tags", response_model=list[TagOut])
def list_tags(session: SessionDep) -> list[Tag]:
    return list(session.scalars(select(Tag).order_by(Tag.name)))


@router.get("/offices", response_model=list[OfficeOut])
def list_offices(session: SessionDep) -> list[Office]:
    return list(session.scalars(select(Office).order_by(Office.name)))
