#!/usr/bin/env python3
"""Interactive and one-shot CLI client for the Empirical chat-to-API orchestrator.

Only the Python standard library is used. See ``./empirical_cli.py --help``.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Any

try:
    import readline

    readline.set_history_length(500)
except ImportError:
    readline = None


VERSION = "1.0.0"
DEFAULT_API_URL = "http://127.0.0.1:8000"
MAX_MESSAGE_CHARS = 500

COLORS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "magenta": "\033[35m",
    "cyan": "\033[36m",
}


def supports_color() -> bool:
    if os.environ.get("NO_COLOR") is not None:
        return False
    if os.environ.get("TERM") == "dumb":
        return False
    return bool(getattr(sys.stdout, "isatty", lambda: False)())


class Paint:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def __call__(self, text: str, *styles: str) -> str:
        if not self.enabled or not styles:
            return text
        prefix = "".join(COLORS.get(style, "") for style in styles)
        return f"{prefix}{text}{COLORS['reset']}"


@dataclass
class Config:
    api_url: str
    session_id: str
    token: str | None
    timeout: float
    json_mode: bool
    color: bool
    assume_yes: bool
    history_file: str | None
    transcript: list[dict[str, Any]] = field(default_factory=list)


def normalize_token(token: str) -> str:
    value = token.strip()
    if re.match(r"^(bearer|basic)\s+", value, re.IGNORECASE):
        return value
    return f"Bearer {value}"


def _headers(cfg: Config, *, with_body: bool = False) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "User-Agent": f"empirical-cli/{VERSION}",
        "X-Session-Id": cfg.session_id,
    }
    if with_body:
        headers["Content-Type"] = "application/json"
    if cfg.token:
        headers["Authorization"] = normalize_token(cfg.token)
    return headers


def _decode(raw: bytes) -> Any:
    if not raw:
        return {}
    text = raw.decode("utf-8", errors="replace").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def request_json(
    cfg: Config,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    url = cfg.api_url.rstrip("/") + path
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers=_headers(cfg, with_body=payload is not None),
    )

    try:
        with urllib.request.urlopen(request, timeout=cfg.timeout) as response:
            return response.status, _decode(response.read())
    except urllib.error.HTTPError as exc:
        body = _decode(exc.read())
        if not isinstance(body, dict):
            body = {
                "status": "error",
                "code": f"http_{exc.code}",
                "message": str(body)[:500],
            }
        return exc.code, body
    except urllib.error.URLError as exc:
        reason = exc.reason
        if isinstance(reason, (socket.timeout, TimeoutError)):
            raise TimeoutError("The request timed out.") from exc
        raise ConnectionError(
            f"Could not reach {cfg.api_url}: {reason}"
        ) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise TimeoutError("The request timed out.") from exc


def post_chat(cfg: Config, message: str) -> tuple[int, Any]:
    return request_json(cfg, "POST", "/chat", {"message": message})


def post_confirm(cfg: Config, action_id: str) -> tuple[int, Any]:
    quoted = urllib.parse.quote(action_id, safe="")
    return request_json(cfg, "POST", f"/confirm/{quoted}")


def get_health(cfg: Config) -> tuple[int, Any]:
    return request_json(cfg, "GET", "/health")


def as_body(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {
        "status": "error",
        "code": "invalid_response",
        "message": str(value)[:500],
    }


def format_latency(body: dict[str, Any]) -> str:
    latency = body.get("latency_ms")
    if not isinstance(latency, dict):
        return ""
    total = latency.get("total")
    if not isinstance(total, (int, float)):
        return ""
    parts = [f"{total}ms" if total < 1000 else f"{total / 1000:.1f}s"]
    detail = ", ".join(
        f"{key} {latency[key]}ms"
        for key in ("llm", "api")
        if isinstance(latency.get(key), (int, float)) and latency.get(key)
    )
    if detail:
        parts.append(detail)
    return " · ".join(parts)


def format_data(data: Any) -> str:
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        items = [item for item in data["items"] if isinstance(item, dict)]
        if not items:
            return "  (no items)"
        headers = ("ID", "NAME", "QTY")
        rows = [
            (
                str(item.get("id", "")),
                str(item.get("name", "")),
                str(item.get("qty", "")),
            )
            for item in items
        ]
        widths = [
            max(len(headers[i]), *(len(row[i]) for row in rows))
            for i in range(3)
        ]

        def line(row: tuple[str, str, str]) -> str:
            return "  " + "  ".join(
                value.ljust(widths[i]) for i, value in enumerate(row)
            ).rstrip()

        return "\n".join(
            [
                line(headers),
                "  " + "  ".join("-" * width for width in widths),
                *(line(row) for row in rows),
            ]
        )
    return json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False)


def response_summary(body: dict[str, Any]) -> str:
    status = body.get("status")
    if status == "ok":
        return str(body.get("result", "Done."))
    if status == "no_action":
        return str(body.get("reason", "No matching tool."))
    if status == "needs_confirmation":
        return str(body.get("summary", "This action needs confirmation."))
    return str(body.get("message", "The request failed."))


def render_response(cfg: Config, status_code: int, value: Any) -> str:
    body = as_body(value)
    if cfg.json_mode:
        return json.dumps(body, indent=2, ensure_ascii=False)

    paint = Paint(cfg.color)
    status = body.get("status")
    latency = format_latency(body)

    if status == "ok":
        lines = [paint("empirical> ", "green", "bold") + str(body.get("result", "Done."))]
        data = body.get("data")
        if data:
            lines.append(paint(format_data(data), "dim"))
        footer = []
        if body.get("tool"):
            footer.append(str(body["tool"]))
        if latency:
            footer.append(latency)
        if footer:
            lines.append(paint(f"[{' · '.join(footer)}]", "dim"))
        return "\n".join(lines)

    if status == "no_action":
        lines = [paint("empirical> ", "yellow", "bold") + str(body.get("reason", "No matching tool."))]
        footer = ["no action"] + ([latency] if latency else [])
        lines.append(paint(f"[{' · '.join(footer)}]", "dim"))
        return "\n".join(lines)

    if status == "needs_confirmation":
        summary = str(body.get("summary", "This action needs confirmation."))
        lines = [paint("empirical> ", "yellow", "bold") + summary]
        details = []
        if body.get("tool"):
            details.append(str(body["tool"]))
        if body.get("expires_in_s") is not None:
            details.append(f"expires in {body['expires_in_s']}s")
        if latency:
            details.append(latency)
        details.append(f"action {body.get('action_id', '?')}")
        lines.append(paint(f"[{' · '.join(details)}]", "dim"))
        return "\n".join(lines)

    code = body.get("code", f"http_{status_code}")
    message = str(body.get("message", "The request failed."))
    return "\n".join(
        [
            paint("error: ", "red", "bold") + message,
            paint(f"[{code} · HTTP {status_code}]", "dim"),
        ]
    )


def render_health(cfg: Config, status_code: int, value: Any) -> str:
    body = as_body(value)
    if cfg.json_mode:
        return json.dumps(body, indent=2, ensure_ascii=False)

    paint = Paint(cfg.color)
    status = body.get("status")
    model = body.get("model", "?")
    tools = body.get("tools", "?")
    mode = body.get("structured_mode", "?")

    if status_code == 200 and status == "ok":
        return (
            paint("API online", "green", "bold")
            + f" · model {model} · tools {tools} · mode {mode}"
        )
    if status_code == 503:
        return (
            paint("API degraded", "yellow", "bold")
            + f" · llm {body.get('llm', '?')} · model {model}"
        )
    return (
        paint("API error", "red", "bold")
        + f" · HTTP {status_code} · {response_summary(body)}"
    )


class Spinner:
    FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

    def __init__(self, enabled: bool, label: str = "thinking") -> None:
        self.enabled = bool(enabled) and supports_color()
        self.label = label
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def __enter__(self) -> "Spinner":
        if self.enabled:
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        if not self.enabled:
            return
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=0.5)
        width = len(self.label) + 4
        sys.stdout.write("\r" + " " * width + "\r")
        sys.stdout.flush()

    def _run(self) -> None:
        index = 0
        while not self._stop.wait(0.09):
            frame = self.FRAMES[index % len(self.FRAMES)]
            sys.stdout.write(f"\r\033[2m{frame} {self.label}…\033[0m")
            sys.stdout.flush()
            index += 1


def print_transcript(cfg: Config) -> None:
    paint = Paint(cfg.color)
    if not cfg.transcript:
        print(paint("No messages in this session yet.", "dim"))
        return
    print(paint(f"Transcript ({len(cfg.transcript)} messages)", "bold"))
    for entry in cfg.transcript:
        role = entry.get("role", "assistant")
        if role == "user":
            print(f"{paint('you>', 'cyan', 'bold')} {entry.get('content', '')}")
        else:
            tool = entry.get("tool")
            suffix = paint(f" [{tool}]", "magenta") if tool else ""
            print(f"{paint('empirical>', 'green', 'bold')} {entry.get('content', '')}{suffix}")


def confirm_pending(cfg: Config, body: dict[str, Any], *, interactive: bool) -> bool:
    paint = Paint(cfg.color)
    action_id = str(body.get("action_id", ""))
    summary = str(body.get("summary", "Confirm this action?"))
    if not action_id:
        print(paint("The API returned no action id; nothing to confirm.", "red"))
        return False

    if cfg.assume_yes:
        print(paint("Auto-confirming (--yes)…", "dim"))
        return execute_confirm(cfg, action_id)

    if interactive:
        prompt = paint(f"{summary} [y/N] ", "yellow", "bold")
        try:
            answer = input(prompt).strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            answer = ""
        if answer in {"y", "yes"}:
            return execute_confirm(cfg, action_id)
        print(paint("Cancelled.", "dim"))
        return True

    print(
        paint(
            f"Action not executed. Re-run with --yes or: "
            f"--session {cfg.session_id} --confirm {action_id}",
            "dim",
        )
    )
    return True


def execute_confirm(cfg: Config, action_id: str) -> bool:
    paint = Paint(cfg.color)
    try:
        with Spinner(cfg.color, "confirming"):
            status_code, body = post_confirm(cfg, action_id)
    except TimeoutError as exc:
        print(paint(str(exc), "red"))
        return False
    except (ConnectionError, OSError) as exc:
        print(paint(str(exc), "red"))
        return False

    body = as_body(body)
    print(render_response(cfg, status_code, body))
    append_assistant(cfg, body)
    return status_code < 400 and body.get("status") == "ok"


def append_assistant(cfg: Config, body: dict[str, Any]) -> None:
    cfg.transcript.append(
        {
            "role": "assistant",
            "content": response_summary(body),
            "status": body.get("status"),
            "tool": body.get("tool"),
            "at": time.time(),
        }
    )


def handle_chat(cfg: Config, message: str, *, interactive: bool) -> bool:
    paint = Paint(cfg.color)
    text = message.strip()
    if not text:
        print(paint("Message is empty.", "red"))
        return False
    if len(text) > MAX_MESSAGE_CHARS:
        print(
            paint(
                f"Message is too long ({len(text)} chars, max {MAX_MESSAGE_CHARS}).",
                "red",
            )
        )
        return False

    cfg.transcript.append(
        {"role": "user", "content": text, "at": time.time()}
    )

    try:
        with Spinner(cfg.color, "thinking"):
            status_code, body = post_chat(cfg, text)
    except TimeoutError as exc:
        print(paint(f"{exc} The local model may still be warming up.", "red"))
        return False
    except (ConnectionError, OSError) as exc:
        print(paint(str(exc), "red"))
        return False

    body = as_body(body)
    print(render_response(cfg, status_code, body))
    append_assistant(cfg, body)

    if body.get("status") == "needs_confirmation":
        return confirm_pending(cfg, body, interactive=interactive)

    if status_code >= 400 or body.get("status") == "error":
        return False
    return True


def handle_health(cfg: Config) -> bool:
    paint = Paint(cfg.color)
    try:
        status_code, body = get_health(cfg)
    except TimeoutError as exc:
        print(paint(str(exc), "red"))
        return False
    except (ConnectionError, OSError) as exc:
        print(paint(str(exc), "red"))
        return False

    print(render_health(cfg, status_code, body))
    return status_code == 200


def handle_confirm_command(cfg: Config, action_id: str) -> bool:
    return execute_confirm(cfg, action_id)


HELP_TEXT = """\
Commands:
  /help                 Show this help
  /new [session]        Start a fresh session and clear the transcript
  /session <id>         Switch to a session id (clears the transcript)
  /history              Show the in-memory transcript
  /clear                Clear the in-memory transcript
  /health               Check the API and LLM health
  /json on|off          Toggle raw JSON output
  /api <url>            Change the API base URL
  /token [token]        Set or clear the Authorization token
  /yes on|off           Toggle auto-confirm for destructive actions
  /quit                 Exit

