"""Split a policy's Markdown into retrievable chunks. Design: docs/rag.md, "Pipeline requirements".

Each chunk is one section, or part of a long one, and never cuts a paragraph. It carries its
heading path ("2. Procedure > 2.1 Initial Determination") so it makes sense on its own and can be
cited by section.
"""

import re
from dataclasses import dataclass

# About 400 tokens. Long sections are split at paragraph boundaries to stay under this.
MAX_CHUNK_WORDS = 300
# The last paragraph of a split piece is repeated at the start of the next, unless it's this long.
MAX_OVERLAP_WORDS = 100
# Every page starts with a "Title" section that only repeats the title; it isn't chunked.
TITLE_SECTION = "Title"

HEADING = re.compile(r"(#+) (.*)")


@dataclass(frozen=True)
class Chunk:
    section: str  # heading path, e.g. "2. Procedure > 2.1 Initial Determination"
    text: str  # the section's paragraphs, one per line


def split_long(paragraphs: list[str]) -> list[str]:
    """Pack paragraphs into pieces of at most MAX_CHUNK_WORDS, never cutting a paragraph.

    Each piece starts with the last paragraph of the previous one, a small overlap, so a sentence
    that depends on the paragraph before it still has its context.
    """
    pieces: list[str] = []
    current: list[str] = []
    for paragraph in paragraphs:
        if current and len(" ".join([*current, paragraph]).split()) > MAX_CHUNK_WORDS:
            pieces.append("\n".join(current))
            overlap = current[-1]
            current = [overlap] if len(overlap.split()) < MAX_OVERLAP_WORDS else []
        current.append(paragraph)
    if current:
        pieces.append("\n".join(current))
    return pieces


def chunk_markdown(markdown: str) -> list[Chunk]:
    """Split on headings. A section that fits is one chunk; a long one is split into several."""
    chunks: list[Chunk] = []
    path: list[tuple[int, str]] = []
    paragraphs: list[str] = []

    def flush() -> None:
        if paragraphs and path and path[-1][1] != TITLE_SECTION:
            section = " > ".join(title for _, title in path)
            chunks.extend(Chunk(section, piece) for piece in split_long(paragraphs))
        paragraphs.clear()

    for line in markdown.splitlines():
        if heading := HEADING.match(line):
            flush()
            level = len(heading.group(1))
            path = [(lvl, title) for lvl, title in path if lvl < level]
            path.append((level, heading.group(2).strip()))
        elif line.strip():
            paragraphs.append(line.strip())
    flush()
    return chunks


def context_header(document_title: str, section: str) -> str:
    """What a chunk is about, prepended before embedding and keyword indexing."""
    return f"{document_title} > {section}"
