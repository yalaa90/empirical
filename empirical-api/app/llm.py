from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.config import Settings
from app.errors import LLMBusy, LLMTimeout, LLMUnavailable
from app.models import LLMResult
from app.observability import log_event
from app.registry import ToolRegistry
from app.validator import format_retry_message

logger = logging.getLogger("empirical.llm")


class _StructuredOutputRejected(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class LlamaLLM:
    def __init__(
        self,
        settings: Settings,
        registry: ToolRegistry,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings
        self._registry = registry
        timeout = httpx.Timeout(
            settings.llm_timeout_s,
            connect=settings.connect_timeout_s,
            read=settings.llm_timeout_s,
            write=settings.llm_timeout_s,
            pool=settings.llm_timeout_s,
        )
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
            trust_env=False,
        )
        self._owns_client = client is None
        self._semaphore = asyncio.Semaphore(settings.llm_max_concurrency)
        self._mode = settings.llm_structured_mode
        self._fallback_lock = asyncio.Lock()

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def model(self) -> str:
        return self._settings.llm_model

    async def propose(
        self,
        message: str,
        correction: str | None = None,
        *,
        context: str | None = None,
    ) -> LLMResult:
        acquired = False
        queue_started = time.perf_counter()
        try:
            async with asyncio.timeout(self._settings.llm_queue_timeout_s):
                await self._semaphore.acquire()
            acquired = True
        except TimeoutError as exc:
            raise LLMBusy() from exc
        queue_ms = int(round((time.perf_counter() - queue_started) * 1000))

        try:
            result = await self._propose_inner(message, correction, context)
            return LLMResult(
                content=result.content,
                latency_ms=result.latency_ms,
                queue_ms=queue_ms,
                mode=result.mode,
                model=result.model,
                finish_reason=result.finish_reason,
            )
        finally:
            if acquired:
                self._semaphore.release()

    async def _propose_inner(
        self,
        message: str,
        correction: str | None,
        context: str | None = None,
    ) -> LLMResult:
        if self._mode in {"auto", "json_schema"}:
            try:
                return await self._post(message, correction, context, use_grammar=False)
            except _StructuredOutputRejected as exc:
                if self._mode == "json_schema":
                    raise LLMUnavailable(
                        "llama-server rejected JSON-schema constrained output. "
                        "Use LLM_STRUCTURED_MODE=gbnf or upgrade llama-server.",
                        upstream_status=exc.status_code,
                    ) from exc
                async with self._fallback_lock:
                    if self._mode == "auto":
                        self._mode = "gbnf"
                        log_event(
                            logger,
                            "llm.structured_fallback",
                            mode="gbnf",
                            upstream_status=exc.status_code,
                            reason=exc.detail[:300],
                        )
                return await self._post(message, correction, context, use_grammar=True)
        return await self._post(message, correction, context, use_grammar=True)

    def _payload(
        self,
        message: str,
        correction: str | None,
        use_grammar: bool,
        context: str | None = None,
    ) -> dict[str, Any]:
        user_content = message if correction is None else format_retry_message(message, correction)
        if context:
            # Conversation memory goes in the user turn, not the system prompt,
            # so the (large, static) system prompt stays cacheable.
            header = "" if correction is not None else "User message:\n"
            user_content = f"Context:\n{context}\n\n{header}{user_content}"
        payload: dict[str, Any] = {
            "model": self._settings.llm_model,
            "messages": [
                {"role": "system", "content": self._registry.system_prompt()},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0,
            "max_tokens": 80,
            "stream": False,
            "cache_prompt": True,
        }
        if use_grammar:
            payload["grammar"] = self._registry.gbnf
        else:
            payload["response_format"] = self._registry.openai_response_format()
        return payload

    async def _post(
        self,
        message: str,
        correction: str | None,
        context: str | None = None,
        *,
        use_grammar: bool,
    ) -> LLMResult:
        payload = self._payload(message, correction, use_grammar, context)
        headers = {"Content-Type": "application/json"}
        if self._settings.llm_api_key:
            headers["Authorization"] = f"Bearer {self._settings.llm_api_key}"

        started = time.perf_counter()
        try:
            response = await self._client.post(
                f"{self._settings.llm_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )
        except httpx.TimeoutException as exc:
            raise LLMTimeout("The local model timed out.") from exc
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"Cannot reach llama-server: {type(exc).__name__}") from exc
        latency_ms = int(round((time.perf_counter() - started) * 1000))

        detail = _short_body(response)
        if response.status_code in {400, 422} and not use_grammar:
            raise _StructuredOutputRejected(response.status_code, detail)
        if response.status_code == 504:
            raise LLMTimeout("llama-server timed out.")
        if response.status_code >= 400:
            raise LLMUnavailable(
                f"llama-server returned HTTP {response.status_code}: {detail}",
                upstream_status=response.status_code,
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise LLMUnavailable("llama-server returned a non-JSON response.") from exc
        if not isinstance(data, dict):
            raise LLMUnavailable("llama-server returned an unexpected JSON shape.")

        choices = data.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            raise LLMUnavailable("llama-server returned no choices.")
        choice = choices[0]
        message_obj = choice.get("message")
        if not isinstance(message_obj, dict):
            raise LLMUnavailable("llama-server returned no message.")
        content = message_obj.get("content")
        if not isinstance(content, str) or not content.strip():
            raise LLMUnavailable("llama-server returned an empty completion.")

        return LLMResult(
            content=content,
            latency_ms=latency_ms,
            queue_ms=0,
            mode="gbnf" if use_grammar else "json_schema",
            model=str(data.get("model") or self._settings.llm_model),
            finish_reason=choice.get("finish_reason"),
        )

    async def health(self) -> bool:
        timeout = httpx.Timeout(self._settings.health_timeout_s)
        for path in ("/health", "/v1/models"):
            try:
                response = await self._client.get(f"{self._settings.llm_url}{path}", timeout=timeout)
            except httpx.HTTPError:
                return False
            if response.status_code == 200:
                return True
            if response.status_code != 404:
                return False
        return False

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


def _short_body(response: httpx.Response) -> str:
    text = response.text.strip()
    if not text:
        return "(empty body)"
    return text[:500]

