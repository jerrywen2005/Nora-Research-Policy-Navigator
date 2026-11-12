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
    # The two referral offices the Link chose (Jeanne, 2026-11-12): research questions Nora
    # can't answer go to RCS, and questions that aren't about research to the Policy Office.
    # Their names are looked up in app/rag/answer.py.
    "rcs": {
        "name": "Research Compliance Services",
        "email": "rcs@unc.edu",
        "phone": None,
        "url": None,
    },
    "upo": {
        "name": "University Policy Office",
        "email": None,
        "phone": None,
        "url": "https://universitypolicy.unc.edu/about/contact/",
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

# The Link's policy inventory: every policy Nora uses, with its Repository category, responsible
# unit, tags and full text (headings kept as Markdown). Built by scripts/build_policy_inventory.py
# from the Link's spreadsheet; rebuild it rather than editing it by hand.
DOCUMENTS_FILE = Path(__file__).parent / "data" / "policy_inventory.json"

# Repository category (as the inventory names it) -> topic slug.
CATEGORY_TOPICS = {
    "Human Research Ethics and IRB": "human-subjects-research",
    "Clinical Research": "clinical-research",
    "Conflict of Interest": "conflict-of-interest",
    "Research Integrity": "research-integrity",
    "Sponsored Programs": "sponsored-programs",
    "Research Operations": "research-operations",
    "Animal Care and Use and IACUC": "animal-care-and-use",
    "International Research and Research Security": "international-research-and-security",
    "Postdoctoral Affairs": "postdoctoral-affairs",
}

# Responsible unit (as the inventory records it) -> office. A policy with no unit gets its
# topic's office.
UNIT_OFFICES = {
    "Office of Human Research Ethics (OHRE)": "ohre",
    "Office of Sponsored Programs": "osp",
    "Office of Sponsored Programs, Cost Analysis and Compliance": "osp",
    "Office of Animal Care and Use": "oacu",
    "Conflict of Interest Office, OVCR Research Compliance services": "coi",
    "UNC Export Compliance Office": "export",
    "Office of Postdoctoral Affairs": "opa",
    "Office of the Vice Chancellor for Research": "ovcr",
    "Office of Vice Chancellor for Research": "ovcr",
    "Office of the Vice Chancellor for Research (OVCR)": "ovcr",
    "Office of the Vice Chancellor for Research – Clinical Research Operations": "ovcr",
    "Science and Security Program, Office of the Vice Chancellor for Research": "ovcr",
    "OVCR Compliance": "ovcr",
    "Clinical Research Compliance": "ovcr",
    "CTQA, Clinical Research Compliance Office": "ovcr",
}

# Earlier seeds stored this form of the same article URL; matching it too means re-seeding an
# existing database updates those rows instead of duplicating them.
LEGACY_URL = "https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID={}"


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

    topic_offices = {t["slug"]: t["office"] for t in SEED_TOPICS}
    for data in load_seed_documents():
        urls = [data["source_url"], LEGACY_URL.format(data["article_id"])]
        document = session.scalars(
            select(Document).where(Document.source_url.in_(urls))
        ).one_or_none()
        if document is None:
            document = Document()
            session.add(document)
        topic_slug = CATEGORY_TOPICS[data["category"]]
        office_key = UNIT_OFFICES.get(data["responsible_unit"]) or topic_offices[topic_slug]
        document.source_url = data["source_url"]
        document.title = data["title"]
        document.doc_type = data["doc_type"]
        document.citation = data["citation"]
        document.summary = data["summary"]
        document.content_text = data["content_text"]
        document.content_hash = hashlib.sha256(data["content_text"].encode()).hexdigest()
        document.office = offices[office_key]
        document.topics = [topics[topic_slug]]
        document.status = DocumentStatus.ACTIVE
        document.is_authoritative = True
    session.flush()
