from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import quote, urlsplit

import httpx

from app.config import Settings
from app.errors import ExecutionError
from app.models import ExecutionResult, ToolSpec
from app.registry import ToolRegistry

_PLACEHOLDER_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")
_DEFAULT_PORTS = {"http": 80, "https": 443}


class Executor:
    def __init__(self, settings: Settings, registry: ToolRegistry, client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._registry = registry
        self._client = client
        self._base = settings.base_url.rstrip("/")

    async def execute(
        self,
        spec: ToolSpec,
        args: dict[str, Any],
        authorization: str | None,
    ) -> ExecutionResult:
        if not spec.executable or spec.method is None or spec.url is None:
            raise ExecutionError(
                f"Tool {spec.name!r} is not executable.",
                code="tool_not_executable",
                http_status=500,
            )
        if not spec.url.startswith("/") or spec.url.startswith("//"):
            raise ExecutionError(
                "Refusing a tool URL outside BASE_URL.",
                code="url_out_of_scope",
                http_status=500,
            )
        if authorization is not None and ("\r" in authorization or "\n" in authorization):
            raise ExecutionError("Invalid Authorization header.", code="invalid_auth_header", http_status=400)

        path, remaining = _render_path(spec.url, args)
        url = self._base + path
        _assert_same_origin(self._base, url)

        headers = {"Accept": "application/json"}
        if authorization:
            headers["Authorization"] = authorization

        params: dict[str, str] | None = None
        body: dict[str, Any] | None = None
        if spec.method == "GET":
            params = {key: str(value) for key, value in remaining.items() if value is not None}
        else:
            body = remaining

        started = time.perf_counter()
        try:
            response = await self._client.request(
                spec.method,
                url,
                params=params,
                json=body,
                headers=headers,
                follow_redirects=False,
            )
        except httpx.TimeoutException as exc:
            raise ExecutionError(
                "The Business API timed out.",
                code="api_timeout",
                http_status=504,
            ) from exc
        except httpx.HTTPError as exc:
            raise ExecutionError(
                f"Cannot reach the Business API: {type(exc).__name__}",
                code="api_unreachable",
            ) from exc
        api_ms = int(round((time.perf_counter() - started) * 1000))

        if 300 <= response.status_code < 400:
            raise ExecutionError(
                "The Business API returned a redirect; redirects are not followed.",
                code="api_redirect",
                upstream_status=response.status_code,
            )
        if response.status_code >= 400:
            detail = _error_detail(response)
            raise ExecutionError(
                f"Business API returned HTTP {response.status_code}: {detail}",
                upstream_status=response.status_code,
            )

        data = _parse_response(response)
        result_message = self._registry.render_result(spec, args, data)
        return ExecutionResult(
            method=spec.method,
            path=urlsplit(url).path,
            status_code=response.status_code,
            data=data,
            result_message=result_message,
            api_ms=api_ms,
        )


def create_api_client(settings: Settings) -> httpx.AsyncClient:
    timeout = httpx.Timeout(
        settings.api_timeout_s,
        connect=settings.connect_timeout_s,
        read=settings.api_timeout_s,
        write=settings.api_timeout_s,
        pool=settings.api_timeout_s,
    )
    return httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )


def _render_path(template: str, args: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    remaining = dict(args)
    path = template
    for match in _PLACEHOLDER_RE.finditer(template):
        key = match.group(1)
        if key not in remaining:
            raise ExecutionError(
                f"Missing path argument {key!r}.",
                code="invalid_tool_definition",
                http_status=500,
            )
        value = remaining.pop(key)
        path = path.replace(match.group(0), quote(str(value), safe=""))
    return path, remaining


def _assert_same_origin(base_url: str, target_url: str) -> None:
    base = urlsplit(base_url)
    target = urlsplit(target_url)

    def origin(parts: Any) -> tuple[str, str, int | None]:
        scheme = (parts.scheme or "").lower()
        host = (parts.hostname or "").lower()
        port = parts.port or _DEFAULT_PORTS.get(scheme)
        return scheme, host, port

    if origin(base) != origin(target):
        raise ExecutionError(
            "Refusing to call an origin outside BASE_URL.",
            code="url_out_of_scope",
            http_status=500,
        )


def _parse_response(response: httpx.Response) -> Any:
    if response.status_code == 204 or not response.content:
        return None
    text = response.text
    content_type = response.headers.get("content-type", "")
    if "json" in content_type.lower() or text.lstrip().startswith(("{", "[")):
        try:
            return response.json()
        except ValueError:
            pass
    return text[:1000]


def _error_detail(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        data = None
    if isinstance(data, dict):
        for key in ("detail", "message", "error"):
            value = data.get(key)
            if value:
                return str(value)[:300]
    text = response.text.strip()
    return (text[:300] if text else "(empty body)")
