from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Any, Callable

import httpx
from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings
from app.confirm_store import ConfirmStore, InMemoryConfirmStore
from app.errors import ServiceError
from app.executor import Executor, create_api_client
from app.llm import LlamaLLM
from app.memory import SessionMemoryStore
from app.observability import configure_logging, log_event
from app.registry import ToolRegistry
from app.service import Orchestrator, identity_hash

logger = logging.getLogger("empirical.api")


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=1000)


def create_app(
    settings: Settings | None = None,
    *,
    registry: ToolRegistry | None = None,
    llm: Any | None = None,
    store: ConfirmStore | None = None,
    api_client: httpx.AsyncClient | None = None,
    clock: Callable[[], float] = time.monotonic,
    memory: SessionMemoryStore | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging(settings.log_level)

    registry = registry or ToolRegistry.load(
        settings.tools_path,
        prompt_example_limit=settings.prompt_example_limit,
    )
    owns_llm = llm is None
    llm = llm if llm is not None else LlamaLLM(settings, registry)
    store = store if store is not None else InMemoryConfirmStore(
        ttl_s=settings.confirm_ttl_s,
        clock=clock,
    )
    owns_api_client = api_client is None
    api_client = api_client if api_client is not None else create_api_client(settings)
    executor = Executor(settings, registry, api_client)
    orchestrator = Orchestrator(
        settings,
        registry,
        llm,
        store,
        executor,
        clock=clock,
        memory=memory if memory is not None else SessionMemoryStore(clock=clock),
    )

    cleanup_interval = max(1.0, min(30.0, settings.confirm_ttl_s / 2))

    async def cleanup_loop() -> None:
        while True:
            await asyncio.sleep(cleanup_interval)
            try:
                removed = await store.cleanup()
                if removed:
                    log_event(logger, "confirmation.cleanup", removed=removed)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("confirmation cleanup failed")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        log_event(
            logger,
            "app.startup",
            tools=len(registry.specs),
            prompt_chars=registry.prompt_char_count(),
            prompt_tokens_estimate=registry.prompt_token_estimate(),
            llm_url=settings.llm_url,
            llm_model=settings.llm_model,
            structured_mode=llm.mode,
            base_url=settings.base_url,
        )
        task = asyncio.create_task(cleanup_loop())
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            if owns_llm:
                await llm.aclose()
            if owns_api_client:
                await api_client.aclose()
            log_event(logger, "app.shutdown")

    app = FastAPI(title="Empirical Chat-to-API Orchestrator", version="1.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.registry = registry
    app.state.llm = llm
    app.state.store = store
    app.state.executor = executor
    app.state.orchestrator = orchestrator

    @app.middleware("http")
    async def request_context(request: Request, call_next: Any):
        raw_id = request.headers.get("X-Request-ID", "")
        request_id = raw_id.strip()[:64] if raw_id.strip() else uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        log_event(
            logger,
            "request.failed",
            request_id=getattr(request.state, "request_id", None),
            code=exc.code,
            http_status=exc.http_status,
        )
        return JSONResponse(status_code=exc.http_status, content=exc.payload())

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "code": "invalid_request",
                "message": "Request validation failed.",
                "details": {"errors": exc.errors()},
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled request error",
            extra={"event_data": {"request_id": getattr(request.state, "request_id", None)}},
        )
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "code": "internal_error",
                "message": "Internal server error.",
            },
        )

    @app.post("/chat")
    async def chat(
        payload: ChatRequest,
        request: Request,
        authorization: Annotated[str | None, Header()] = None,
        x_session_id: Annotated[str | None, Header()] = None,
    ) -> dict[str, Any]:
        session = x_session_id.strip() if x_session_id else None
        host = request.client.host if request.client else None
        identity = identity_hash(session, authorization, host)
        return await orchestrator.chat(
            payload.message,
            identity,
            authorization,
            request.state.request_id,
        )

    @app.post("/confirm/{action_id}")
    async def confirm(
        action_id: str,
        request: Request,
        authorization: Annotated[str | None, Header()] = None,
        x_session_id: Annotated[str | None, Header()] = None,
    ) -> dict[str, Any]:
        session = x_session_id.strip() if x_session_id else None
        host = request.client.host if request.client else None
        identity = identity_hash(session, authorization, host)
        return await orchestrator.confirm(
            action_id,
            identity,
            authorization,
            request.state.request_id,
        )

    @app.get("/health")
    async def health() -> JSONResponse:
        llm_ok = await llm.health()
        body = {
            "status": "ok" if llm_ok else "degraded",
            "llm": "ok" if llm_ok else "unreachable",
            "model": settings.llm_model,
            "llm_url": settings.llm_url,
            "structured_mode": llm.mode,
            "tools": len(registry.specs),
        }
        log_event(logger, "health.check", llm_ok=llm_ok)
        return JSONResponse(status_code=200 if llm_ok else 503, content=body)

    return app


app = create_app()
