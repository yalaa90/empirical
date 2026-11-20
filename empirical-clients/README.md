# Empirical Clients

Client applications for [`empirical-api`](../empirical-api), the chat-to-API orchestrator.

Two independent clients live in this repository:

| Client | Path | Description |
| --- | --- | --- |
| Web chat | [`web/`](web/) | ChatGPT-style interface with a conversation sidebar, local history, confirmations, and dark mode. |
| CLI | [`cli/`](cli/) | Dependency-free Python REPL and one-shot client for the same API. |

Neither client requires changes to `empirical-api`. The web client proxies API calls through its dev and production servers to avoid CORS configuration.

## API surface used

The clients talk to these endpoints:

| Method | Path | Headers | Body |
| --- | --- | --- | --- |
| `POST` | `/chat` | `Content-Type: application/json`, `X-Session-Id`, optional `Authorization` | `{"message": "add 3 apples"}` |
| `POST` | `/confirm/{action_id}` | `X-Session-Id`, optional `Authorization` | none |
| `GET` | `/health` | none | none |

Responses are rendered for every status the orchestrator can return:

- `ok` — action executed, includes `tool`, `result`, `data`, `latency_ms`
- `no_action` — no matching tool, includes `reason`
- `needs_confirmation` — destructive action pending, includes `action_id`, `summary`, `expires_in_s`
- `error` — includes `code`, `message` (for example `llm_busy`, `invalid_model_output`, `action_unavailable`)

> The API is stateless between `/chat` calls. Conversation history therefore lives
> entirely in the web client (localStorage); the CLI keeps an in-memory transcript.

## Quick start

Start `empirical-api` first (see its README — it needs `llama-server` and the mock
business API):

```bash
cd ../empirical-api
docker compose up --build
```

### Web client

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:5173>. `/api/*` is proxied to `http://127.0.0.1:8000`.
Use the gear icon to change the backend URL, session id, or bearer token.

### CLI client

```bash
cd cli
./empirical_cli.py --session alice
```

Or send a single message using the positional form:

```bash
./empirical_cli.py --session alice "list all items"
./empirical_cli.py list all items --session alice
./empirical_cli.py --session alice -m "list all items"
```

Both clients accept environment variables as defaults:

| Variable | Used by | Default |
| --- | --- | --- |
| `EMPIRICAL_API_URL` | CLI | `http://127.0.0.1:8000` |
| `EMPIRICAL_SESSION_ID` | CLI | `cli-<user>` |
| `EMPIRICAL_TOKEN` | CLI | none |
| `VITE_API_BASE_URL` | Web | `/api` |
| `EMPIRICAL_API_URL` / `API_URL` | Web production server | `http://127.0.0.1:8000` |

## Project layout

```text
empirical-clients/
├── web/          React + Vite + TypeScript + Tailwind chat UI
└── cli/          Python stdlib CLI
```

Each directory has its own README with details on scripts, configuration, and
testing.

## Troubleshooting

**The web UI shows "Backend unreachable"** — confirm `curl http://127.0.0.1:8000/health`
returns `200`. If the LLM is down the API returns `503 degraded`; the clients
surface that as an error.

**CORS errors in the browser** — use the Vite dev server (`npm run dev`) or the
bundled production server (`npm run serve`). Opening `dist/index.html` directly
will not work. To call the API directly from another origin, add CORS middleware
to `empirical-api` and set `VITE_API_BASE_URL` to the full API URL.

**"Action is no longer available"** — confirmations expire after
`CONFIRM_TTL_S` (120s by default) and are bound to `X-Session-Id`. Confirm from
the same conversation/session that proposed the action.

**Slow replies** — the orchestrator queues LLM calls (`LLM_MAX_CONCURRENCY=1`).
Latency is displayed under each answer; check the `empirical-api` logs.
