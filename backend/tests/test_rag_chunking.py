from app.rag.chunking import (
    MAX_CHUNK_WORDS,
    Chunk,
    chunk_markdown,
    context_header,
    split_long,
)


def words(n: int, word: str = "word") -> str:
    return " ".join([word] * n)


def test_chunks_follow_the_heading_path_and_skip_the_title_section():
    markdown = "\n".join(
        [
            "Text before any heading is dropped.",
            "## Title",
            "The Policy Title",
            "## 1. Purpose",
            "Why this policy exists.",
            "## 2. Procedure",
            "### 2.1 Initial Determination",
            "First step.",
            "- a list item",
            "### 2.2 Review",
            "Second step.",
            "## 3. Contacts",
            "",
            "Office of Research.",
        ]
    )

    assert chunk_markdown(markdown) == [
        Chunk("1. Purpose", "Why this policy exists."),
        Chunk("2. Procedure > 2.1 Initial Determination", "First step.\n- a list item"),
        Chunk("2. Procedure > 2.2 Review", "Second step."),
        Chunk("3. Contacts", "Office of Research."),
    ]


def test_a_heading_with_no_text_makes_no_chunk():
    assert chunk_markdown("## Empty\n## Full\nText.") == [Chunk("Full", "Text.")]


def test_long_sections_split_at_paragraphs_with_one_paragraph_of_overlap():
    # The short middle paragraph is repeated at the start of the second piece.
    paragraphs = [words(150, "a"), words(90, "b"), words(150, "c")]

    pieces = split_long(paragraphs)

    assert pieces == ["\n".join(paragraphs[:2]), "\n".join(paragraphs[1:])]
    assert all(len(piece.split()) <= MAX_CHUNK_WORDS for piece in pieces)


def test_a_long_paragraph_is_not_repeated_as_overlap():
    paragraphs = [words(200, "a"), words(200, "b")]

    assert split_long(paragraphs) == paragraphs


def test_context_header():
    assert (
        context_header("Export Controls Policy", "2. Scope") == "Export Controls Policy > 2. Scope"
    )
