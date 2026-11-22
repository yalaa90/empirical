from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from typing import Any, Callable

from app.config import Settings
from app.confirm_store import ConfirmStore
from app.errors import ActionUnavailable, InvalidRequest, ValidationFailure
from app.executor import Executor
from app.models import PendingAction, ValidatedAction
from app.observability import log_event, truncate
from app.registry import ToolRegistry
from app.validator import validate_model_output

logger = logging.getLogger("empirical.service")


def identity_hash(
    session_id: str | None,
    authorization: str | None,
    client_host: str | None,
) -> str:
    if session_id:
        material = "session:" + session_id[:128]
    elif authorization:
        token_hash = hashlib.sha256(authorization.encode("utf-8")).hexdigest()
        material = "auth:" + token_hash
    else:
        material = "host:" + (client_host or "unknown")
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


class Orchestrator:
    def __init__(
        self,
        settings: Settings,
        registry: ToolRegistry,
        llm: Any,
        store: ConfirmStore,
        executor: Executor,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._settings = settings
        self._registry = registry
        self._llm = llm
        self._store = store
        self._executor = executor
        self._clock = clock

    async def chat(
        self,
        message: str,
        identity: str,
        authorization: str | None,
        request_id: str,
    ) -> dict[str, Any]:
        message = message.strip()
        if not message:
            raise InvalidRequest("Message must not be empty.")
        if len(message) > self._settings.max_message_chars:
            raise InvalidRequest(
                f"Message is too long (max {self._settings.max_message_chars} characters)."
            )

        started = time.perf_counter()
        log_fields: dict[str, Any] = {
            "request_id": request_id,
            "session": identity[:12],
            "message_chars": len(message),
        }
        if self._settings.log_messages:
            log_fields["message"] = truncate(message, self._settings.max_message_chars)
        log_event(logger, "chat.received", **log_fields)

        queue_ms = 0
        llm_ms = 0
        validate_ms = 0
        attempts = 0
        correction: str | None = None
        action: ValidatedAction | None = None
        last_failure: ValidationFailure | None = None

        for attempt in (1, 2):
            attempts = attempt
            result = await self._llm.propose(message, correction)
            queue_ms += result.queue_ms
            llm_ms += result.latency_ms
            log_event(
                logger,
                "llm.response",
                request_id=request_id,
                attempt=attempt,
                mode=result.mode,
                queue_ms=result.queue_ms,
                llm_ms=result.latency_ms,
                finish_reason=result.finish_reason,
                raw_output=truncate(result.content, 500),
            )

            validate_started = time.perf_counter()
            try:
                action = validate_model_output(result.content, self._registry, message)
                validate_ms += int(round((time.perf_counter() - validate_started) * 1000))
                log_event(
                    logger,
                    "validation.ok",
                    request_id=request_id,
                    attempt=attempt,
                    tool=action.spec.name,
                    args=action.args,
                )
                break
            except ValidationFailure as exc:
                validate_ms += int(round((time.perf_counter() - validate_started) * 1000))
                last_failure = exc
                log_event(
                    logger,
                    "validation.failed",
                    request_id=request_id,
                    attempt=attempt,
                    reason=exc.retry_hint or exc.message,
                )
                if attempt == 1:
                    correction = exc.retry_hint or exc.message
                    continue
                log_event(
                    logger,
                    "chat.failed",
                    request_id=request_id,
                    code=exc.code,
                    attempts=attempts,
                    total_ms=_ms(started),
                )
                hint = exc.retry_hint or exc.message
                raise ValidationFailure(
                    f"Model output failed validation after retry. {hint}",
                    hint,
                ) from exc

        if action is None:
            assert last_failure is not None
            raise last_failure

        spec = action.spec
        if spec.name == "none":
            reason = str(action.args.get("reason", "No matching tool."))
            log_event(
                logger,
                "chat.completed",
                request_id=request_id,
                status="no_action",
                tool="none",
                attempts=attempts,
                total_ms=_ms(started),
            )
            return {
                "status": "no_action",
                "tool": "none",
                "reason": reason,
                "latency_ms": _latency(
                    queue_ms=queue_ms,
                    llm_ms=llm_ms,
                    validate_ms=validate_ms,
                    api_ms=0,
                    total_ms=_ms(started),
                ),
            }

        if spec.destructive:
            now = self._clock()
            action_id = secrets.token_urlsafe(24)
            summary = self._registry.render_summary(spec, action.args)
            pending = PendingAction(
                action_id=action_id,
                identity_hash=identity,
                tool_name=spec.name,
                args=action.args,
                summary=summary,
                request_id=request_id,
                created_at=now,
                expires_at=now + self._settings.confirm_ttl_s,
            )
            await self._store.put(pending)
            log_event(
                logger,
                "confirmation.created",
                request_id=request_id,
                action_id_prefix=action_id[:8],
                tool=spec.name,
                args=action.args,
                summary=summary,
                ttl_s=self._settings.confirm_ttl_s,
            )
            return {
                "status": "needs_confirmation",
                "action_id": action_id,
                "summary": summary,
                "tool": spec.name,
                "expires_in_s": int(self._settings.confirm_ttl_s),
                "latency_ms": _latency(
                    queue_ms=queue_ms,
                    llm_ms=llm_ms,
                    validate_ms=validate_ms,
                    api_ms=0,
                    total_ms=_ms(started),
                ),
            }

        execution = await self._executor.execute(spec, action.args, authorization)
        log_event(
            logger,
            "api.call",
            request_id=request_id,
            method=execution.method,
            path=execution.path,
            status=execution.status_code,
            api_ms=execution.api_ms,
        )
        log_event(
            logger,
            "chat.completed",
            request_id=request_id,
            status="ok",
            tool=spec.name,
            attempts=attempts,
            total_ms=_ms(started),
        )
        return {
            "status": "ok",
            "tool": spec.name,
            "result": execution.result_message,
            "data": execution.data,
            "latency_ms": _latency(
                queue_ms=queue_ms,
                llm_ms=llm_ms,
                validate_ms=validate_ms,
                api_ms=execution.api_ms,
                total_ms=_ms(started),
            ),
        }

    async def confirm(
        self,
        action_id: str,
        identity: str,
        authorization: str | None,
        request_id: str,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        pending = await self._store.pop(action_id, identity)
        if pending is None:
            log_event(
                logger,
                "confirmation.unavailable",
                request_id=request_id,
                action_id_prefix=action_id[:8],
                total_ms=_ms(started),
            )
            raise ActionUnavailable()

        if not hmac.compare_digest(pending.identity_hash, identity):
            raise ActionUnavailable()

        if pending.tool_name not in self._registry:
            raise ActionUnavailable()
        spec = self._registry.get(pending.tool_name)
        if not spec.executable:
            raise ActionUnavailable()

        log_event(
            logger,
            "confirmation.consumed",
            request_id=request_id,
            action_id_prefix=action_id[:8],
            tool=spec.name,
            args=pending.args,
        )
        execution = await self._executor.execute(spec, pending.args, authorization)
        log_event(
            logger,
            "api.call",
            request_id=request_id,
            method=execution.method,
            path=execution.path,
            status=execution.status_code,
            api_ms=execution.api_ms,
        )
        log_event(
            logger,
            "chat.completed",
            request_id=request_id,
            status="ok",
            tool=spec.name,
            attempts=0,
            total_ms=_ms(started),
        )
        return {
            "status": "ok",
            "tool": spec.name,
            "result": execution.result_message,
            "data": execution.data,
            "latency_ms": _latency(
                queue_ms=0,
                llm_ms=0,
                validate_ms=0,
                api_ms=execution.api_ms,
                total_ms=_ms(started),
            ),
        }


def _ms(started: float) -> int:
    return int(round((time.perf_counter() - started) * 1000))


def _latency(
    *,
    queue_ms: int,
    llm_ms: int,
    validate_ms: int,
    api_ms: int,
    total_ms: int,
) -> dict[str, int]:
    return {
        "queue": queue_ms,
        "llm": llm_ms,
        "validate": validate_ms,
        "api": api_ms,
        "total": total_ms,
    }
