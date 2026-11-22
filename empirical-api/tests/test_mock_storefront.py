from __future__ import annotations

from fastapi.testclient import TestClient

from app.mock_storefront import DEFAULT_PRODUCTS, MockStorefront, create_mock_storefront_app


def _client() -> TestClient:
    return TestClient(create_mock_storefront_app(MockStorefront()))


def test_catalogue_matches_generated_storefront() -> None:
    assert len(DEFAULT_PRODUCTS) == 100
    assert {product["category"] for product in DEFAULT_PRODUCTS} == {
        "tshirt",
        "hoodie",
        "shoes",
        "hat",
        "accessory",
    }
    assert all(
        {
            "id",
            "name",
            "slug",
            "brand",
            "category",
            "color",
            "sizes",
            "price",
            "rating",
            "stock",
            "description",
            "tags",
            "image",
        }
        <= set(product)
        for product in DEFAULT_PRODUCTS
    )


def test_search_returns_red_tshirt_and_filters() -> None:
    response = _client().get(
        "/actions/search-products",
        params={"query": "tshirt", "color": "red"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["action"] == "search_products"
    assert body["filters"] == {
        "query": "tshirt",
        "category": "tshirt",
        "color": "red",
    }
    assert body["count"] == 5
    assert body["product_ids"] == [item["id"] for item in body["items"]]
    assert all(item["category"] == "tshirt" for item in body["items"])
    assert all(item["color"] == "red" for item in body["items"])


def test_search_infers_category_from_plural_query() -> None:
    response = _client().get(
        "/actions/search-products",
        params={"query": "t-shirts"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filters"] == {"query": "t-shirts", "category": "tshirt"}
    assert body["count"] == 25
    assert all(item["category"] == "tshirt" for item in body["items"])


def test_search_infers_accessory_category_from_plural_query() -> None:
    response = _client().get(
        "/actions/search-products",
        params={"query": "accessories"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filters"] == {"query": "accessories", "category": "accessory"}
    assert body["count"] == 20
    assert all(item["category"] == "accessory" for item in body["items"])


def test_search_filters_category_and_max_price() -> None:
    expected = [
        product
        for product in DEFAULT_PRODUCTS
        if product["category"] == "hoodie" and product["price"] <= 70
    ]
    response = _client().get(
        "/actions/search-products",
        params={"query": "all", "category": "hoodie", "max_price": 70},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filters"] == {"query": "all", "category": "hoodie", "max_price": 70.0}
    assert body["count"] == len(expected)
    assert body["count"] >= 1
    assert all(item["category"] == "hoodie" for item in body["items"])
    assert all(item["price"] <= 70 for item in body["items"])


def test_search_all_returns_full_catalogue() -> None:
    response = _client().get("/actions/search-products", params={"query": "all"})
    assert response.status_code == 200
    assert response.json()["count"] == len(DEFAULT_PRODUCTS)
    assert response.json()["count"] == len(MockStorefront().search_products("all"))


def test_cart_add_and_remove_round_trip() -> None:
    with _client() as client:
        added = client.post(
            "/actions/cart",
            json={"product_name": "tshirt", "color": "red", "qty": 2},
        )
        assert added.status_code == 200
        added_body = added.json()
        assert added_body["action"] == "add_to_cart"
        assert added_body["product_id"] == 1
        assert added_body["name"] == "Northline Red Classic T-Shirt"
        assert added_body["qty"] == 2

        removed = client.post(
            "/actions/cart/remove",
            json={"product_name": "tshirt", "color": "red"},
        )
        assert removed.status_code == 200
        removed_body = removed.json()
        assert removed_body["action"] == "remove_from_cart"
        assert removed_body["product_id"] == 1
        assert removed_body["name"] == "Northline Red Classic T-Shirt"

        missing = client.post(
            "/actions/cart/remove",
            json={"product_name": "tshirt", "color": "red"},
        )
        assert missing.status_code == 404


def test_repeated_add_reports_delta_not_running_total() -> None:
    # Regression: clients apply `qty` as a delta, so returning the cumulative
    # line quantity made the storefront cart grow 1 -> 3 -> 6.
    store = MockStorefront()
    with TestClient(create_mock_storefront_app(store)) as client:
        for expected_total in (1, 2, 3):
            body = client.post(
                "/actions/cart", json={"product_name": "tshirt", "color": "red", "qty": 1}
            ).json()
            assert body["qty"] == 1
            assert body["cart_qty"] == expected_total
        assert store.cart_items()[0]["qty"] == 3


def test_empty_cart_clears_all_lines() -> None:
    store = MockStorefront()
    with TestClient(create_mock_storefront_app(store)) as client:
        client.post("/actions/cart", json={"product_name": "tshirt", "color": "red", "qty": 2})
        client.post("/actions/cart", json={"product_name": "hoodie", "color": "black"})
        assert len(store.cart_items()) == 2

        cleared = client.post("/actions/cart/clear")
        assert cleared.status_code == 200
        assert cleared.json() == {"action": "empty_cart", "removed": 2}
        assert store.cart_items() == []

        again = client.post("/actions/cart/clear")
        assert again.status_code == 200
        assert again.json() == {"action": "empty_cart", "removed": 0}


def test_add_missing_product_returns_404() -> None:
    response = _client().post("/actions/cart", json={"product_name": "spaceship", "qty": 1})
    assert response.status_code == 404


def test_open_product_and_navigate() -> None:
    with _client() as client:
        product = client.get(
            "/actions/product",
            params={"product_name": "tshirt", "color": "red"},
        )
        assert product.status_code == 200
        body = product.json()
        assert body["action"] == "open_product"
        assert body["id"] == 1
        assert body["product_id"] == 1
        assert body["color"] == "red"

        missing = client.get(
            "/actions/product",
            params={"product_name": "spaceship"},
        )
        assert missing.status_code == 404

        page = client.get("/actions/navigate", params={"page": "cart"})
        assert page.status_code == 200
        assert page.json() == {"page": "cart"}

        invalid = client.get("/actions/navigate", params={"page": "admin"})
        assert invalid.status_code == 422
