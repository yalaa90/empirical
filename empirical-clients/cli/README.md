# Empirical CLI

A dependency-free Python client for [`empirical-api`](../../empirical-api). It supports an
interactive REPL and one-shot commands, including the confirmation flow for
destructive tools.

Requires Python 3.11+ and only the standard library.

## Quick start

```bash
chmod +x empirical_cli.py
./empirical_cli.py --session alice
```

```
Empirical CLI 1.0.0
session alice · api http://127.0.0.1:8000
Type /help for commands, /quit to exit.
you> add 3 apples
empirical> Added 3 apples
  {
    "id": 1,
    "name": "apples",
    "qty": 3
  }
  [add_item · 1.5s · llm 1500ms, api 4ms]
```

One-shot: the message is a positional argument, so `-m` is optional.

```bash
./empirical_cli.py --session alice "list all items"
./empirical_cli.py list all items --session alice
./empirical_cli.py --session alice "add 3 apples" --json
./empirical_cli.py --session alice -m "add 3 apples"
./empirical_cli.py --health
```

Quote the message, or put it after `--`, when it starts with a dash. Passing both
a positional message and `-m/--message` is rejected.

## Destructive actions

Deleting an item requires confirmation. Interactively:

```
you> delete item 5
empirical> Delete item 5?
[delete_item · expires in 120s · action xyz…]
Delete item 5? [y/N] y
empirical> Deleted item 5
```

Non-interactive confirmation:

```bash
# Execute immediately
./empirical_cli.py --session alice "delete item 5" --yes

# Propose, then confirm the action id in a second call
./empirical_cli.py --session alice "delete item 5"
./empirical_cli.py --session alice --confirm ACTION_ID
```

The session id must match the one that proposed the action. Actions expire after
`CONFIRM_TTL_S` (120s by default) and are single-use.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `MESSAGE ...` | none | Positional message; sends one message and exits |
| `--api-url URL` | `http://127.0.0.1:8000` | API base URL |
| `--session ID` | `cli-<user>` | `X-Session-Id` header value |
| `--token TOKEN` | none | `Authorization` header (`Bearer` added if missing) |
| `--timeout SECONDS` | `90` | HTTP timeout |
| `-m, --message TEXT` | none | Alternative to the positional `MESSAGE` |
| `--confirm ACTION_ID` | none | Confirm a pending action and exit |
| `--health` | none | Check API/LLM health and exit |
| `-y, --yes` | off | Auto-confirm destructive actions |
| `--json` | off | Print raw response JSON |
| `--no-color` | off | Disable ANSI colors |
| `--history-file PATH` | none | Load/save the transcript for this session |

Environment variables: `EMPIRICAL_API_URL`, `EMPIRICAL_SESSION_ID`, `EMPIRICAL_TOKEN`,
`EMPIRICAL_TIMEOUT`. `NO_COLOR` disables colors. Explicit flags win over env vars.

## Interactive commands

| Command | Description |
| --- | --- |
| `/help` | Show command help |
| `/new [session]` | Fresh session (generated id if omitted) and clear transcript |
| `/session <id>` | Switch session and clear transcript |
| `/history` | Show the in-memory transcript |
| `/clear` | Clear the in-memory transcript |
| `/health` | Check API and LLM health |
| `/json on\|off` | Toggle raw JSON output |
| `/api <url>` | Change the API base URL |
| `/token [token]` | Set, or clear when omitted, the bearer token |
| `/yes on\|off` | Toggle auto-confirm |
| `/quit`, `/exit` | Exit |

Anything that is not a slash command is sent to `POST /chat`.

Transcripts are in-memory unless `--history-file` is provided. That file is
written atomically after each turn and loaded only when its `session` matches the
current session id.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (including `no_action` and unconfirmed proposals) |
| `1` | Network failure, timeout, or API error response |
| `130` | Interrupted with Ctrl+C |

## HTTP details

- `POST /chat` with `{"message": "..."}`
- `POST /confirm/{action_id}` with no body
- `GET /health`
- Headers: `Content-Type: application/json` (when a body exists), `X-Session-Id`,
  optional `Authorization`
- HTTP errors are decoded from the API's JSON error shape and printed with the
  error code.

## Tests

```bash
python3 -m unittest discover -s cli -p 'test_*.py' -v
```

The tests start an in-process mock HTTP server and cover success, `no_action`,
confirmation yes/no, confirm by action id, wrong-session rejection, errors, token
forwarding, JSON output, history files, and interactive mode.


# Executable file 
## linux
- pyinstaller --onefile --name empirical empirical_cli.py
## windows
- pyinstaller --onefile --name empirical.exe empirical_cli.py  
