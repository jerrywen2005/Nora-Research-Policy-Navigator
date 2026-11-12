from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.analytics import dashboard
from app.auth import require_role
from app.db import get_session
from app.models import Role
from app.schemas.analytics import Analytics

# Admin only (401 signed out, 403 researcher). Aggregates only: see app/analytics/dashboard.py.
router = APIRouter(tags=["analytics"], dependencies=[Depends(require_role(Role.ADMIN))])

SessionDep = Annotated[Session, Depends(get_session)]


def date_range(
    from_: Annotated[
        date | None, Query(alias="from", description="First day, inclusive (YYYY-MM-DD)")
    ] = None,
    to: Annotated[date | None, Query(description="Last day, inclusive (YYYY-MM-DD)")] = None,
) -> tuple[date, date]:
    """The requested days in UNC's time zone. Defaults to the last 30 days, ending today."""
    end = to or dashboard.today()
    start = from_ or end - timedelta(days=29)
    if end < start:
        raise HTTPException(422, "`to` is before `from`")
    if (end - start).days + 1 > dashboard.MAX_RANGE_DAYS:
        raise HTTPException(
            422,
            f"The range can be at most {dashboard.MAX_RANGE_DAYS} days",
        )
    return start, end


DateRange = Annotated[tuple[date, date], Depends(date_range)]


@router.get("/admin/analytics", response_model=Analytics)
def get_analytics(days: DateRange, session: SessionDep) -> Analytics:
    """Every dashboard measure for the range (product.md measures 1-9)."""
    return dashboard.compute(session, *days)
