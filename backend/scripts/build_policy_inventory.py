"""Build app/seed/data/policy_inventory.json from the Link's policy and tag inventory.

The Link keeps the list of policies Nora uses, and their tags, in a spreadsheet
(Nora_Policy_Tag_Inventory_*.xlsx). This script reads its Master Inventory sheet, downloads each
policy from the UNC Policies knowledge base, keeps the text's headings as Markdown (chunking
splits on them), and writes one JSON file the seed loads offline.

Re-run it when the Link sends a new inventory or the policies change, then commit the JSON:

    pip install -e ".[data]"
    python scripts/build_policy_inventory.py path/to/Nora_Policy_Tag_Inventory.xlsx [--reuse-text]

Not part of the app: it only runs by hand, so it isn't covered by the test suite.
"""

import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from bs4 import BeautifulSoup

OUTPUT = Path(__file__).resolve().parent.parent / "app" / "seed" / "data" / "policy_inventory.json"
SHEET = "Master Inventory"
# The knowledge base article body; everything else on the page is navigation.
BODY_ID = "ctl00_ctl00_cpContent_cpContent_divBody"
BLOCKS = ["h2", "h3", "h4", "h5", "p", "li", "tr"]
SUMMARY_CHARS = 300

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def read_sheet(path: str, name: str) -> list[dict[str, str]]:
    """Rows of one sheet as dicts keyed by the header row. Uses only the standard library."""
    book = zipfile.ZipFile(path)
    shared = [
        "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
        for si in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", NS)
    ]
    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.get("Id"): rel.get("Target").lstrip("/") for rel in rels}
    sheet = next(s for s in workbook.find("m:sheets", NS) if s.get("name") == name)
    target = targets[sheet.get(f"{{{NS['r']}}}id")]
    root = ET.fromstring(book.read(target if target.startswith("xl/") else f"xl/{target}"))

    rows = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        cells = {}
        for cell in row.findall("m:c", NS):
            value = cell.find("m:v", NS)
            if value is None:
                continue
            text = shared[int(value.text)] if cell.get("t") == "s" else value.text
            column = re.match(r"[A-Z]+", cell.get("r")).group()
            cells[column] = (text or "").strip()
        rows.append(cells)
    header = rows[0]
    return [{header[col]: row.get(col, "") for col in header} for row in rows[1:] if row]


def html_to_markdown(html: str) -> str:
    """The article body as Markdown: headings as #, list items as -, table rows joined by |."""
    body = BeautifulSoup(html, "html.parser").find(id=BODY_ID)
    if body is None:
        return ""
    lines = []
    for element in body.find_all(BLOCKS):
        # A <p> inside an <li> is part of that item; skip it so it isn't repeated.
        if element.find_parent(BLOCKS):
            continue
        text = " ".join(element.get_text(" ", strip=True).split())
        if not text:
            continue
        if element.name.startswith("h"):
            lines.append("\n" + "#" * int(element.name[1]) + " " + text)
        elif element.name == "li":
            lines.append("- " + text)
        elif element.name == "tr":
            cells = element.find_all(["td", "th"])
            lines.append(" | ".join(" ".join(c.get_text(" ", strip=True).split()) for c in cells))
        else:
            lines.append(text)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Nora-inventory-builder/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode("utf-8", errors="replace")
        except OSError:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def doc_type(title: str) -> str:
    if re.search(r"\bSOP\b", title):
        return "sop"
    if title.endswith("Standard"):
        return "standard"
    # "... Procedure" or "OSP - 900.01, Procedure 1 - ..."
    if re.search(r"\bProcedure(\s+\d+)?\b", title) and "Policy" not in title.split("Procedure")[0]:
        return "procedure"
    return "policy"


def citation(title: str) -> str | None:
    """The official number in a title, which people search for: "OHRE SOP 0501", "OSP 200.03"."""
    if match := re.search(r"Office of Human Research Ethics SOP (\d+)", title):
        return f"OHRE SOP {match.group(1)}"
    if match := re.search(r"Office of Sponsored Programs\s*-\s*(\d+(?:\.\d+)*)", title):
        return f"OSP {match.group(1)}"
    return None


def title_section(markdown: str) -> set[str]:
    """Lines under the page's "## Title" heading, which only repeat the title."""
    lines, inside = set(), False
    for line in markdown.splitlines():
        if line.startswith("#"):
            inside = line.lstrip("# ").strip() == "Title"
        elif inside:
            lines.add(line.strip())
    return lines


def summary(markdown: str) -> str | None:
    """The first real paragraph after the title, cut at a word boundary."""
    skip = title_section(markdown)
    for line in markdown.splitlines():
        line = line.strip()
        if line in skip:
            continue
        if len(line) > 60 and not line.startswith(("#", "-", "|")) and " | " not in line:
            if len(line) <= SUMMARY_CHARS:
                return line
            return line[:SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"
    return None


def main(xlsx: str, reuse_text: bool) -> None:
    # Keep the summaries and citations already in the file: some were written by hand.
    previous = {}
    if OUTPUT.exists():
        for doc in json.loads(OUTPUT.read_text(encoding="utf-8")):
            previous[str(doc["article_id"])] = doc

    policies = []
    rows = read_sheet(xlsx, SHEET)
    for n, row in enumerate(rows, start=1):
        article_id = row["Article ID"]
        title = row["Document Title"]
        print(f"[{n}/{len(rows)}] {article_id} {title[:70]}", flush=True)
        old = previous.get(article_id, {})
        if reuse_text and old.get("content_text"):
            text = old["content_text"]
        else:
            text = html_to_markdown(fetch(row["Direct Article Link"]))
            time.sleep(1)  # be polite to policies.unc.edu
        # A previous summary is hand-written unless it's what we'd derive or just the title.
        derived = summary(text)
        written = old.get("summary")
        if written in title_section(text) or written == title:
            written = None
        policies.append(
            {
                "article_id": int(article_id),
                "title": title,
                "doc_type": doc_type(title),
                "citation": old.get("citation") or citation(title),
                "source_url": row["Direct Article Link"],
                "category": row["Repository Category"],
                "responsible_unit": row["Responsible Unit (Previously Recorded)"] or None,
                "tags": [row[f"Policy Tag {i}"] for i in range(1, 6) if row[f"Policy Tag {i}"]],
                "summary": written or derived,
                "content_text": text,
            }
        )

    policies.sort(key=lambda p: p["article_id"])
    OUTPUT.write_text(json.dumps(policies, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    empty = [p["article_id"] for p in policies if not p["content_text"]]
    print(f"Wrote {len(policies)} policies to {OUTPUT}. Without body text: {empty or 'none'}")


if __name__ == "__main__":
    # --reuse-text keeps the text already in the JSON and only re-reads the spreadsheet, for when
    # the Link changes tags or titles but the policies themselves haven't changed.
    main(sys.argv[1], reuse_text="--reuse-text" in sys.argv[2:])
