from collections.abc import Callable

import groq
import httpx
import pytest
from fastapi.testclient import TestClient
from langchain_core.runnables import RunnableLambda

from app.graph import clean_comment
from app.main import create_app
from app.schemas import CommentBatch, CommentOption, PostAnalysis

POST = (
    "After 3 years of building our data platform on Airflow, we migrated 400 DAGs to Dagster in 6 weeks. "
    "Biggest lesson: asset-based thinking changed how our analysts talk to engineers."
)

ANALYSIS = PostAnalysis(
    summary="Team migrated 400 DAGs from Airflow to Dagster in 6 weeks.",
    post_type="Lesson learned",
    author_intent="Share a migration lesson",
    sentiment="proud",
    key_points=["400 DAGs migrated", "6 weeks", "asset-based thinking"],
    specific_details=["Airflow", "Dagster", "400 DAGs"],
    comment_angles=["Ask about tests", "Share experience", "Congratulate"],
)


class FakeLLM:
    """Stands in for ChatGroq: returns scripted structured outputs and records prompts."""

    def __init__(self, batches: list[list[CommentOption]], error: Exception | None = None):
        self.batches = batches
        self.error = error
        self.prompts: list[str] = []
        self.models: list[tuple[str, float]] = []

    def factory(self, model: str, temperature: float) -> "FakeLLM":
        self.models.append((model, temperature))
        return self

    def with_structured_output(self, schema: type) -> RunnableLambda:
        def run(prompt_value) -> object:
            self.prompts.append(prompt_value.to_string())
            if self.error:
                raise self.error
            if schema is PostAnalysis:
                return ANALYSIS
            assert schema is CommentBatch
            return CommentBatch(comments=self.batches.pop(0))

        return RunnableLambda(run)


def make_client(fake: FakeLLM) -> TestClient:
    return TestClient(create_app(llm_factory=fake.factory, require_api_key=False))


def opt(angle: str, text: str) -> CommentOption:
    return CommentOption(angle=angle, text=text)


def test_generate_happy_path():
    fake = FakeLLM(
        [[
            opt("Ask a question", "How did you handle backfills for 400 DAGs in only 6 weeks?"),
            opt("Share experience", "We moved to Dagster last year and the asset graph made lineage reviews so much easier."),
            opt("Congratulate", "Six weeks for 400 DAGs is a seriously fast migration, nice work."),
        ]]
    )
    r = make_client(fake).post("/api/generate", json={"post_text": POST, "count": 3, "tone": "curious", "author_name": "Priya"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["comments"]) == 3
    assert body["analysis"]["post_type"] == "Lesson learned"
    assert body["model"] == "llama-3.3-70b-versatile"
    gen_prompt = fake.prompts[1]
    assert "Priya" in gen_prompt and "Genuinely curious" in gen_prompt and "Write exactly 3" in gen_prompt


def test_duplicates_trigger_top_up_loop():
    fake = FakeLLM(
        [
            [
                opt("Insight", "Asset-based thinking really does change the analyst conversation."),
                opt("Insight", "Asset based thinking really does change the analyst conversation!"),  # near-duplicate
            ],
            [opt("Question", "Did you run Airflow and Dagster side by side during the cutover?")],
        ]
    )
    r = make_client(fake).post("/api/generate", json={"post_text": POST, "count": 2})
    assert r.status_code == 200, r.text
    texts = [c["text"] for c in r.json()["comments"]]
    assert len(texts) == 2 and "side by side" in texts[1]
    # Third prompt is the top-up: asks for just 1 more and lists the existing option.
    assert "Write exactly 1" in fake.prompts[2] and "already exist" in fake.prompts[2]


def test_stops_after_max_attempts_with_partial_results():
    same = opt("Insight", "Asset-based thinking really does change the analyst conversation.")
    fake = FakeLLM([[same], [same], [same]])
    r = make_client(fake).post("/api/generate", json={"post_text": POST, "count": 3})
    assert r.status_code == 200
    assert len(r.json()["comments"]) == 1
    assert len(fake.prompts) == 4  # analyse + 3 generation attempts


def test_rate_limit_maps_to_429():
    err = groq.RateLimitError("slow down", response=httpx.Response(429, request=httpx.Request("POST", "http://x")), body=None)
    r = make_client(FakeLLM([], error=err)).post("/api/generate", json={"post_text": POST})
    assert r.status_code == 429
    assert "rate limit" in r.json()["detail"]


def test_missing_api_key_returns_503(monkeypatch):
    from app import main

    monkeypatch.setattr(main.get_settings(), "groq_api_key", "")
    client = TestClient(create_app(llm_factory=FakeLLM([]).factory, require_api_key=True))
    r = client.post("/api/generate", json={"post_text": POST})
    assert r.status_code == 503
    assert client.get("/health").json()["groq_configured"] is False


@pytest.mark.parametrize("payload", [{"post_text": "   hi   "}, {"post_text": POST, "count": 9}, {"post_text": POST, "tone": "angry"}])
def test_validation_errors(payload):
    r = make_client(FakeLLM([])).post("/api/generate", json=payload)
    assert r.status_code == 422


@pytest.mark.parametrize(
    "raw,expected",
    [
        ('"Love the 6 week timeline"', "Love the 6 week timeline"),
        ("1. Solid migration #dataengineering #dagster", "Solid migration"),
        ("Fast work — really impressive", "Fast work, really impressive"),
        ("Nice  result ,  well done", "Nice result, well done"),
    ],
)
def test_clean_comment(raw: str, expected: str):
    assert clean_comment(raw) == expected


def test_cors_allows_extension_origin():
    r = make_client(FakeLLM([])).options(
        "/api/generate",
        headers={"Origin": "chrome-extension://abcdef", "Access-Control-Request-Method": "POST"},
    )
    assert r.headers.get("access-control-allow-origin") == "chrome-extension://abcdef"
