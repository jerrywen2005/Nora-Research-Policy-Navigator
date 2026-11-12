"""Write usage events for the admin dashboard, without ever breaking the request being logged."""

import logging

from sqlalchemy.orm import Session

from app.models import EventType, UsageEvent, User

log = logging.getLogger(__name__)


def log_event(session: Session, user: User | None, event_type: EventType, **fields) -> None:
    """Record one usage event and commit it. Never raises.

    Call it after the endpoint's own work is done, because it commits the session: GET endpoints
    don't commit, so the event would otherwise be lost. `fields` are UsageEvent columns
    (topic_id, document_id, query, result_count); a search `query` is stored trimmed and
    lowercased so the same term from different people counts together.
    """
    if fields.get("query") is not None:
        fields["query"] = fields["query"].strip().lower()
    try:
        # A savepoint, so a failed insert undoes only the event, not the caller's work.
        with session.begin_nested():
            session.add(
                UsageEvent(user_id=user.id if user else None, event_type=event_type, **fields)
            )
    except Exception:
        log.exception("Couldn't log a %s event", event_type)
        return
    try:
        session.commit()
    except Exception:
        log.exception("Couldn't commit a %s event", event_type)
        session.rollback()
