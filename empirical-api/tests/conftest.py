from __future__ import annotations

import asyncio
import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.confirm_store import InMemoryConfirmStore
from app.main import create_app
from app.mock_storefront import MockStorefront, create_mock_storefront_app
from app.models import LLMResult
from app.registry import ToolRegistry

ROOT = Path(__file__).resolve().parents[1]
TOOLS_PATH = ROOT / "tools.json"
BASE_URL = "http://127.0.0.1:8001"


def action(tool: str, **args: Any) -> str:
    return json.dumps({"tool": tool, "args": args})


class MutableClock:
    def __init__(self, start: float = 10_000.0) -> None:
        self.value = start

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


class FakeLLM:
    def __init__(self, outputs: list[str | Exception], *, healthy: bool = True) -> None:
        self.outputs = list(outputs)
        self.calls: list[dict[str, str | None]] = []
        self.healthy = healthy
        self.mode = "json_schema"
        self.model = "fake-qwen"

    async def propose(self, message: str, correction: str | None = None) -> LLMResult:
        self.calls.append({"message": message, "correction": correction})
        if not self.outputs:
            raise AssertionError("FakeLLM ran out of scripted outputs")
        output = self.outputs.pop(0)
        if isinstance(output, Exception):
            raise output
        return LLMResult(
            content=output,
            latency_ms=5,
            queue_ms=1,
            mode=self.mode,
            model=self.model,
            finish_reason="stop",
        )

    async def health(self) -> bool:
        return self.healthy

    async def aclose(self) -> None:
        return None


@pytest.fixture
def settings() -> Settings:
    base = Settings.from_env()
    return replace(
        base,
        tools_path=TOOLS_PATH,
        base_url=BASE_URL,
        llm_structured_mode="auto",
        llm_timeout_s=5.0,
        api_timeout_s=5.0,
        connect_timeout_s=2.0,
        health_timeout_s=2.0,
        confirm_ttl_s=120.0,
        prompt_example_limit=2,
        log_level="CRITICAL",
        log_messages=True,
        max_message_chars=500,
    )


@pytest.fixture
def registry(settings: Settings) -> ToolRegistry:
    return ToolRegistry.load(settings.tools_path, prompt_example_limit=settings.prompt_example_limit)


class Harness:
    def __init__(
        self,
        settings: Settings,
        outputs: list[str | Exception],
        *,
        healthy: bool = True,
    ) -> None:
        self.settings = settings
        self.clock = MutableClock()
        self.fake = FakeLLM(outputs, healthy=healthy)
        self.store = InMemoryConfirmStore(ttl_s=settings.confirm_ttl_s, clock=self.clock)
        self.registry = ToolRegistry.load(
            settings.tools_path,
            prompt_example_limit=settings.prompt_example_limit,
        )
        self.storefront = MockStorefront()
        self.mock_app = create_mock_storefront_app(self.storefront)
        self.api_client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.mock_app),
            base_url=settings.base_url,
            trust_env=False,
            timeout=5.0,
        )
        self.app = create_app(
            settings,
            registry=self.registry,
            llm=self.fake,
            store=self.store,
            api_client=self.api_client,
            clock=self.clock,
        )
        self.client: TestClient | None = None
        self._test_client_cm: Any = None

    def __enter__(self) -> Harness:
        self._test_client_cm = TestClient(self.app)
        self.client = self._test_client_cm.__enter__()
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        assert self._test_client_cm is not None
        self._test_client_cm.__exit__(exc_type, exc, tb)
        asyncio.run(self.api_client.aclose())


@pytest.fixture
def make_harness(settings: Settings):
    def factory(outputs: list[str | Exception], *, healthy: bool = True) -> Harness:
        return Harness(settings, outputs, healthy=healthy)

    return factory
