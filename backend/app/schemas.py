"""Request/response models and the structured-output schemas used by the LLM."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Tone = Literal[
    "professional",
    "friendly",
    "supportive",
    "insightful",
    "curious",
    "witty",
    "celebratory",
]
Length = Literal["short", "medium", "long"]


# ---------------------------------------------------------------------------
# API models
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    post_text: str = Field(..., min_length=1, max_length=12_000)
    author_name: str | None = Field(default=None, max_length=200)
    author_headline: str | None = Field(default=None, max_length=400)
    media_description: str | None = Field(
        default=None,
        max_length=2_000,
        description="Alt text / captions of images, videos or documents attached to the post.",
    )
    tone: Tone = "professional"
    length: Length = "medium"
    count: int = Field(default=4, ge=1, le=6)
    use_emojis: bool = False
    persona: str | None = Field(
        default=None,
        max_length=600,
        description="Who the commenter is, e.g. 'Senior data engineer at a fintech'.",
    )
    instructions: str | None = Field(default=None, max_length=600)
    model: str | None = Field(default=None, max_length=120)

    @field_validator("post_text")
    @classmethod
    def _post_not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Post text is too short to analyse.")
        return v

    @field_validator("author_name", "author_headline", "media_description", "persona", "instructions", "model")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


# ---------------------------------------------------------------------------
# LLM structured outputs
# ---------------------------------------------------------------------------
class PostAnalysis(BaseModel):
    """Understanding of a LinkedIn post, used to write relevant comments."""

    summary: str = Field(description="One or two sentence plain summary of what the post says.")
    post_type: str = Field(
        description=(
            "Kind of post, e.g. 'Achievement', 'Job change', 'Hiring', 'Opinion', 'Lesson learned', "
            "'Tutorial / tips', 'Product launch', 'Event', 'Question', 'Personal story', 'News', 'Announcement'."
        )
    )
    author_intent: str = Field(description="What the author most likely wants from readers.")
    sentiment: str = Field(description="Overall emotional tone of the post, e.g. 'proud', 'reflective', 'frustrated'.")
    key_points: list[str] = Field(description="2-5 concrete points, facts or claims made in the post.")
    specific_details: list[str] = Field(
        description="Specific names, numbers, tools, places or phrases from the post a thoughtful commenter could reference."
    )
    comment_angles: list[str] = Field(
        description="3-6 distinct, genuinely useful angles a commenter could take in response."
    )


class CommentOption(BaseModel):
    angle: str = Field(
        description="2-3 word label for the approach, e.g. 'Add insight', 'Ask a question', 'Share experience', 'Congratulate', 'Respectful pushback'."
    )
    text: str = Field(description="The comment exactly as it would be posted.")


class CommentBatch(BaseModel):
    comments: list[CommentOption]


# ---------------------------------------------------------------------------
# API response
# ---------------------------------------------------------------------------
class AnalysisOut(BaseModel):
    summary: str
    post_type: str
    sentiment: str
    key_points: list[str]


class GenerateResponse(BaseModel):
    analysis: AnalysisOut
    comments: list[CommentOption]
    model: str
