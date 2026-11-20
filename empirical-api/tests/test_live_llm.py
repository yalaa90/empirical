from __future__ import annotations

import asyncio
import os

import pytest

from app.config import Settings
from app.llm import LlamaLLM
from app.registry import ToolRegistry
from app.validator import validate_model_output

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LIVE_LLM") != "1",
    reason="Set RUN_LIVE_LLM=1 and start llama-server to run live model tests.",
)


def test_live_search_red_tshirt() -> None:
    settings = Settings.from_env()
    registry = ToolRegistry.load(settings.tools_path, prompt_example_limit=settings.prompt_example_limit)

    async def run() -> str:
        llm = LlamaLLM(settings, registry)
        try:
            result = await llm.propose("find tshirt with color red")
            action = validate_model_output(result.content, registry)
            return action.spec.name
        finally:
            await llm.aclose()

    assert asyncio.run(run()) == "search_products"


def test_live_nonsense_returns_none() -> None:
    settings = Settings.from_env()
    registry = ToolRegistry.load(settings.tools_path, prompt_example_limit=settings.prompt_example_limit)

    async def run() -> str:
        llm = LlamaLLM(settings, registry)
        try:
            result = await llm.propose("what is the weather in Cairo?")
            action = validate_model_output(result.content, registry)
            return action.spec.name
        finally:
            await llm.aclose()

    assert asyncio.run(run()) == "none"
