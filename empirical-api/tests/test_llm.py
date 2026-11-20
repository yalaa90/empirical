from __future__ import annotations

import asyncio
import json
from dataclasses import replace
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.errors import LLMUnavailable
from app.llm import LlamaLLM
from app.registry import ToolRegistry


def _completion(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "model": "qwen1.5-1.8b-chat",
            "choices": [
                {
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        },
    )


def test_json_schema_rejection_falls_back_to_gbnf(settings: Settings, registry: ToolRegistry) -> None:
    bodies: list[dict[str, Any]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        if len(bodies) == 1:
            return httpx.Response(400, text="response_format json_schema is not supported")
        return _completion('{"tool":"search_products","args":{"query":"tshirt","color":"red"}}')

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        try:
            llm = LlamaLLM(settings, registry, client)
            result = await llm.propose("add 3 apples")
            return result, llm.mode
        finally:
            await client.aclose()

    result, mode = asyncio.run(run())
    assert result.content == '{"tool":"search_products","args":{"query":"tshirt","color":"red"}}'
    assert result.mode == "gbnf"
    assert mode == "gbnf"
    assert "response_format" in bodies[0]
    assert "grammar" not in bodies[0]
    assert "grammar" in bodies[1]
    assert "response_format" not in bodies[1]
    assert bodies[0]["messages"][0] == bodies[1]["messages"][0]
    assert bodies[0]["temperature"] == 0
    assert bodies[0]["max_tokens"] == 80
    assert bodies[0]["cache_prompt"] is True


def test_system_prompt_is_identical_across_requests(settings: Settings, registry: ToolRegistry) -> None:
    bodies: list[dict[str, Any]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return _completion('{"tool":"none","args":{"reason":"chit-chat"}}')

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        try:
            llm = LlamaLLM(settings, registry, client)
            await llm.propose("hello")
            await llm.propose("what is the weather?")
        finally:
            await client.aclose()

    asyncio.run(run())
    assert len(bodies) == 2
    assert bodies[0]["messages"][0] == bodies[1]["messages"][0]
    assert bodies[0]["messages"][0]["role"] == "system"
    assert bodies[0]["messages"][1]["content"] == "hello"
    assert bodies[1]["messages"][1]["content"] == "what is the weather?"
    assert bodies[0]["response_format"]["json_schema"]["schema"]["oneOf"]


def test_forced_json_schema_mode_does_not_silently_fall_back(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text="unsupported")

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        try:
            llm = LlamaLLM(replace(settings, llm_structured_mode="json_schema"), registry, client)
            await llm.propose("add 3 apples")
        finally:
            await client.aclose()

    with pytest.raises(LLMUnavailable):
        asyncio.run(run())


def test_health_reports_unreachable(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        return httpx.Response(404)

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        try:
            llm = LlamaLLM(settings, registry, client)
            return await llm.health()
        finally:
            await client.aclose()

    assert asyncio.run(run()) is True
