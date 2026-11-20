from __future__ import annotations

from typing import Any


class ServiceError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        http_status: int = 500,
        retry_hint: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.retry_hint = retry_hint
        self.details = details or {}

    def payload(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "status": "error",
            "code": self.code,
            "message": self.message,
        }
        if self.details:
            body["details"] = self.details
        return body


class InvalidRequest(ServiceError):
    def __init__(self, message: str) -> None:
        super().__init__("invalid_request", message, http_status=422)


class ValidationFailure(ServiceError):
    def __init__(self, message: str, retry_hint: str | None = None) -> None:
        super().__init__(
            "invalid_model_output",
            message,
            http_status=422,
            retry_hint=retry_hint,
        )


class LLMUnavailable(ServiceError):
    def __init__(self, message: str, *, upstream_status: int | None = None) -> None:
        details = {"upstream_status": upstream_status} if upstream_status is not None else None
        super().__init__("llm_unavailable", message, http_status=503, details=details)


class LLMTimeout(ServiceError):
    def __init__(self, message: str = "The local model timed out.") -> None:
        super().__init__("llm_timeout", message, http_status=504)


class LLMBusy(ServiceError):
    def __init__(self, message: str = "The local model is busy; retry shortly.") -> None:
        super().__init__("llm_busy", message, http_status=503)


class ExecutionError(ServiceError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "api_error",
        upstream_status: int | None = None,
        http_status: int = 502,
    ) -> None:
        details = {"upstream_status": upstream_status} if upstream_status is not None else None
        super().__init__(code, message, http_status=http_status, details=details)


class ActionUnavailable(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "action_unavailable",
            "Unknown, expired, already used, or not owned by this session.",
            http_status=404,
        )
