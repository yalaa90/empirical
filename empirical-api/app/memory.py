"""Short-term conversation memory, kept per chat session.

The model sees one message at a time, so a follow-up like "add it" or
"add the second one" has nothing to refer to. This module remembers what the
last search returned (and which product the user last acted on). It uses that
to:

* give the model a short context block, and
* deterministically resolve referential follow-ups to a product from that
  list, so the cart never gets an unrelated product because the model guessed.
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from app.catalog_terms import tokenize

MAX_REMEMBERED_ITEMS = 10
PROMPT_ITEMS = 5

# Tools whose `product_name` can refer back to the remembered list.
REFERENTIAL_TOOLS = frozenset({"add_to_cart", "open_product"})

# Words that point at "the thing we were just talking about" and carry no
# product information of their own.
_REFERENCE_WORDS = frozenset(
    {
        "it",
        "this",
        "that",
        "these",
        "those",
        "them",
        "one",
        "ones",
        "item",
        "product",
        "cart",
        "basket",
        "bag",
        "again",
        "another",
        "more",
        "extra",
        "too",
        "also",
        "same",
        "buy",
        "order",
        "ll",
        "i",
        "pls",
        "now",
        "first",
        "second",
        "third",
        "fourth",
        "fifth",
        "last",
        "1st",
        "2nd",
        "3rd",
        "4th",
        "5th",
        "number",
        "no",
        "option",
        "result",
        "from",
        "list",
        "on",
        "at",
        "top",
        "qty",
        "quantity",
        "piece",
        "unit",
        "x",
    }
)
_QUANTITY_WORDS = frozenset(
    {"two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "pair"}
)

_ORDINALS: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"\b(?:first|1st|top)\b"), 0),
    (re.compile(r"\b(?:second|2nd)\b"), 1),
    (re.compile(r"\b(?:third|3rd)\b"), 2),
    (re.compile(r"\b(?:fourth|4th)\b"), 3),
    (re.compile(r"\b(?:fifth|5th)\b"), 4),
    (re.compile(r"\blast\b"), -1),
    (re.compile(r"(?:#|\bnumber\s+|\bno\.?\s+|\boption\s+)(\d{1,2})\b"), None),
)

_ADD_INTENT = re.compile(
    r"^\s*(?:please\s+)?(?:add|buy|order|put|get\s+me|i'?ll\s+take|i\s+want|take)\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class SessionMemory:
    # Products returned by the most recent search, in display order.
    results: list[dict[str, Any]] = field(default_factory=list)
    # Product the user most recently opened or added (for "add it again").
    focus: dict[str, Any] | None = None
    updated_at: float = 0.0


def _slim(product: dict[str, Any]) -> dict[str, Any] | None:
    name = product.get("name")
    if not isinstance(name, str) or not name.strip():
        return None
    slim: dict[str, Any] = {"name": name.strip()}
    for key in ("id", "product_id", "color", "category", "price", "brand", "tags"):
        if key in product and product[key] is not None:
            slim[key] = product[key]
    if "id" not in slim and "product_id" in slim:
        slim["id"] = slim["product_id"]
    slim.pop("product_id", None)
    return slim


def _product_tokens(product: dict[str, Any]) -> set[str]:
    parts = [
        str(product.get("name", "")),
        str(product.get("brand", "")),
        str(product.get("category", "")),
        str(product.get("color", "")),
    ]
    tags = product.get("tags")
    if isinstance(tags, list):
        parts.extend(str(tag) for tag in tags)
    tokens = set(tokenize(" ".join(parts)))
    category = str(product.get("category", ""))
    if category == "tshirt":
        tokens.update({"shirt", "tee", "tshirt"})
    return tokens


def _content_tokens(message: str) -> list[str]:
    tokens = []
    for token in tokenize(message):
        if token in _REFERENCE_WORDS or token in _QUANTITY_WORDS or token.isdigit():
            continue
        tokens.append(token)
    return tokens


def _ordinal_index(message: str, count: int) -> int | None:
    lowered = message.lower()
    for pattern, index in _ORDINALS:
        match = pattern.search(lowered)
        if not match:
            continue
        if index is None:
            index = int(match.group(1)) - 1
        if index < 0:
            index = count + index
        if 0 <= index < count:
            return index
    return None


class SessionMemoryStore:
    def __init__(
        self,
        ttl_s: float = 1800.0,
        max_sessions: int = 5000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._ttl_s = ttl_s
        self._max_sessions = max_sessions
        self._clock = clock
        self._lock = threading.Lock()
        self._sessions: dict[str, SessionMemory] = {}

    def get(self, identity: str) -> SessionMemory | None:
        now = self._clock()
        with self._lock:
            memory = self._sessions.get(identity)
            if memory is None:
                return None
            if now - memory.updated_at > self._ttl_s:
                del self._sessions[identity]
                return None
            return memory

    def _upsert(self, identity: str) -> SessionMemory:
        now = self._clock()
        memory = self._sessions.get(identity)
        if memory is None or now - memory.updated_at > self._ttl_s:
            if len(self._sessions) >= self._max_sessions:
                oldest = min(self._sessions, key=lambda key: self._sessions[key].updated_at)
                del self._sessions[oldest]
            memory = SessionMemory()
            self._sessions[identity] = memory
        memory.updated_at = now
        return memory

    def record(self, identity: str, tool: str, data: Any) -> None:
        """Update memory from a successfully executed tool call."""
        if not isinstance(data, dict):
            return
        with self._lock:
            if tool == "search_products":
                items = data.get("items")
                if not isinstance(items, list):
                    return
                slim = [s for s in (_slim(i) for i in items if isinstance(i, dict)) if s]
                memory = self._upsert(identity)
                memory.results = slim[:MAX_REMEMBERED_ITEMS]
                memory.focus = None
            elif tool in REFERENTIAL_TOOLS:
                product = _slim(data)
                if product is None:
                    return
                memory = self._upsert(identity)
                memory.focus = product
            elif tool == "empty_cart":
                memory = self._sessions.get(identity)
                if memory is not None:
                    memory.focus = None

    def clear(self, identity: str) -> None:
        with self._lock:
            self._sessions.pop(identity, None)


def prompt_context(memory: SessionMemory | None) -> str | None:
    """A compact context block for the model, or None when there is nothing."""
    if memory is None or (not memory.results and memory.focus is None):
        return None
    lines = []
    if memory.results:
        lines.append("Products currently shown to the user (from their last search):")
        for index, product in enumerate(memory.results[:PROMPT_ITEMS], start=1):
            color = product.get("color")
            suffix = f" ({color})" if color else ""
            lines.append(f"{index}. {product['name']}{suffix}")
    if memory.focus is not None:
        lines.append(f"Product the user last selected: {memory.focus['name']}")
    lines.append(
        "If the user refers to one of these (it, this, that one, the second one, or "
        "just 'add'), use its exact name as product_name."
    )
    return "\n".join(lines)


def is_bare_add(message: str) -> bool:
    """True for add-intent messages that name no product, e.g. 'add', 'add it'."""
    return bool(_ADD_INTENT.search(message)) and not _content_tokens(_strip_intent(message))


def _strip_intent(message: str) -> str:
    return _ADD_INTENT.sub(" ", message, count=1)


def resolve_product(
    message: str,
    memory: SessionMemory | None,
) -> dict[str, Any] | None:
    """Pick the remembered product the user's message refers to.

    Returns None when the message names something that is not in memory, so
    explicit requests ("add a black hoodie") are left to the model.
    """
    if memory is None:
        return None
    results = memory.results
    text = _strip_intent(message)

    index = _ordinal_index(text, len(results))
    if index is not None:
        return results[index]

    wanted = _content_tokens(text)
    if not wanted:
        # Pure reference: "add", "add it", "add 2 of them", "open that".
        if memory.focus is not None:
            return memory.focus
        return results[0] if results else None

    # The user described the product. Only resolve when every word they used
    # fits a remembered product; otherwise they are asking for something new.
    pool = list(results)
    if memory.focus is not None and memory.focus not in pool:
        pool.insert(0, memory.focus)
    for product in pool:
        if set(wanted) <= _product_tokens(product):
            return product
    return None
