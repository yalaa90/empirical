from __future__ import annotations

import math
import re
import threading
from typing import Any, Callable, Literal

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.catalog_terms import infer_category, normalize_category, normalize_text, tokenize

Color = Literal["red", "blue", "black", "white", "green", "yellow"]
Category = Literal["tshirt", "hoodie", "shoes", "hat", "accessory"]
Page = Literal["home", "cart", "checkout"]

COLORS: tuple[dict[str, str], ...] = (
    {"key": "red", "label": "Red"},
    {"key": "blue", "label": "Blue"},
    {"key": "black", "label": "Black"},
    {"key": "white", "label": "White"},
    {"key": "green", "label": "Green"},
    {"key": "yellow", "label": "Yellow"},
)

CATEGORIES: tuple[dict[str, Any], ...] = (
    {
        "key": "tshirt",
        "label": "T-Shirt",
        "count": 25,
        "brands": ["Northline", "Basalt", "Field & Form", "Sunday Standard", "Alder"],
        "adjectives": ["Classic", "Relaxed", "Heavyweight", "Pocket", "Oversized"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "price": [22, 42],
        "tags": ["casual", "cotton", "everyday"],
        "blurb": "soft combed cotton with a clean everyday cut",
    },
    {
        "key": "hoodie",
        "label": "Hoodie",
        "count": 20,
        "brands": ["Northline", "Basalt", "Rove", "Alder"],
        "adjectives": ["Fleece", "Zip-Up", "Pullover", "Boxy", "Heavyweight"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "price": [45, 89],
        "tags": ["warm", "layer", "streetwear"],
        "blurb": "brushed fleece with a roomy hood and ribbed cuffs",
    },
    {
        "key": "shoes",
        "label": "Shoes",
        "count": 20,
        "brands": ["Terra", "Vela", "Rove", "Strider", "Northline"],
        "adjectives": ["Trail", "Court", "Runner", "Canvas", "Low"],
        "sizes": ["7", "8", "9", "10", "11", "12"],
        "price": [55, 130],
        "tags": ["footwear", "comfort", "outdoor"],
        "blurb": "cushioned footbed with a grippy everyday outsole",
    },
    {
        "key": "hat",
        "label": "Hat",
        "count": 15,
        "brands": ["Northline", "Alder", "Field & Form"],
        "adjectives": ["Corduroy", "Trucker", "Beanie", "Bucket", "Dad"],
        "sizes": ["One size"],
        "price": [18, 38],
        "tags": ["headwear", "casual", "accessory"],
        "blurb": "structured crown with an adjustable everyday fit",
    },
    {
        "key": "accessory",
        "label": "Accessory",
        "count": 20,
        "brands": ["Northline", "Basalt", "Vela", "Field & Form"],
        "adjectives": [
            "Canvas Tote",
            "Leather Wallet",
            "Wool Socks",
            "Steel Bottle",
            "Key Clip",
        ],
        "sizes": ["One size"],
        "price": [12, 60],
        "tags": ["daily carry", "gift", "essential"],
        "blurb": "a durable everyday essential made for repeat use",
    },
)

def _mulberry32(seed: int) -> Callable[[], float]:
    value = seed & 0xFFFFFFFF

    def random() -> float:
        nonlocal value
        value = (value + 0x6D2B79F5) & 0xFFFFFFFF
        t = value
        t = _imul(t ^ (t >> 15), 1 | t)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) ^ t) & 0xFFFFFFFF
        t ^= t >> 14
        return (t & 0xFFFFFFFF) / 4294967296

    return random


def _imul(left: int, right: int) -> int:
    return (left * right) & 0xFFFFFFFF


def _slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def _round_price(value: float) -> float:
    return math.floor(value * 100 + 0.5) / 100


def _round_one(value: float) -> float:
    return math.floor(value * 10 + 0.5) / 10


