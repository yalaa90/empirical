from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]


class Example(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: str
    output: dict[str, Any]


class ToolSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    parameters: dict[str, Any]
    destructive: bool
    executable: bool = True
    method: HttpMethod | None = None
    url: str | None = None
    success_template: str | None = None
    confirm_summary: str | None = None
    examples: list[Example] = Field(min_length=1)


class ToolFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int
    tools: list[ToolSpec]


@dataclass(frozen=True, slots=True)
class ValidatedAction:
    spec: ToolSpec
    args: dict[str, Any]


@dataclass(frozen=True, slots=True)
class PendingAction:
    action_id: str
    identity_hash: str
    tool_name: str
    args: dict[str, Any]
    summary: str
    request_id: str
    created_at: float
    expires_at: float


@dataclass(frozen=True, slots=True)
class LLMResult:
    content: str
    latency_ms: int
    queue_ms: int
    mode: str
    model: str
    finish_reason: str | None = None


@dataclass(frozen=True, slots=True)
class ExecutionResult:
    method: str
    path: str
    status_code: int
    data: Any
    result_message: str
    api_ms: int
    extra: dict[str, Any] = field(default_factory=dict)
