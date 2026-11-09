from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq

from .config import get_settings


def groq_llm_factory(model: str, temperature: float) -> BaseChatModel:
    settings = get_settings()
    return ChatGroq(
        model=model,
        temperature=temperature,
        api_key=settings.groq_api_key,
        max_retries=settings.max_retries,
        timeout=settings.request_timeout,
    )
