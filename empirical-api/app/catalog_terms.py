from __future__ import annotations

import re
from typing import Any

CATEGORY_KEYS = ("tshirt", "hoodie", "shoes", "hat", "accessory")
COLOR_KEYS = ("red", "blue", "black", "white", "green", "yellow")

STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "the",
        "to",
        "my",
        "me",
        "in",
        "of",
        "for",
        "with",
        "please",
        "find",
        "show",
        "get",
        "add",
        "put",
        "open",
        "go",
        "take",
        "want",
        "need",
        "some",
    }
)

_CATEGORY_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("tshirt", re.compile(r"\b(?:tshirts?|shirts?|tees?)\b", re.IGNORECASE)),
    ("hoodie", re.compile(r"\bhood(?:ie|y)s?\b", re.IGNORECASE)),
    ("shoes", re.compile(r"\b(?:shoes?|sneakers?|footwear)\b", re.IGNORECASE)),
    ("hat", re.compile(r"\b(?:hats?|caps?|beanies?)\b", re.IGNORECASE)),
    (
        "accessory",
        re.compile(
            r"\b(?:accessor(?:y|ies)|bags?|wallets?|bottles?|socks?|totes?)\b",
            re.IGNORECASE,
        ),
    ),
)

_COLOR_PATTERN = re.compile(r"\b(?:red|blue|black|white|green|yellow)\b", re.IGNORECASE)
_NUMBER_PATTERN = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])")

_PRICE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"(?:under|below|less\s+than|up\s+to|max(?:imum)?|budget|cheaper\s+than|price(?:\s+of)?)"
        r"\s*\$?\s*(\d+(?:\.\d+)?)",
        re.IGNORECASE,
    ),
    re.compile(r"\$\s*(\d+(?:\.\d+)?)", re.IGNORECASE),
    re.compile(
        r"(\d+(?:\.\d+)?)\s*(?:dollars?|usd|bucks)?\s*(?:or\s+less|max(?:imum)?)",
        re.IGNORECASE,
    ),
)

_NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}

_IRREGULAR_PLURALS = {
    "accessories": "accessory",
    "beanies": "beanie",
}


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def singularize(token: str) -> str:
    if token in _IRREGULAR_PLURALS:
        return _IRREGULAR_PLURALS[token]
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def tokenize(value: str) -> list[str]:
    result: list[str] = []
    for token in normalize_text(value).split(" "):
        if len(token) <= 1 or token in STOP_WORDS:
            continue
        result.append(singularize(token))
    return result


def infer_category(text: str) -> str | None:
    matches = {
        category
        for category, pattern in _CATEGORY_PATTERNS
        if pattern.search(text or "")
    }
    if len(matches) == 1:
        return next(iter(matches))
    return None


def normalize_category(value: str | None) -> str | None:
    if not value:
        return None
    lowered = value.strip().lower()
    if lowered in CATEGORY_KEYS:
        return lowered
    return infer_category(lowered)


def mentioned_colors(text: str) -> set[str]:
    return {match.lower() for match in _COLOR_PATTERN.findall(text or "")}


def mentioned_numbers(text: str) -> set[float]:
    return {float(match) for match in _NUMBER_PATTERN.findall(text or "")}


def extract_price_limit(text: str) -> float | None:
    for pattern in _PRICE_PATTERNS:
        match = pattern.search(text or "")
        if match:
            return float(match.group(1))
    return None


def mentioned_quantities(text: str) -> set[int]:
    lowered = (text or "").lower()
    values: set[int] = set()
    for word, value in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", lowered):
            values.add(value)
    for pattern in (
        r"\b(?:add|put|buy|get|order|take)\s+(?:me\s+)?(\d{1,3})\b",
        r"\b(\d{1,3})\s*(?:x|pieces?|items?|units?)\b",
        r"\b(\d{1,3})\s+(?:[a-z]+\s+){0,2}(?:tshirts?|shirts?|hoodies?|shoes?|hats?|caps?|accessor(?:y|ies))\b",
    ):
        for match in re.finditer(pattern, lowered):
            values.add(int(match.group(1)))
    return values


def sanitize_args(tool_name: str, args: dict[str, Any], message: str | None) -> dict[str, Any]:
    result = dict(args)
    if not message:
        return result

    color_tools = {"search_products", "add_to_cart", "remove_from_cart", "open_product"}
    if tool_name in color_tools:
        colors = mentioned_colors(message)
        if "color" in result:
            color = str(result["color"]).lower()
            if colors:
                if color in colors:
                    result["color"] = color
                elif len(colors) == 1:
                    result["color"] = next(iter(colors))
                else:
                    result.pop("color")
            else:
                result.pop("color")
        elif len(colors) == 1:
            result["color"] = next(iter(colors))
    else:
        result.pop("color", None)

    inferred_category = infer_category(message) if tool_name == "search_products" else None
    if tool_name == "search_products":
        if inferred_category is not None:
            result["category"] = inferred_category
        else:
            result.pop("category", None)
    else:
        result.pop("category", None)

    if tool_name == "search_products":
        if "max_price" in result:
            price = extract_price_limit(message)
            if price is not None:
                result["max_price"] = price
            else:
                try:
                    value = float(result["max_price"])
                except (TypeError, ValueError):
                    value = None
                if value is None or value not in mentioned_numbers(message):
                    result.pop("max_price")
        else:
            price = extract_price_limit(message)
            if price is not None:
                result["max_price"] = price
    else:
        result.pop("max_price", None)

    if tool_name == "add_to_cart":
        if "qty" in result:
            quantities = mentioned_quantities(message)
            try:
                qty = int(result["qty"])
            except (TypeError, ValueError):
                qty = None
            if quantities:
                if qty in quantities:
                    pass
                elif len(quantities) == 1:
                    result["qty"] = next(iter(quantities))
                else:
                    result.pop("qty")
            else:
                result.pop("qty")
        else:
            quantities = mentioned_quantities(message)
            if len(quantities) == 1:
                result["qty"] = next(iter(quantities))
    else:
        result.pop("qty", None)

    if "query" in result:
        query_tokens = set(tokenize(str(result["query"])))
        message_tokens = set(tokenize(message))
        if query_tokens and not query_tokens.intersection(message_tokens):
            if inferred_category is not None:
                result["query"] = inferred_category
            elif re.search(r"\b(?:all|everything|anything)\b", message, re.IGNORECASE):
                result["query"] = "all"

    return result
