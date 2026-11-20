# Empirical Web

A ChatGPT-style web client for [`empirical-api`](../../empirical-api). It keeps multiple
conversations, persists them in the browser, and handles the confirmation flow
for destructive tools.

## Features

- Conversation sidebar with new chat, search, rename, delete, and relative timestamps
- Local history in `localStorage` — one session id per conversation
- Markdown answers, inventory tables, raw-data inspector, latency footer
- Confirmation cards with a countdown for destructive actions
- Error cards with retry for `llm_busy`, `llm_timeout`, `invalid_model_output`, etc.
- Dark/light theme, responsive layout, mobile drawer
- Live API/LLM health badge (`/health` polled every 30s)
- Optional bearer token kept in `sessionStorage` only
- No CORS setup required: `/api/*` is proxied to empirical-api in both dev and production

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5175>. The Vite dev server proxies `/api` to
`http://127.0.0.1:8000` and strips the `/api` prefix.

Start `empirical-api` first:

```bash
cd ../../empirical-api
docker compose up --build
```

Verify the backend:

```bash
curl -s http://127.0.0.1:8000/health
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with API proxy |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run preview` | Vite's static preview (no API proxy) |
| `npm run serve` | Production server: serves `dist/` and proxies `/api` |

## Production serving

```bash
npm run build
npm run serve
```

`server.mjs` is a zero-dependency Node server. Defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Listen port |
| `HOST` | `127.0.0.1` | Listen host |
| `EMPIRICAL_API_URL` | `http://127.0.0.1:8000` | Proxy target (also accepts `API_URL`) |

It serves `dist/` with SPA fallback and forwards `/api/*` to the backend,
removing the `/api` prefix and preserving request headers/body.

If you deploy behind nginx or another reverse proxy, replicate that rule:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Embedding in a host storefront

The client can run as a compact chat-only iframe inside another app. Load it with:

```text
http://localhost:5175/?embed=1&hostOrigin=http://localhost:5176
```

Embed mode hides the sidebar and host header, renders a compact panel, and
exchanges messages with the parent window. Both sides validate origins:

| Direction | `source` | Types |
| --- | --- | --- |
| Child → host | `empirical-web` | `ready`, `health`, `response` |
| Host → child | `northline-store` | `ping`, `prompt` |

- `ready` is sent once on mount. `ping` only requests a fresh `health` result.
- `health` polls `/api/health` every 30 seconds.
- `response` forwards each `ChatResponse` from `useChat`.
- `prompt` carries `{ text }`, which `ChatComposer` auto-sends unless a request
  is already in flight.

The host must pass the exact parent origin as `hostOrigin`. Without `embed=1`,
the normal full-screen client is served. See the
[Northline demo storefront](../../demo-filter/README.md) for a complete parent
implementation.

## Configuration

Settings are available from the gear icon in the sidebar:

- **API base URL** — `/api` (in-app proxy) by default. Absolute URLs call the API
  directly and require CORS middleware on empirical-api.
- **Session prefix** — new chats get `X-Session-Id: <prefix>-<uuid>`. The id is
  stored per conversation and must match when confirming.
- **Bearer token** — optional; stored in `sessionStorage` and sent as
  `Authorization`. Use the same token when confirming if the business API needs it.
- **Clear all history** — removes local conversations.

Build-time environment variables (copy `.env.example` to `.env` if needed):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL baked into the client |
| `EMPIRICAL_API_URL` | `http://127.0.0.1:8000` | Dev proxy target |

The Northline demo uses a local `.env.local` with
`EMPIRICAL_API_URL=http://127.0.0.1:8049` and `VITE_API_BASE_URL=/api`.

## How history works

`empirical-api` keeps no conversation history; only pending confirmations live in
memory. The web client persists everything under the `empirical.chat.v1`
localStorage key:

```text
conversations[] { id, title, sessionId, messages[], createdAt, updatedAt }
activeId
theme
settings { apiBaseUrl, sessionPrefix }
```

Each message stores the raw API response so statuses, tool names, latency, and
confirmation state survive reloads. Pending confirmations still expire on the
server after `CONFIRM_TTL_S` (120s by default).

## Project structure

```text
web/
├── server.mjs             production static + /api proxy server
├── vite.config.ts         dev proxy and path alias
├── tailwind.config.ts
└── src/
    ├── api/client.ts      fetch wrapper, ApiError, health check
    ├── components/
    │   ├── chat/          ChatPage, MessageList, MessageBubble, ConfirmCard, ...
    │   ├── layout/        Sidebar, Header
    │   ├── settings/      SettingsDialog
    │   └── ui/            Button
    ├── hooks/             useChat, useHealth, useAutoScroll, useEmbedBridge
    ├── lib/               cn, embed, formatting, response helpers, storage
    ├── store/chatStore.ts Zustand store with localStorage persistence
    ├── types.ts
    ├── App.tsx
    └── main.tsx
```

## Troubleshooting

- **API offline** — run `curl http://127.0.0.1:8000/health`. `503 degraded` means
  the LLM/`llama-server` is not ready.
- **CORS errors** — use `npm run dev` or `npm run serve`; opening `dist/index.html`
  directly bypasses the proxy.
- **Confirmation expired** — actions expire after `CONFIRM_TTL_S` and are bound to
  the conversation's session id. Ask again to create a new action.
- **Slow first reply** — the model warms up on first use; the orchestrator also
  serializes LLM calls (`LLM_MAX_CONCURRENCY=1`).
