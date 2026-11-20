from __future__ import annotations

import hmac
import threading
import time
from typing import Callable, Protocol

from app.models import PendingAction


class ConfirmStore(Protocol):
    async def put(self, action: PendingAction) -> None: ...

    async def pop(self, action_id: str, identity: str) -> PendingAction | None: ...

    async def cleanup(self) -> int: ...


class InMemoryConfirmStore:
    def __init__(
        self,
        ttl_s: float = 120.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if ttl_s <= 0:
            raise ValueError("ttl_s must be positive")
        self._ttl_s = ttl_s
        self._clock = clock
        self._lock = threading.Lock()
        self._actions: dict[str, PendingAction] = {}

    @property
    def ttl_s(self) -> float:
        return self._ttl_s

    async def put(self, action: PendingAction) -> None:
        now = self._clock()
        with self._lock:
            self._purge_locked(now)
            self._actions[action.action_id] = action

    async def pop(self, action_id: str, identity: str) -> PendingAction | None:
        now = self._clock()
        with self._lock:
            self._purge_locked(now)
            action = self._actions.get(action_id)
            if action is None:
                return None
            if not hmac.compare_digest(action.identity_hash, identity):
                return None
            del self._actions[action_id]
            return action

    async def cleanup(self) -> int:
        with self._lock:
            return self._purge_locked(self._clock())

    def _purge_locked(self, now: float) -> int:
        expired = [key for key, action in self._actions.items() if action.expires_at <= now]
        for key in expired:
            del self._actions[key]
        return len(expired)

    def __len__(self) -> int:
        with self._lock:
            self._purge_locked(self._clock())
            return len(self._actions)
