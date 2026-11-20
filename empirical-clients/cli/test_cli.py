from __future__ import annotations

import io
import json
import os
import tempfile
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

import empirical_cli

LATENCY = {"queue": 0, "llm": 1500, "validate": 1, "api": 4, "total": 1505}


class State:
    last_headers: dict[str, str] = {}
    last_message: str | None = None
    confirm_calls = 0
    chat_calls = 0


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args: object) -> None:
        pass

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(
                200,
                {
                    "status": "ok",
                    "llm": "ok",
                    "model": "qwen-test",
                    "tools": 4,
                    "structured_mode": "json_schema",
                },
            )
        else:
            self._send(404, {"status": "error", "code": "not_found", "message": "not found"})

    def do_POST(self) -> None:
        State.last_headers = dict(self.headers)

        if self.path.startswith("/confirm/"):
            State.confirm_calls += 1
            action_id = self.path.split("/confirm/", 1)[1]
            if action_id != "action-123" or self.headers.get("X-Session-Id") != "alice":
                self._send(
                    404,
                    {
                        "status": "error",
                        "code": "action_unavailable",
                        "message": "Unknown, expired, already used, or not owned by this session.",
                    },
                )
                return
            self._send(
                200,
                {
                    "status": "ok",
                    "tool": "delete_item",
                    "result": "Deleted item 5",
                    "data": {"deleted": True, "id": 5},
                    "latency_ms": LATENCY,
                },
            )
            return

        if self.path != "/chat":
            self._send(404, {"status": "error", "code": "not_found", "message": "not found"})
            return

        State.chat_calls += 1
        message = self._body().get("message", "")
        State.last_message = message

        if message == "add 3 apples":
            self._send(
                200,
                {
                    "status": "ok",
                    "tool": "add_item",
                    "result": "Added 3 apples",
                    "data": {"id": 1, "name": "apples", "qty": 3},
                    "latency_ms": LATENCY,
                },
            )
        elif message == "list all items":
            self._send(
                200,
                {
                    "status": "ok",
                    "tool": "list_items",
                    "result": "Found 2 item(s).",
                    "data": {
                        "items": [
                            {"id": 1, "name": "apples", "qty": 3},
                            {"id": 2, "name": "oranges", "qty": 4},
                        ],
                        "count": 2,
                    },
                    "latency_ms": LATENCY,
                },
            )
        elif message == "weather":
            self._send(
                200,
                {
                    "status": "no_action",
                    "tool": "none",
                    "reason": "No inventory tool matches a weather question.",
                    "latency_ms": LATENCY,
                },
            )
        elif message == "delete item 5":
            self._send(
                200,
                {
                    "status": "needs_confirmation",
                    "action_id": "action-123",
                    "summary": "Delete item 5?",
                    "tool": "delete_item",
                    "expires_in_s": 120,
                    "latency_ms": LATENCY,
                },
            )
        elif message == "boom":
            self._send(
                503,
                {
                    "status": "error",
                    "code": "llm_busy",
                    "message": "The local model is busy; retry shortly.",
                },
            )
        else:
            self._send(
                200,
                {
                    "status": "ok",
                    "tool": "none",
                    "result": f"echo: {message}",
                    "latency_ms": LATENCY,
                },
            )


class CliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        host, port = cls.server.server_address[:2]
        cls.base = f"http://{host}:{port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self) -> None:
        State.last_headers = {}
        State.last_message = None
        State.confirm_calls = 0
        State.chat_calls = 0

    def run_cli(self, *args: str) -> tuple[int, str, str]:
        argv = ["--api-url", self.base, "--no-color", *args]
        out = io.StringIO()
        err = io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = empirical_cli.main(argv)
        return code, out.getvalue(), err.getvalue()

    def test_add_success(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--message", "add 3 apples")
        self.assertEqual(code, 0)
        self.assertIn("Added 3 apples", out)
        self.assertEqual(State.last_headers.get("X-Session-Id"), "alice")

    def test_positional_message(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "add 3 apples")
        self.assertEqual(code, 0)
        self.assertIn("Added 3 apples", out)
        self.assertEqual(State.last_message, "add 3 apples")

    def test_unquoted_positional_message_with_options_after(self) -> None:
        code, out, _ = self.run_cli("add", "3", "apples", "--session", "alice")
        self.assertEqual(code, 0)
        self.assertIn("Added 3 apples", out)
        self.assertEqual(State.last_message, "add 3 apples")
        self.assertEqual(State.last_headers.get("X-Session-Id"), "alice")

    def test_short_message_flag(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "-m", "add 3 apples")
        self.assertEqual(code, 0)
        self.assertIn("Added 3 apples", out)

    def test_positional_message_conflicts_with_flag(self) -> None:
        argv = [
            "--api-url",
            self.base,
            "--no-color",
            "-m",
            "add 3 apples",
            "delete",
        ]
        err = io.StringIO()
        with redirect_stdout(io.StringIO()), redirect_stderr(err):
            with self.assertRaises(SystemExit) as context:
                empirical_cli.main(argv)
        self.assertEqual(context.exception.code, 2)
        self.assertIn("not both", err.getvalue())

    def test_list_items_table(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--message", "list all items")
        self.assertEqual(code, 0)
        self.assertIn("Found 2 item(s).", out)
        self.assertIn("oranges", out)
        self.assertIn("NAME", out)

    def test_json_output(self) -> None:
        code, out, _ = self.run_cli(
            "--session", "alice", "--message", "add 3 apples", "--json"
        )
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["tool"], "add_item")

    def test_no_action(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--message", "weather")
        self.assertEqual(code, 0)
        self.assertIn("No inventory tool matches a weather question.", out)
        self.assertIn("no action", out.lower())

    def test_needs_confirmation_without_yes(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--message", "delete item 5")
        self.assertEqual(code, 0)
        self.assertIn("Delete item 5?", out)
        self.assertIn("--confirm", out)
        self.assertEqual(State.confirm_calls, 0)

    def test_needs_confirmation_with_yes(self) -> None:
        code, out, _ = self.run_cli(
            "--session", "alice", "--message", "delete item 5", "--yes"
        )
        self.assertEqual(code, 0)
        self.assertIn("Deleted item 5", out)
        self.assertEqual(State.confirm_calls, 1)

    def test_confirm_success(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--confirm", "action-123")
        self.assertEqual(code, 0)
        self.assertIn("Deleted item 5", out)

    def test_confirm_wrong_session(self) -> None:
        code, out, _ = self.run_cli("--session", "bob", "--confirm", "action-123")
        self.assertEqual(code, 1)
        self.assertIn("action_unavailable", out)

    def test_api_error_exit_code(self) -> None:
        code, out, _ = self.run_cli("--session", "alice", "--message", "boom")
        self.assertEqual(code, 1)
        self.assertIn("busy", out)
        self.assertIn("llm_busy", out)

    def test_health(self) -> None:
        code, out, _ = self.run_cli("--health")
        self.assertEqual(code, 0)
        self.assertIn("API online", out)
        self.assertIn("qwen-test", out)

    def test_health_json(self) -> None:
        code, out, _ = self.run_cli("--health", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["status"], "ok")

    def test_bearer_token_header(self) -> None:
        code, _, _ = self.run_cli(
            "--session", "alice", "--token", "secret-token", "--message", "add 3 apples"
        )
        self.assertEqual(code, 0)
        self.assertEqual(
            State.last_headers.get("Authorization"), "Bearer secret-token"
        )

    def test_message_too_long(self) -> None:
        code, out, _ = self.run_cli(
            "--session", "alice", "--message", "x" * 501
        )
        self.assertEqual(code, 1)
        self.assertIn("too long", out)
        self.assertEqual(State.chat_calls, 0)

    def test_history_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "history.json")
            code, _, _ = self.run_cli(
                "--session",
                "alice",
                "--message",
                "add 3 apples",
                "--history-file",
                path,
            )
            self.assertEqual(code, 0)
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertEqual(payload["session"], "alice")
            self.assertEqual(len(payload["messages"]), 2)
            self.assertEqual(payload["messages"][0]["content"], "add 3 apples")
            self.assertEqual(payload["messages"][1]["content"], "Added 3 apples")

    def test_interactive_chat_and_history_command(self) -> None:
        inputs = iter(["add 3 apples", "/history", "/quit"])
        with mock.patch("builtins.input", side_effect=lambda _prompt="": next(inputs)):
            out = io.StringIO()
            with redirect_stdout(out):
                code = empirical_cli.main(
                    ["--api-url", self.base, "--no-color", "--session", "alice"]
                )
        text = out.getvalue()
        self.assertEqual(code, 0)
        self.assertIn("Empirical CLI", text)
        self.assertIn("Added 3 apples", text)
        self.assertIn("Transcript", text)

    def test_connection_error(self) -> None:
        out = io.StringIO()
        with redirect_stdout(out), redirect_stderr(io.StringIO()):
            code = empirical_cli.main(
                [
                    "--api-url",
                    "http://127.0.0.1:1",
                    "--no-color",
                    "--timeout",
                    "2",
                    "--message",
                    "add 3 apples",
                ]
            )
        self.assertEqual(code, 1)
        self.assertIn("Could not reach", out.getvalue())


if __name__ == "__main__":
    unittest.main()
