from __future__ import annotations

from tests.conftest import action


def test_remove_requires_confirmation_and_is_session_bound(make_harness) -> None:
    with make_harness([action("remove_from_cart", product_name="tshirt", color="red")]) as h:
        h.storefront.add_to_cart("tshirt", color="red")
        response = h.client.post(
            "/chat",
            json={"message": "remove the red tshirt from my cart"},
            headers={"X-Session-Id": "alice"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "needs_confirmation"
        assert body["summary"] == "Remove tshirt from your cart?"
        assert body["expires_in_s"] == 120
        action_id = body["action_id"]
        assert len(h.storefront.cart_items()) == 1

        wrong = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "bob"})
        assert wrong.status_code == 404
        assert wrong.json()["code"] == "action_unavailable"
        assert len(h.storefront.cart_items()) == 1

        confirmed = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "alice"})
        assert confirmed.status_code == 200
        result = confirmed.json()
        assert result["status"] == "ok"
        assert result["result"] == "Removed Northline Red Classic T-Shirt from cart."
        assert h.storefront.cart_items() == []

        replay = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "alice"})
        assert replay.status_code == 404


def test_empty_cart_requires_confirmation_and_is_session_bound(make_harness) -> None:
    with make_harness([action("empty_cart")]) as h:
        h.storefront.add_to_cart("tshirt", color="red")
        h.storefront.add_to_cart("hoodie", color="black")
        response = h.client.post(
            "/chat",
            json={"message": "empty my cart"},
            headers={"X-Session-Id": "alice"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "needs_confirmation"
        assert body["summary"] == "Empty your entire cart?"
        action_id = body["action_id"]
        assert len(h.storefront.cart_items()) == 2

        wrong = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "bob"})
        assert wrong.status_code == 404
        assert wrong.json()["code"] == "action_unavailable"
        assert len(h.storefront.cart_items()) == 2

        confirmed = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "alice"})
        assert confirmed.status_code == 200
        result = confirmed.json()
        assert result["status"] == "ok"
        assert result["result"] == "Emptied your cart."
        assert h.storefront.cart_items() == []

        replay = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "alice"})
        assert replay.status_code == 404


def test_expired_confirmation_returns_404(make_harness) -> None:
    with make_harness([action("remove_from_cart", product_name="tshirt", color="red")]) as h:
        h.storefront.add_to_cart("tshirt", color="red")
        response = h.client.post(
            "/chat",
            json={"message": "remove the red tshirt from my cart"},
            headers={"X-Session-Id": "alice"},
        )
        action_id = response.json()["action_id"]
        assert len(h.store) == 1

        h.clock.advance(121)
        confirmed = h.client.post(f"/confirm/{action_id}", headers={"X-Session-Id": "alice"})
        assert confirmed.status_code == 404
        assert confirmed.json()["code"] == "action_unavailable"
        assert len(h.store) == 0
        assert len(h.storefront.cart_items()) == 1


def test_confirm_unknown_action_returns_404(make_harness) -> None:
    with make_harness([]) as h:
        response = h.client.post("/confirm/does-not-exist", headers={"X-Session-Id": "alice"})
        assert response.status_code == 404
        assert response.json()["code"] == "action_unavailable"