Anything else is sent to POST /chat. Destructive tools ask for confirmation
unless auto-confirm is enabled."""


def handle_command(cfg: Config, line: str) -> bool:
    paint = Paint(cfg.color)
    command, _, argument = line.partition(" ")
    command = command.lower()
    argument = argument.strip()

    if command in {"/quit", "/exit"}:
        return False
    if command == "/help":
        print(HELP_TEXT)
        return True
    if command == "/new":
        cfg.session_id = argument or f"cli-{uuid.uuid4().hex[:8]}"
        cfg.transcript.clear()
        print(paint(f"New session: {cfg.session_id}", "green"))
        return True
    if command == "/session":
        if not argument:
            print(paint(f"Current session: {cfg.session_id}", "dim"))
            return True
        cfg.session_id = argument
        cfg.transcript.clear()
        print(paint(f"Session set to {cfg.session_id} (transcript cleared).", "green"))
        return True
    if command == "/history":
        print_transcript(cfg)
        return True
    if command == "/clear":
        cfg.transcript.clear()
        print(paint("Transcript cleared.", "dim"))
        return True
    if command == "/health":
        handle_health(cfg)
        return True
    if command == "/json":
        if argument.lower() in {"on", "off"}:
            cfg.json_mode = argument.lower() == "on"
        elif not argument:
            cfg.json_mode = not cfg.json_mode
        else:
            print(paint("Usage: /json on|off", "red"))
            return True
        print(paint(f"JSON output {'on' if cfg.json_mode else 'off'}.", "dim"))
        return True
    if command == "/api":
        if not argument:
            print(paint(f"API URL: {cfg.api_url}", "dim"))
            return True
        cfg.api_url = argument.rstrip("/")
        print(paint(f"API URL set to {cfg.api_url}", "green"))
        return True
    if command == "/token":
        if argument:
            cfg.token = argument
            print(paint("Authorization token set for this session.", "green"))
        else:
            cfg.token = None
            print(paint("Authorization token cleared.", "dim"))
        return True
    if command == "/yes":
        if argument.lower() in {"on", "off"}:
            cfg.assume_yes = argument.lower() == "on"
        elif not argument:
            cfg.assume_yes = not cfg.assume_yes
        else:
            print(paint("Usage: /yes on|off", "red"))
            return True
        print(paint(f"Auto-confirm {'on' if cfg.assume_yes else 'off'}.", "dim"))
        return True

    print(paint(f"Unknown command: {command}. Type /help.", "red"))
    return True


def interactive_loop(cfg: Config) -> None:
    paint = Paint(cfg.color)
    print(paint(f"Empirical CLI {VERSION}", "bold"))
    print(
        paint(
            f"session {cfg.session_id} · api {cfg.api_url}",
            "dim",
        )
    )
    print(paint("Type /help for commands, /quit to exit.", "dim"))

    while True:
        prompt = paint("you> ", "cyan", "bold")
        try:
            line = input(prompt)
        except EOFError:
            print()
            break
        except KeyboardInterrupt:
            print()
            continue

        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("/"):
            if not handle_command(cfg, stripped):
                break
            save_history(cfg)
        else:
            handle_chat(cfg, stripped, interactive=True)
            save_history(cfg)


def load_history(cfg: Config) -> None:
    if not cfg.history_file:
        return
    try:
        with open(cfg.history_file, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(payload, dict):
        return
    if payload.get("session") != cfg.session_id:
        return
    messages = payload.get("messages")
    if isinstance(messages, list):
        cfg.transcript = [item for item in messages if isinstance(item, dict)]


def save_history(cfg: Config) -> None:
    if not cfg.history_file:
        return
    payload = {"session": cfg.session_id, "messages": cfg.transcript}
    path = os.path.abspath(cfg.history_file)
    directory = os.path.dirname(path)
    try:
        if directory:
            os.makedirs(directory, exist_ok=True)
        temporary = f"{path}.tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        os.replace(temporary, path)
    except OSError as exc:
        print(Paint(False)(f"Could not save history: {exc}", "red"), file=sys.stderr)


def default_session() -> str:
    try:
        user = getpass.getuser()
    except Exception:
        user = "user"
    return f"cli-{user}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="empirical_cli.py",
        description="Chat with the Empirical chat-to-API orchestrator.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  ./empirical_cli.py --session alice
  ./empirical_cli.py --session alice "add 3 apples"
  ./empirical_cli.py add 3 apples --session alice
  ./empirical_cli.py --session alice "delete item 5" --yes
  ./empirical_cli.py --session alice --confirm ACTION_ID
  ./empirical_cli.py --health --json

Messages that start with a dash should be quoted or preceded by "--".
""",
    )
    parser.add_argument(
        "message_arg",
        nargs="*",
        metavar="MESSAGE",
        help="Message to send and exit (omit to start the interactive REPL)",
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("EMPIRICAL_API_URL", DEFAULT_API_URL),
        help=f"API base URL (default: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--session",
        "--session-id",
        dest="session_id",
        default=os.environ.get("EMPIRICAL_SESSION_ID") or default_session(),
        help="Value for the X-Session-Id header",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("EMPIRICAL_TOKEN"),
        help="Optional Authorization token (or set EMPIRICAL_TOKEN)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.environ.get("EMPIRICAL_TIMEOUT", "90")),
        help="Request timeout in seconds (default: 90)",
    )
    parser.add_argument(
        "-m",
        "--message",
        dest="message_option",
        metavar="MESSAGE",
        help="Send one message and exit (same as positional MESSAGE)",
    )
    parser.add_argument(
        "--confirm",
        metavar="ACTION_ID",
        help="Confirm a pending destructive action and exit",
    )
    parser.add_argument(
        "--health",
        action="store_true",
        help="Check API health and exit",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically confirm destructive actions",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print raw response JSON",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI colors",
    )
    parser.add_argument(
        "--history-file",
        metavar="PATH",
        help="Load and save the transcript for this session in a JSON file",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    positional_message = " ".join(args.message_arg).strip()
    if args.message_option and positional_message:
        parser.error("use either positional MESSAGE or -m/--message, not both")

    cfg = Config(
        api_url=(args.api_url or DEFAULT_API_URL).rstrip("/"),
        session_id=(args.session_id or default_session()).strip(),
        token=args.token,
        timeout=max(1.0, float(args.timeout)),
        json_mode=bool(args.json),
        color=supports_color() and not args.no_color,
        assume_yes=bool(args.yes),
        history_file=args.history_file,
    )

    if not cfg.api_url:
        cfg.api_url = DEFAULT_API_URL
    if not cfg.session_id:
        cfg.session_id = default_session()

    load_history(cfg)

    try:
        if args.health:
            return 0 if handle_health(cfg) else 1

        if args.confirm:
            success = handle_confirm_command(cfg, args.confirm)
            save_history(cfg)
            return 0 if success else 1

        message = args.message_option or positional_message
        if message:
            success = handle_chat(cfg, message, interactive=False)
            save_history(cfg)
            return 0 if success else 1

        interactive_loop(cfg)
        save_history(cfg)
        return 0
    except KeyboardInterrupt:
        print()
        save_history(cfg)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
