from __future__ import annotations

from app.memory import SessionMemory, SessionMemoryStore, is_bare_add, prompt_context, resolve_product
from tests.conftest import action

HEADERS = {"X-Session-Id": "alice"}


def _search_red_tshirts(h) -> list[dict]:
    response = h.client.post("/chat", json={"message": "find red tshirt"}, headers=HEADERS)
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) >= 2
    return items


def test_bare_add_after_search_adds_first_result(make_harness) -> None:
    # The model ignores context and guesses an unrelated product.
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("add_to_cart", product_name="hoodie"),
    ]
    with make_harness(outputs) as h:
        items = _search_red_tshirts(h)

        response = h.client.post("/chat", json={"message": "add"}, headers=HEADERS)
        body = response.json()
        assert body["status"] == "ok"
        assert body["tool"] == "add_to_cart"
        assert body["data"]["product_id"] == items[0]["id"]
        assert h.storefront.cart_items()[0]["product_id"] == items[0]["id"]

        # The second LLM call saw the remembered list.
        context = h.fake.calls[1]["context"]
        assert context is not None
        assert items[0]["name"] in context
        assert h.fake.calls[0]["context"] is None


def test_bare_add_when_model_returns_none(make_harness) -> None:
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("none", reason="Which product?"),
    ]
    with make_harness(outputs) as h:
        items = _search_red_tshirts(h)
        body = h.client.post("/chat", json={"message": "add it"}, headers=HEADERS).json()
        assert body["status"] == "ok"
        assert body["tool"] == "add_to_cart"
        assert body["data"]["product_id"] == items[0]["id"]


def test_ordinal_picks_from_list(make_harness) -> None:
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("add_to_cart", product_name="tshirt", color="red"),
    ]
    with make_harness(outputs) as h:
        items = _search_red_tshirts(h)
        body = h.client.post(
            "/chat", json={"message": "add the second one"}, headers=HEADERS
        ).json()
        assert body["data"]["product_id"] == items[1]["id"]


def test_repeat_add_uses_same_product_and_qty(make_harness) -> None:
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("add_to_cart", product_name="x"),
        action("add_to_cart", product_name="y", qty=2),
    ]
    with make_harness(outputs) as h:
        items = _search_red_tshirts(h)
        h.client.post("/chat", json={"message": "add"}, headers=HEADERS)
        body = h.client.post(
            "/chat", json={"message": "add 2 more of it"}, headers=HEADERS
        ).json()
        assert body["data"]["product_id"] == items[0]["id"]
        assert body["data"]["qty"] == 2
        assert h.storefront.cart_items()[0]["qty"] == 3


def test_explicit_other_product_is_not_overridden(make_harness) -> None:
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("add_to_cart", product_name="hoodie", color="black"),
    ]
    with make_harness(outputs) as h:
        _search_red_tshirts(h)
        body = h.client.post(
            "/chat", json={"message": "add a black hoodie"}, headers=HEADERS
        ).json()
        assert body["data"]["category"] == "hoodie"
        assert body["data"]["color"] == "black"


def test_memory_is_per_session(make_harness) -> None:
    outputs = [
        action("search_products", query="tshirt", color="red"),
        action("none", reason="Which product?"),
    ]
    with make_harness(outputs) as h:
        _search_red_tshirts(h)
        body = h.client.post(
            "/chat", json={"message": "add"}, headers={"X-Session-Id": "bob"}
        ).json()
        assert body["status"] == "no_action"
        assert h.fake.calls[1]["context"] is None


def test_memory_expires() -> None:
    now = [0.0]
    store = SessionMemoryStore(ttl_s=10, clock=lambda: now[0])
    store.record("s", "search_products", {"items": [{"id": 1, "name": "Red Tee", "color": "red"}]})
    assert store.get("s") is not None
    now[0] = 11
    assert store.get("s") is None


def test_resolve_and_bare_add_helpers() -> None:
    memory = SessionMemory(
        results=[
            {"id": 1, "name": "Northline Red Classic T-Shirt", "color": "red", "category": "tshirt"},
            {"id": 2, "name": "Northline Red Pocket T-Shirt", "color": "red", "category": "tshirt"},
        ]
    )
    assert is_bare_add("add")
    assert is_bare_add("add it to my cart")
    assert is_bare_add("I'll take 2 of them")
    assert not is_bare_add("add a black hoodie")
    assert not is_bare_add("find hoodies")
    assert resolve_product("add the pocket one", memory)["id"] == 2
    assert resolve_product("add the last one", memory)["id"] == 2
    assert resolve_product("add #1", memory)["id"] == 1
    assert resolve_product("add red tshirt", memory)["id"] == 1
    assert resolve_product("add a blue tshirt", memory) is None
    context = prompt_context(memory)
    assert context and "1. Northline Red Classic T-Shirt (red)" in context