def _generate_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    next_id = 1

    for category in CATEGORIES:
        for index in range(category["count"]):
            product_id = next_id
            next_id += 1
            random = _mulberry32(product_id * 7919)
            if category["key"] == "tshirt":
                color = COLORS[(index // 5) % len(COLORS)]
            else:
                color = COLORS[index % len(COLORS)]
            brand = category["brands"][index % len(category["brands"])]
            adjective = category["adjectives"][index % len(category["adjectives"])]
            min_price, max_price = category["price"]
            price = _round_price(min_price + (max_price - min_price) * (0.2 + random() * 0.8))
            name = f"{brand} {color['label']} {adjective} {category['label']}"
            rating = _round_one(3.6 + random() * 1.4)
            stock = 0 if random() < 0.08 else 3 + math.floor(random() * 38)
            if category["key"] in {"tshirt", "hoodie"}:
                sizes = [
                    size
                    for size_index, size in enumerate(category["sizes"])
                    if size_index >= index % 2
                ]
            else:
                sizes = list(category["sizes"])

            products.append(
                {
                    "id": product_id,
                    "name": name,
                    "slug": _slugify(name),
                    "brand": brand,
                    "category": category["key"],
                    "color": color["key"],
                    "sizes": sizes,
                    "price": price,
                    "rating": min(5.0, rating),
                    "stock": stock,
                    "description": (
                        f"The {name} pairs {category['blurb']} with a {color['key']} "
                        "finish. Built for repeat wear and easy styling."
                    ),
                    "tags": [category["key"], color["key"], *category["tags"]],
                    # Same path the storefront serves (demo-filter/public/products).
                    "image": f"/products/{_slugify(name)}.svg",
                }
            )

    return products


DEFAULT_PRODUCTS: tuple[dict[str, Any], ...] = tuple(_generate_products())


class AddToCartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: str = Field(min_length=1, max_length=80)
    color: Color | None = None
    qty: int = Field(default=1, ge=1)


class RemoveFromCartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: str = Field(min_length=1, max_length=80)
    color: Color | None = None


def _normalize(value: str) -> str:
    return normalize_text(value)


def _tokens(value: str) -> list[str]:
    return tokenize(value)


def _product_tokens(product: dict[str, Any]) -> set[str]:
    haystack = " ".join(
        [
            str(product["name"]),
            str(product["brand"]),
            str(product["category"]),
            str(product["color"]),
            *[str(tag) for tag in product["tags"]],
        ]
    )
    return set(_tokens(haystack))


def _score_product(product: dict[str, Any], query_tokens: list[str]) -> int:
    if not query_tokens:
        return 0
    haystack = _product_tokens(product)
    return sum(1 for token in query_tokens if token in haystack)


def _match_all(query: str) -> bool:
    return _normalize(query) in {"", "all", "everything"}


def _search_filters(
    query: str,
    category: str | None,
    color: str | None,
    max_price: float | None,
) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    if query:
        filters["query"] = query
    if category:
        filters["category"] = category
    if color:
        filters["color"] = color
    if max_price is not None:
        filters["max_price"] = max_price
    return filters


class MockStorefront:
    def __init__(self, products: list[dict[str, Any]] | None = None) -> None:
        self._lock = threading.Lock()
        self._products = [dict(product) for product in (products or DEFAULT_PRODUCTS)]
        self._cart: list[dict[str, Any]] = []
        self._next_line_id = 1

    def search_products(
        self,
        query: str,
        category: str | None = None,
        color: str | None = None,
        max_price: float | None = None,
    ) -> list[dict[str, Any]]:
        match_all = _match_all(query)
        query_tokens = _tokens(query)
        with self._lock:
            products = [dict(product) for product in self._products]
        found: list[dict[str, Any]] = []
        for product in products:
            if not match_all and query_tokens and _score_product(product, query_tokens) == 0:
                continue
            if category is not None and product["category"] != category:
                continue
            if color is not None and product["color"] != color:
                continue
            if max_price is not None and product["price"] > max_price:
                continue
            found.append(product)
        return found

    def get_product(self, product_name: str, color: str | None = None) -> dict[str, Any] | None:
        with self._lock:
            product = self._find_product(self._products, product_name, color)
            return dict(product) if product is not None else None

    def add_to_cart(
        self,
        product_name: str,
        color: str | None = None,
        qty: int = 1,
    ) -> dict[str, Any] | None:
        with self._lock:
            product = self._find_product(self._products, product_name, color)
            if product is None:
                return None
            for line in self._cart:
                if line["product_id"] == product["id"]:
                    line["qty"] += qty
                    return dict(line)
            line = {
                "id": self._next_line_id,
                "product_id": product["id"],
                "name": product["name"],
                "category": product["category"],
                "color": product["color"],
                "price": product["price"],
                "qty": qty,
            }
            self._next_line_id += 1
            self._cart.append(line)
            return dict(line)

    def remove_from_cart(self, product_name: str, color: str | None = None) -> dict[str, Any] | None:
        needle = _normalize(product_name)
        with self._lock:
            for index, line in enumerate(self._cart):
                if color is not None and line["color"] != color:
                    continue
                fields = (line["name"], line["category"], line["color"])
                if not any(needle in _normalize(field) for field in fields):
                    continue
                removed = self._cart.pop(index)
                return dict(removed)
        return None

    def empty_cart(self) -> int:
        with self._lock:
            removed = len(self._cart)
            self._cart.clear()
            return removed

    def cart_items(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(line) for line in self._cart]

    def navigate(self, page: str) -> dict[str, str]:
        return {"page": page}

    @staticmethod
    def _find_product(
        products: list[dict[str, Any]],
        product_name: str,
        color: str | None,
    ) -> dict[str, Any] | None:
        wanted = _tokens(product_name)
        candidates = products
        if color is not None:
            candidates = [product for product in products if product["color"] == color]

        best = None
        best_score = 0
        for product in candidates:
            score = _score_product(product, wanted)
            if score > best_score:
                best = product
                best_score = score

        if best is not None:
            return best
        if len(candidates) == 1:
            return candidates[0]
        return None


def create_mock_storefront_app(storefront: MockStorefront | None = None) -> FastAPI:
    shop = storefront or MockStorefront()
    app = FastAPI(title="Mock Storefront API", version="1.0.0")
    app.state.storefront = shop

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"status": "ok", "products": len(shop.search_products("all"))}

    @app.get("/actions/search-products")
    async def search_products(
        query: str = Query(min_length=1, max_length=80),
        category: Category | None = Query(default=None),
        color: Color | None = Query(default=None),
        max_price: float | None = Query(default=None, ge=1),
    ) -> dict[str, Any]:
        resolved_category = normalize_category(category) or infer_category(query)
        found = shop.search_products(query, resolved_category, color, max_price)
        return {
            "action": "search_products",
            "filters": _search_filters(query, resolved_category, color, max_price),
            "count": len(found),
            "product_ids": [product["id"] for product in found],
            "items": found,
        }

    @app.post("/actions/cart")
    async def add_to_cart(payload: AddToCartRequest) -> Any:
        line = shop.add_to_cart(payload.product_name, payload.color, payload.qty)
        if line is None:
            return JSONResponse(
                status_code=404,
                content={"detail": f"product {payload.product_name!r} not found"},
            )
        # `qty` is the amount added by THIS request (clients apply it as a delta);
        # the running total for the cart line is exposed separately as `cart_qty`.
        return {
            "action": "add_to_cart",
            **line,
            "qty": payload.qty,
            "cart_qty": line["qty"],
        }

    @app.post("/actions/cart/remove")
    async def remove_from_cart(payload: RemoveFromCartRequest) -> Any:
        line = shop.remove_from_cart(payload.product_name, payload.color)
        if line is None:
            return JSONResponse(
                status_code=404,
                content={"detail": f"product {payload.product_name!r} is not in the cart"},
            )
        return {"action": "remove_from_cart", **line}

    @app.post("/actions/cart/clear")
    async def empty_cart() -> dict[str, Any]:
        removed = shop.empty_cart()
        return {"action": "empty_cart", "removed": removed}

    @app.get("/actions/product")
    async def open_product(
        product_name: str = Query(min_length=1, max_length=80),
        color: Color | None = Query(default=None),
    ) -> Any:
        product = shop.get_product(product_name, color)
        if product is None:
            return JSONResponse(
                status_code=404,
                content={"detail": f"product {product_name!r} not found"},
            )
        return {"action": "open_product", "product_id": product["id"], **product}

    @app.get("/actions/navigate")
    async def navigate(page: Page = Query()) -> dict[str, str]:
        return shop.navigate(page)

    return app


app = create_mock_storefront_app()
