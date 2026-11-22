from __future__ import annotations

import json
from typing import Any

import jsonschema

from app.catalog_terms import sanitize_args
from app.errors import ValidationFailure
from app.models import ValidatedAction
from app.registry import ToolRegistry

_MAX_MODEL_OUTPUT_CHARS = 10_000
_MAX_HINT_CHARS = 300


def validate_model_output(
    raw: str,
    registry: ToolRegistry,
    message: str | None = None,
) -> ValidatedAction:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationFailure("The model returned an empty response.", "Output must be one JSON object.")
    if len(raw) > _MAX_MODEL_OUTPUT_CHARS:
        raise ValidationFailure("The model response was too large.", "Output must be one small JSON object.")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        hint = f"Output is not valid JSON: {exc.msg} at line {exc.lineno} column {exc.colno}."
        raise ValidationFailure("The model did not return valid JSON.", hint) from exc

    if not isinstance(parsed, dict):
        raise ValidationFailure("The model output must be one JSON object.", "Output must be a JSON object.")

    keys = set(parsed)
    if keys != {"tool", "args"}:
        extra = keys - {"tool", "args"}
        missing = {"tool", "args"} - keys
        hint = "Output must contain exactly the keys 'tool' and 'args'."
        if extra:
            hint += f" Remove unknown keys: {sorted(extra)}."
        if missing:
            hint += f" Add missing keys: {sorted(missing)}."
        raise ValidationFailure("The model output has the wrong top-level shape.", hint)

    tool_name = parsed["tool"]
    if not isinstance(tool_name, str):
        raise ValidationFailure("The model's 'tool' value must be a string.", "'tool' must be a string.")
    if tool_name not in registry:
        raise ValidationFailure(
            f"The model chose an unknown tool: {tool_name!r}.",
            f"Use one of the allowed tools: {', '.join(registry.names)}.",
        )

    args = parsed["args"]
    if not isinstance(args, dict):
        raise ValidationFailure("The model's 'args' value must be an object.", "'args' must be a JSON object.")

    spec = registry.get(tool_name)
    args = sanitize_args(spec.name, args, message)
    try:
        registry.validate_args(spec, args)
    except jsonschema.ValidationError as exc:
        path = "$" + "".join(f"[{part!r}]" for part in exc.absolute_path)
        hint = f"{path}: {exc.message}"
        if len(hint) > _MAX_HINT_CHARS:
            hint = hint[:_MAX_HINT_CHARS] + "…"
        raise ValidationFailure(f"Invalid arguments for {tool_name!r}.", hint) from exc

    return ValidatedAction(spec=spec, args=dict(args))


def format_retry_message(original: str, hint: str) -> str:
    return (
        "User message:\n"
        f"{original}\n\n"
        "Your previous output was rejected.\n"
        f"Reason: {hint}\n"
        "Return only the corrected JSON object."
    )
