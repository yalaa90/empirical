from __future__ import annotations

import pytest

from app.errors import ValidationFailure
from app.registry import ToolRegistry
from app.validator import validate_model_output


def test_valid_add(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"add_to_cart","args":{"product_name":"tshirt","color":"red","qty":1}}',
        registry,
    )
    assert action.spec.name == "add_to_cart"
    assert action.args == {"product_name": "tshirt", "color": "red", "qty": 1}


def test_none_is_allowed(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"none","args":{"reason":"Not a shopping command."}}',
        registry,
    )
    assert action.spec.name == "none"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("not json", "valid JSON"),
        ('[{"tool":"add_to_cart"}]', "one JSON object"),
        ('{"tool":"add_to_cart","args":{"product_name":"tshirt"},"extra":1}', "wrong top-level shape"),
        ('{"tool":"drop_all","args":{}}', "unknown tool"),
        ('{"tool":"add_to_cart","args":{"product_name":"tshirt","qty":0}}', "Invalid arguments"),
        (
            '{"tool":"add_to_cart","args":{"product_name":"tshirt","qty":1,"admin":true}}',
            "Invalid arguments",
        ),
        ('{"tool":"add_to_cart","args":{"product_name":"tshirt","qty":true}}', "Invalid arguments"),
        ('{"tool":"add_to_cart","args":[]}', "'args' value must be an object"),
    ],
)
def test_invalid_outputs(registry: ToolRegistry, raw: str, expected: str) -> None:
    with pytest.raises(ValidationFailure) as exc_info:
        validate_model_output(raw, registry)
    assert expected in exc_info.value.message
    assert exc_info.value.retry_hint


def test_hallucinated_optional_args_are_stripped(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"search_products","args":{"query":"hoodie","category":"hoodie","color":"red","max_price":60}}',
        registry,
        "find hoodie",
    )
    assert action.args == {"query": "hoodie", "category": "hoodie"}


def test_category_is_inferred_from_plural_message(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"search_products","args":{"query":"t-shirts","color":"red"}}',
        registry,
        "find T-shirts",
    )
    assert action.args == {"query": "t-shirts", "category": "tshirt"}


def test_copied_query_is_replaced_with_all(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"search_products","args":{"query":"t-shirts","category":"tshirt"}}',
        registry,
        "show me everything",
    )
    assert action.args == {"query": "all"}


def test_unmentioned_category_is_stripped(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"search_products","args":{"query":"all","category":"tshirt"}}',
        registry,
        "show me everything",
    )
    assert action.args == {"query": "all"}


def test_explicit_color_and_price_are_kept(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"search_products","args":{"query":"t-shirts","category":"tshirt","color":"red","max_price":60}}',
        registry,
        "find red t-shirts under 60 dollars",
    )
    assert action.args == {
        "query": "t-shirts",
        "category": "tshirt",
        "color": "red",
        "max_price": 60,
    }


def test_add_to_cart_drops_unmentioned_optional_args(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"add_to_cart","args":{"product_name":"hoodie","category":"hoodie","color":"red","qty":2}}',
        registry,
        "add a hoodie to my cart",
    )
    assert action.args == {"product_name": "hoodie"}


def test_add_to_cart_keeps_explicit_color_and_quantity(registry: ToolRegistry) -> None:
    action = validate_model_output(
        '{"tool":"add_to_cart","args":{"product_name":"hoodie","color":"black","qty":2}}',
        registry,
        "put two black hoodies in my cart",
    )
    assert action.args == {"product_name": "hoodie", "color": "black", "qty": 2}


def test_retry_hint_is_bounded(registry: ToolRegistry) -> None:
    with pytest.raises(ValidationFailure) as exc_info:
        validate_model_output(
            '{"tool":"add_to_cart","args":{"product_name":"tshirt","qty":0}}',
            registry,
        )
    assert len(exc_info.value.retry_hint or "") <= 301
