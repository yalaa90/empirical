from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

_DEFAULT_TIMEOUTS: dict[str, float] = {"llm": 30.0, "api": 5.0, "connect": 2.0, "health": 2.0}
_STRUCTURED_MODES = {"auto", "json_schema", "gbnf"}


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number, got {raw!r}") from exc
    if value <= 0:
        raise ValueError(f"{name} must be positive, got {value}")
    return value


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {raw!r}") from exc
    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}, got {value}")
    return value


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_timeouts(raw: str) -> dict[str, float]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"TIMEOUTS must be a JSON object, got {raw!r}") from exc
    if not isinstance(data, dict):
        raise ValueError("TIMEOUTS must be a JSON object")
    timeouts = dict(_DEFAULT_TIMEOUTS)
    for key, value in data.items():
        if key not in timeouts:
            raise ValueError(f"Unknown TIMEOUTS key {key!r}; allowed: {sorted(timeouts)}")
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            raise ValueError(f"TIMEOUTS.{key} must be a positive number")
        timeouts[key] = float(value)
    return timeouts


@dataclass(frozen=True, slots=True)
class Settings:
    llm_url: str
    llm_model: str
    llm_api_key: str | None
    llm_structured_mode: str
    llm_max_concurrency: int
    llm_queue_timeout_s: float
    base_url: str
    tools_path: Path
    llm_timeout_s: float
    api_timeout_s: float
    connect_timeout_s: float
    health_timeout_s: float
    confirm_ttl_s: float
    max_message_chars: int
    prompt_example_limit: int
    log_level: str
    log_messages: bool

    @classmethod
    def from_env(cls) -> Settings:
        timeouts_raw = os.getenv("TIMEOUTS")
        timeouts = _parse_timeouts(timeouts_raw) if timeouts_raw else dict(_DEFAULT_TIMEOUTS)

        llm_timeout = _env_float("LLM_TIMEOUT_S", timeouts["llm"])
        api_timeout = _env_float("API_TIMEOUT_S", timeouts["api"])
        connect_timeout = _env_float("CONNECT_TIMEOUT_S", timeouts["connect"])
        health_timeout = _env_float("HEALTH_TIMEOUT_S", timeouts["health"])

        structured_mode = _env("LLM_STRUCTURED_MODE", "auto").strip().lower()
        if structured_mode not in _STRUCTURED_MODES:
            raise ValueError(
                f"LLM_STRUCTURED_MODE must be one of {sorted(_STRUCTURED_MODES)}, got {structured_mode!r}"
            )

        return cls(
            llm_url=_env("LLM_URL", "http://127.0.0.1:8080").rstrip("/"),
            llm_model=_env("LLM_MODEL", "qwen1.5-1.8b-chat"),
            llm_api_key=os.getenv("LLM_API_KEY") or None,
            llm_structured_mode=structured_mode,
            llm_max_concurrency=_env_int("LLM_MAX_CONCURRENCY", 1),
            llm_queue_timeout_s=_env_float("LLM_QUEUE_TIMEOUT_S", 12.0),
            base_url=_env("BASE_URL", "http://127.0.0.1:8001").rstrip("/"),
            tools_path=Path(_env("TOOLS_PATH", "./tools.json")),
            llm_timeout_s=llm_timeout,
            api_timeout_s=api_timeout,
            connect_timeout_s=connect_timeout,
            health_timeout_s=health_timeout,
            confirm_ttl_s=_env_float("CONFIRM_TTL_S", 120.0),
            max_message_chars=_env_int("MAX_MESSAGE_CHARS", 500),
            prompt_example_limit=_env_int("PROMPT_EXAMPLE_LIMIT", 2),
            log_level=_env("LOG_LEVEL", "INFO").upper(),
            log_messages=_env_bool("LOG_MESSAGES", True),
        )


def as_public_dict(settings: Settings) -> dict[str, Any]:
    return {
        "llm_url": settings.llm_url,
        "llm_model": settings.llm_model,
        "base_url": settings.base_url,
        "llm_structured_mode": settings.llm_structured_mode,
        "llm_timeout_s": settings.llm_timeout_s,
        "api_timeout_s": settings.api_timeout_s,
        "confirm_ttl_s": settings.confirm_ttl_s,
        "tools_path": str(settings.tools_path),
    }
