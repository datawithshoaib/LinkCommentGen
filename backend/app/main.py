"""FastAPI entrypoint for the LinkedIn comment generator."""

import logging
import time

import groq
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.exceptions import OutputParserException
from pydantic import ValidationError

from .config import get_settings
from .graph import LLMFactory, build_graph
from .llm import groq_llm_factory
from .schemas import AnalysisOut, GenerateRequest, GenerateResponse

logger = logging.getLogger("linkcomment")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(llm_factory: LLMFactory | None = None, require_api_key: bool = True) -> FastAPI:
    settings = get_settings()
    graph = build_graph(
        llm_factory or groq_llm_factory,
        analysis_temperature=settings.analysis_temperature,
        generation_temperature=settings.generation_temperature,
    )

    app = FastAPI(title="LinkedIn Comment Generator", version="2.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^(chrome-extension://.*|https://(www\.)?linkedin\.com|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "model": settings.groq_model,
            "groq_configured": bool(settings.groq_api_key) or not require_api_key,
        }

    @app.post("/api/generate", response_model=GenerateResponse)
    async def generate(req: GenerateRequest) -> GenerateResponse:
        if require_api_key and not settings.groq_api_key:
            raise HTTPException(503, "GROQ_API_KEY is not set on the backend. Add it to backend/.env and restart.")

        model = req.model or settings.groq_model
        started = time.perf_counter()
        try:
            result = await graph.ainvoke({"request": req, "model": model})
        except groq.AuthenticationError:
            raise HTTPException(502, "Groq rejected the API key. Check GROQ_API_KEY in backend/.env.")
        except groq.RateLimitError:
            raise HTTPException(429, "Groq rate limit reached. Wait a few seconds and try again.")
        except groq.NotFoundError:
            raise HTTPException(400, f"Groq model '{model}' was not found. Pick another model in settings.")
        except (groq.APITimeoutError, groq.APIConnectionError):
            raise HTTPException(504, "Could not reach Groq in time. Check your connection and try again.")
        except groq.APIStatusError as e:
            logger.warning("Groq error %s: %s", e.status_code, e.message)
            raise HTTPException(502, f"Groq error: {e.message}")
        except (OutputParserException, ValidationError) as e:
            logger.warning("Model returned malformed output: %s", e)
            raise HTTPException(502, "The model returned an unexpected format. Please try again.")

        comments = result.get("comments", [])
        if not comments:
            raise HTTPException(502, "The model did not return any usable comments. Please try again.")

        a = result["analysis"]
        logger.info(
            "Generated %d/%d comments with %s in %.2fs (%d attempt(s))",
            len(comments), req.count, model, time.perf_counter() - started, result.get("attempts", 0),
        )
        return GenerateResponse(
            analysis=AnalysisOut(
                summary=a.summary, post_type=a.post_type, sentiment=a.sentiment, key_points=a.key_points
            ),
            comments=comments,
            model=model,
        )

    return app


app = create_app()


def run() -> None:
    import uvicorn

    s = get_settings()
    uvicorn.run("app.main:app", host=s.host, port=s.port, reload=False)


if __name__ == "__main__":
    run()
