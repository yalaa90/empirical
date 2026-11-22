from __future__ import annotations

from tests.conftest import action


def test_health_ok(make_harness) -> None:
    with make_harness([], healthy=True) as h:
        response = h.client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["llm"] == "ok"
        assert body["tools"] == 7


def test_health_degraded(make_harness) -> None:
    with make_harness([], healthy=False) as h:
        response = h.client.get("/health")
        assert response.status_code == 503
        body = response.json()
        assert body["status"] == "degraded"
        assert body["llm"] == "unreachable"


def test_request_id_header_is_echoed(make_harness) -> None:
    with make_harness([action("none", reason="chat")]) as h:
        response = h.client.post(
            "/chat",
            json={"message": "hello"},
            headers={"X-Session-Id": "alice", "X-Request-ID": "req-123"},
        )
        assert response.headers["X-Request-ID"] == "req-123"
