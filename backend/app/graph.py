"""LangGraph pipeline: analyse the post -> generate comment options -> review & top-up.

    START -> analyze -> generate -> review --(enough comments or out of attempts)--> END
                           ^                  |
                           +---(missing)------+
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Callable, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, START, StateGraph

from .prompts import LENGTH_GUIDE, TONE_GUIDE, analysis_prompt, generation_prompt
from .schemas import CommentBatch, CommentOption, GenerateRequest, PostAnalysis

LLMFactory = Callable[[str, float], BaseChatModel]

MAX_GENERATION_ATTEMPTS = 3
SIMILARITY_THRESHOLD = 0.8


class CommentState(TypedDict, total=False):
    request: GenerateRequest
    model: str
    analysis: PostAnalysis
    candidates: list[CommentOption]
    comments: list[CommentOption]
    attempts: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _author(req: GenerateRequest) -> str:
    if not req.author_name:
        return "Unknown"
    return f"{req.author_name} ({req.author_headline})" if req.author_headline else req.author_name


def _media(req: GenerateRequest) -> str:
    return f"Attached media: {req.media_description}\n" if req.media_description else ""


def _bullets(items: list[str]) -> str:
    return "; ".join(items) if items else "n/a"


_HASHTAG_RE = re.compile(r"(?<!\w)#\w+")
_WS_RE = re.compile(r"[ \t]+")
_QUOTE_PAIRS = [('"', '"'), ("“", "”"), ("'", "'")]


def clean_comment(text: str) -> str:
    """Normalise a generated comment so it's ready to post."""
    t = text.strip()
    # Leading list markers such as "1.", "2)", "- ".
    t = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s+", "", t)
    for left, right in _QUOTE_PAIRS:
        if len(t) > 2 and t.startswith(left) and t.endswith(right):
            t = t[1:-1].strip()
    t = _HASHTAG_RE.sub("", t)
    # Em/en dashes read as AI-written on LinkedIn; swap for a comma.
    t = re.sub(r"\s*[—–]\s*", ", ", t)
    t = re.sub(r",\s*,", ",", t)
    t = _WS_RE.sub(" ", t)
    t = re.sub(r"\s+([,.!?])", r"\1", t)
    return t.strip()


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower())


def _is_duplicate(text: str, existing: list[CommentOption]) -> bool:
    norm = _normalise(text)
    return any(
        SequenceMatcher(None, norm, _normalise(c.text)).ratio() >= SIMILARITY_THRESHOLD for c in existing
    )


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------
def build_graph(llm_factory: LLMFactory, analysis_temperature: float = 0.2, generation_temperature: float = 0.85):
    async def analyze(state: CommentState) -> CommentState:
        req = state["request"]
        llm = llm_factory(state["model"], analysis_temperature).with_structured_output(PostAnalysis)
        analysis = await (analysis_prompt | llm).ainvoke(
            {"author": _author(req), "media": _media(req), "post_text": req.post_text}
        )
        return {"analysis": analysis, "comments": [], "attempts": 0}

    async def generate(state: CommentState) -> CommentState:
        req = state["request"]
        a = state["analysis"]
        kept = state.get("comments", [])
        needed = req.count - len(kept)

        feedback = ""
        if kept:
            existing = "\n".join(f"- [{c.angle}] {c.text}" for c in kept)
            feedback = (
                f"\nThese options already exist. Write {needed} NEW options with different angles "
                f"and wording from them:\n{existing}\n"
            )

        llm = llm_factory(state["model"], generation_temperature).with_structured_output(CommentBatch)
        batch = await (generation_prompt | llm).ainvoke(
            {
                "count": needed,
                "tone_guide": TONE_GUIDE[req.tone],
                "length_guide": LENGTH_GUIDE[req.length],
                "emoji_rule": (
                    "At most one relevant emoji per comment, and only where it feels natural."
                    if req.use_emojis
                    else "Do not use any emojis."
                ),
                "persona_block": f"\nThe commenter: {req.persona}\n" if req.persona else "",
                "instructions_block": f"\nExtra instructions from the commenter: {req.instructions}\n"
                if req.instructions
                else "",
                "author": _author(req),
                "media": _media(req),
                "post_text": req.post_text,
                "summary": a.summary,
                "post_type": a.post_type,
                "author_intent": a.author_intent,
                "sentiment": a.sentiment,
                "key_points": _bullets(a.key_points),
                "specific_details": _bullets(a.specific_details),
                "comment_angles": _bullets(a.comment_angles),
                "feedback": feedback,
            }
        )
        return {"candidates": batch.comments, "attempts": state.get("attempts", 0) + 1}

    def review(state: CommentState) -> CommentState:
        req = state["request"]
        kept = list(state.get("comments", []))
        for cand in state.get("candidates", []):
            if len(kept) >= req.count:
                break
            text = clean_comment(cand.text)
            if len(text) < 3 or _is_duplicate(text, kept):
                continue
            angle = cand.angle.strip().strip(".") or "Comment"
            kept.append(CommentOption(angle=angle[:40], text=text))
        return {"comments": kept, "candidates": []}

    def route_after_review(state: CommentState) -> str:
        if len(state["comments"]) >= state["request"].count:
            return END
        if state.get("attempts", 0) >= MAX_GENERATION_ATTEMPTS:
            return END
        return "generate"

    graph = StateGraph(CommentState)
    graph.add_node("analyze", analyze)
    graph.add_node("generate", generate)
    graph.add_node("review", review)
    graph.add_edge(START, "analyze")
    graph.add_edge("analyze", "generate")
    graph.add_edge("generate", "review")
    graph.add_conditional_edges("review", route_after_review, ["generate", END])
    return graph.compile()
