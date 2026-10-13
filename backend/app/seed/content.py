import hashlib
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus, Office, Topic

# Real, public contact details for each office, taken from research.unc.edu, osp.unc.edu and the
# policies themselves (checked 2026-10-12). Only general office contacts, never individuals.
SEED_OFFICES = {
    "ovcr": {
        "name": "Office of the Vice Chancellor for Research",
        "email": None,
        "phone": None,
        "url": "https://research.unc.edu/",
    },
    "ohre": {
        "name": "Office of Human Research Ethics",
        "email": "irb_questions@unc.edu",
        "phone": "919-966-3113",
        "url": "https://research.unc.edu/human-research-ethics/",
    },
    "oct": {
        "name": "Office of Clinical Trials",
        "email": "oct@unc.edu",
        "phone": "919-843-2698",
        "url": None,
    },
    "coi": {
        "name": "Conflict of Interest Office",
        "email": "coi@unc.edu",
        "phone": "919-843-9953",
        "url": "https://research.unc.edu/compliance/coi/contact/",
    },
    "osp": {
        "name": "Office of Sponsored Programs",
        "email": "SponsoredPrograms@unc.edu",
        "phone": "919-966-3411",
        "url": "https://osp.unc.edu/",
    },
    "oacu": {
        "name": "Office of Animal Care and Use",
        "email": "iacuc@med.unc.edu",
        "phone": "919-966-5569",
        "url": "https://research.unc.edu/iacuc/",
    },
    "export": {
        "name": "Export Compliance Office",
        "email": "exportcontrol@unc.edu",
        "phone": None,
        "url": "https://research.unc.edu/compliance/export-controls/",
    },
    "opa": {
        "name": "Office of Postdoctoral Affairs",
        "email": "opa@unc.edu",
        "phone": "919-962-9982",
        "url": "https://research.unc.edu/postdocs/",
    },
}

# The nine categories of the Research section of the UNC Policies knowledge base
# (https://policies.unc.edu/TDClient/2833/Portal/KB/Category/21680/Research), named as in the
# client mockup. Listed in display order.
SEED_TOPICS = [
    {
        "slug": "human-subjects-research",
        "name": "Human Research & IRB",
        "description": "IRB review, consent, and protections for research participants.",
        "office": "ohre",
    },
    {
        "slug": "clinical-research",
        "name": "Clinical Research",
        "description": "Clinical trial approval, billing, and study conduct.",
        "office": "oct",
    },
    {
        "slug": "conflict-of-interest",
        "name": "Conflict of Interest",
        "description": "Disclosing outside interests and managing conflicts.",
        "office": "coi",
    },
    {
        "slug": "research-integrity",
        "name": "Research Integrity",
        "description": "Responsible conduct of research and research misconduct.",
        "office": "ovcr",
    },
    {
        "slug": "sponsored-programs",
        "name": "Sponsored Programs",
        "description": "Proposals, awards, and managing externally funded projects.",
        "office": "osp",
    },
    {
        "slug": "research-operations",
        "name": "Research Operations",
        "description": "Research data, core facilities, and day-to-day research administration.",
        "office": "ovcr",
    },
    {
        "slug": "animal-care-and-use",
        "name": "Animal Care & Use",
        "description": "IACUC protocols and the humane use of animals in research.",
        "office": "oacu",
    },
    {
        "slug": "international-research-and-security",
        "name": "International Research & Security",
        "description": "Export controls, foreign collaboration, and research security.",
        "office": "export",
    },
    {
        "slug": "postdoctoral-affairs",
        "name": "Postdoctoral Affairs",
        "description": "Appointments, policies, and resources for postdoctoral scholars.",
        "office": "opa",
    },
]

# Full text of selected public policies from the knowledge base above, with their topics and
# office. Regenerate or extend it by hand; each entry is keyed by its source_url.
DOCUMENTS_FILE = Path(__file__).parent / "data" / "research_policies.json"


def load_seed_documents() -> list[dict]:
    return json.loads(DOCUMENTS_FILE.read_text(encoding="utf-8"))


def seed_content(session: Session) -> None:
    """Create or update the seed offices, topics and documents. Safe to run repeatedly.

    Does not commit. Rows are matched by office name, topic slug and document source_url.
    """
    offices: dict[str, Office] = {}
    for key, data in SEED_OFFICES.items():
        office = session.scalars(select(Office).where(Office.name == data["name"])).one_or_none()
        if office is None:
            office = Office(name=data["name"])
            session.add(office)
        office.email = data["email"]
        office.phone = data["phone"]
        office.url = data["url"]
        offices[key] = office

    topics: dict[str, Topic] = {}
    for sort_order, data in enumerate(SEED_TOPICS, start=1):
        topic = session.scalars(select(Topic).where(Topic.slug == data["slug"])).one_or_none()
        if topic is None:
            topic = Topic(slug=data["slug"])
            session.add(topic)
        topic.name = data["name"]
        topic.description = data["description"]
        topic.default_office = offices[data["office"]]
        topic.sort_order = sort_order
        topic.is_active = True
        topics[data["slug"]] = topic

    for data in load_seed_documents():
        document = session.scalars(
            select(Document).where(Document.source_url == data["source_url"])
        ).one_or_none()
        if document is None:
            document = Document(source_url=data["source_url"])
            session.add(document)
        document.title = data["title"]
        document.doc_type = data["doc_type"]
        document.citation = data["citation"]
        document.summary = data["summary"]
        document.content_text = data["content_text"]
        document.content_hash = hashlib.sha256(data["content_text"].encode()).hexdigest()
        document.office = offices[data["office"]]
        document.topics = [topics[slug] for slug in data["topics"]]
        document.status = DocumentStatus.ACTIVE
        document.is_authoritative = True
    session.flush()
