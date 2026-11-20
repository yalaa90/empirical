from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.errors import ExecutionError
from app.executor import Executor
from app.models import ToolSpec
from app.registry import ToolRegistry


def _run_with_transport(
    settings: Settings,
    registry: ToolRegistry,
    handler,
    spec_name: str,
    args: dict,
    authorization: str | None = "Bearer user-token",
) -> tuple:
    return _run_with_spec(
        settings,
        registry,
        handler,
        registry.get(spec_name),
        args,
        authorization=authorization,
    )


def _run_with_spec(
    settings: Settings,
    registry: ToolRegistry,
    handler,
    spec: ToolSpec,
    args: dict,
    authorization: str | None = "Bearer user-token",
) -> tuple:
    captured: list[httpx.Request] = []

    async def wrapped(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return await handler(request)

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(wrapped), trust_env=False)
        try:
            executor = Executor(settings, registry, client)
            result = await executor.execute(spec, args, authorization)
            return result
        finally:
            await client.aclose()

    return asyncio.run(run()), captured


def test_executor_builds_post_and_forwards_auth(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            201,
            json={
                "id": 1,
                "name": "Classic Cotton T-Shirt",
                "category": "tshirt",
                "color": "red",
                "price": 19.99,
                "qty": 3,
            },
        )

    result, captured = _run_with_transport(
        settings,
        registry,
        handler,
        "add_to_cart",
        {"product_name": "tshirt", "color": "red", "qty": 3},
    )
    request = captured[0]
    assert request.method == "POST"
    assert request.url.path == "/actions/cart"
    assert request.headers["authorization"] == "Bearer user-token"
    assert request.headers.get("content-type", "").startswith("application/json")
    assert json.loads(request.content) == {"product_name": "tshirt", "color": "red", "qty": 3}
    assert result.result_message == "Added Classic Cotton T-Shirt to cart."
    assert result.status_code == 201


def test_executor_get_uses_query_params(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [], "count": 0})

    result, captured = _run_with_transport(
        settings,
        registry,
        handler,
        "search_products",
        {"query": "tshirt", "color": "red"},
        authorization=None,
    )
    request = captured[0]
    assert request.method == "GET"
    assert request.url.path == "/actions/search-products"
    assert request.url.params["query"] == "tshirt"
    assert request.url.params["color"] == "red"
    assert "authorization" not in request.headers
    assert "content-type" not in request.headers
    assert result.result_message == "Found 0 product(s)."


def test_executor_path_argument_is_quoted(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"name": "Classic Cotton T-Shirt"})

    spec = registry.get("open_product").model_copy(update={"url": "/actions/product/{product_name}"})
    result, captured = _run_with_spec(
        settings,
        registry,
        handler,
        spec,
        {"product_name": "red tshirt"},
        authorization=None,
    )
    assert captured[0].url.raw_path == b"/actions/product/red%20tshirt"
    assert result.result_message == "Opening Classic Cotton T-Shirt."


def test_executor_does_not_follow_redirects(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "http://evil.example/steal"})

    with pytest.raises(ExecutionError) as exc_info:
        _run_with_transport(
            settings,
            registry,
            handler,
            "add_to_cart",
            {"product_name": "tshirt", "qty": 1},
        )
    assert exc_info.value.code == "api_redirect"


def test_executor_rejects_absolute_tool_url(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={})

    spec = registry.get("search_products").model_copy(
        update={"url": "http://evil.example/actions/search-products"}
    )

    with pytest.raises(ExecutionError) as exc_info:
        _run_with_spec(settings, registry, handler, spec, {"query": "tshirt"})
    assert exc_info.value.code == "url_out_of_scope"


def test_executor_maps_upstream_error(settings: Settings, registry: ToolRegistry) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "product 'tshirt' is not in the cart"})

    with pytest.raises(ExecutionError) as exc_info:
        _run_with_transport(
            settings,
            registry,
            handler,
            "remove_from_cart",
            {"product_name": "tshirt", "color": "red"},
        )
    assert "is not in the cart" in exc_info.value.message
    assert exc_info.value.details["upstream_status"] == 404
