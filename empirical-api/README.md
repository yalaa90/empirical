# Empirical Chat-to-API Orchestrator

A small CPU-only service that converts English chat messages into **validated** REST API calls with a local Qwen1.5-1.8B GGUF model. There is no RAG, no vector DB, no LangChain, and no second LLM call. The model never receives credentials and never calls the Business API.

```text
Client -> FastAPI /chat -> llama-server (grammar-constrained JSON)
       -> validator -> [confirmation for destructive tools] -> Business API
```

## Project layout

```text
.
├── app/
│   ├── main.py             # app factory, routes, health, error handling
│   ├── config.py           # env config, TIMEOUTS parsing
│   ├── models.py           # ToolSpec, PendingAction, results
│   ├── registry.py         # tools.json -> prompt + JSON schema + GBNF + templates
│   ├── llm.py              # async llama-server client, semaphore, GBNF fallback
│   ├── validator.py        # JSON/allowlist/jsonschema validation
│   ├── confirm_store.py    # ConfirmStore protocol + in-memory TTL store
│   ├── executor.py         # registry-driven HTTP execution
│   ├── service.py          # orchestration, retry, confirmation, latency logging
│   ├── observability.py    # stdlib JSON logging
│   ├── errors.py           # error codes / HTTP mapping
│   └── mock_storefront.py  # in-memory 100-product catalogue (mirrors demo-filter's generator)
├── tools.json              # single source of truth for tools
├── Dockerfile
├── docker-compose.yml
├── docker/
│   └── model-downloader.Dockerfile  # first-run GGUF download image
├── scripts/
│   └── download_model.py   # idempotent model downloader
├── .dockerignore
├── tests/
├── requirements.txt
├── .env.example
├── pytest.ini
└── README.md
```

## 1. Install

Python 3.11+:

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

The runtime dependencies are only `fastapi`, `uvicorn`, `httpx`, `pydantic`, `jsonschema`, `python-dotenv`, plus `pytest` for tests.

## Docker Compose quick start

The compose stack is self-contained. On the first run `model-downloader`
downloads the GGUF, then `llm` serves it with llama-server, `mock-api` provides
the demo storefront, and `api` is the orchestrator. You do not need to install
Python or the Hugging Face CLI, and you do not need to download the model
manually.

```bash
cp .env.example .env   # optional: override ports, threads, or model
docker compose up --build -d
```

The first start downloads ~1.2 GB into the Docker named volume
`empirical-api_models`; later starts reuse it. Wait for `docker compose ps` to show
the services as healthy, then call the orchestrator:

```bash
curl -s http://127.0.0.1:8049/health
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"find tshirt with color red"}'
```

The orchestrator API is published on port 8049 and the mock Business API on port
8001. Override ports and llama.cpp threads with `API_PORT`, `MOCK_API_PORT`, and
`LLAMA_THREADS`. Set `QWEN_MODEL_REPO` and `QWEN_MODEL_FILE` to download a
different GGUF; the model is cached in the `models` volume.

```bash
LLAMA_THREADS=8 docker compose up --build -d
docker compose logs -f llm
docker compose down
```

Notes:

- The downloader skips the download when the GGUF is already in the volume. `docker compose down -v` removes the volume and forces a fresh download.
- The deploy host needs outbound access to `huggingface.co` on the first run. For an air-gapped host, pre-populate the `models` volume and keep the same filename.
- `--mlock` is omitted from the compose command for portability; add it if your host allows locked memory.
- The compose file uses the llama.cpp CPU `server` image. Its built-in healthcheck makes `api` wait for the model to load.
- Keep one `api` worker; confirmation state is in memory.

The manual steps below are the equivalent non-Docker workflow.

## 2. Download a Qwen GGUF

Default, Qwen1.5-1.8B-Chat (~1.2 GB):

```bash
pip install -U "huggingface_hub[cli]"
hf download Qwen/Qwen1.5-1.8B-Chat-GGUF \
  qwen1_5-1_8b-chat-q4_k_m.gguf --local-dir ./models
```

For better instruction following at higher CPU cost, Qwen2.5-3B (~1.93 GB):

```bash
hf download bartowski/Qwen2.5-3B-Instruct-GGUF \
  Qwen2.5-3B-Instruct-Q4_K_M.gguf --local-dir ./models
```

Use a current llama.cpp build that supports `response_format: json_schema` on `/v1/chat/completions`.

If you need to build llama.cpp yourself:

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_NATIVE=ON
cmake --build build --config Release -j "$(nproc)"
# binary: ./build/bin/llama-server
```

## 3. Launch llama-server (CPU)

`-t` must be the number of **physical** cores, not logical threads. On a 4-core machine:

```bash
# Optional; only if the OS allows locked memory.
ulimit -l unlimited

./llama-server \
  -m ./models/qwen1_5-1_8b-chat-q4_k_m.gguf \
  --alias qwen1.5-1.8b-chat \
  --host 127.0.0.1 --port 8080 \
  -ngl 0 \
  -t 4 -tb 4 \
  -c 2048 \
  -b 512 -ub 256 \
  --parallel 1 \
  --cache-reuse 256 \
  --mlock \
  --jinja \
  --no-webui
```

Notes:

- For the 3B alternative change `-m` and `--alias` to the 3B file/name, and set `LLM_MODEL` in `.env`.
- `--mlock` keeps the model resident and reduces latency jitter. Remove it (and the `ulimit` line) if it fails on your system.
- Recent llama.cpp versions default to port **9931**; this command explicitly binds **8080**.
- `--no-webui` can be omitted on older builds.
- `--parallel 1` matches the app's single-LLM-request semaphore.
- `-fa on` can be tried later; it is not enabled initially.

## 4. Start the mock Business API and orchestrator

Terminal 1:

```bash
. .venv/bin/activate
uvicorn app.mock_storefront:app --host 127.0.0.1 --port 8001
```

Terminal 2:

```bash
. .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8049 --workers 1
```

Keep **one worker** while using the in-memory confirmation store.

The mock catalogue is generated by `app/mock_storefront.py` using the same
deterministic rules and product IDs as
`demo-filter/scripts/generate-products.mjs`, so chat results (`product_ids`,
`count`, `filters`) line up with the React storefront's `products.json`. With
that catalogue, `find tshirt with color red` returns 5 products.

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `LLM_URL` | `http://127.0.0.1:8080` | llama-server base URL |
| `LLM_MODEL` | `qwen1.5-1.8b-chat` | Must match `--alias` or model path |
| `LLM_API_KEY` | empty | Optional llama-server key; not the user's token |
| `LLM_STRUCTURED_MODE` | `auto` | `auto`, `json_schema`, or `gbnf` |
| `LLM_MAX_CONCURRENCY` | `1` | LLM requests in flight |
| `LLM_QUEUE_TIMEOUT_S` | `12` | Max time waiting for the LLM semaphore |
| `BASE_URL` | `http://127.0.0.1:8001` | Only origin the executor may call |
| `TIMEOUTS` | `{"llm":30,"api":5,"connect":2,"health":2}` | JSON timeouts in seconds |
| `CONFIRM_TTL_S` | `120` | Pending destructive action TTL |
| `TOOLS_PATH` | `./tools.json` | Tool registry |
| `PROMPT_EXAMPLE_LIMIT` | `2` | Few-shot examples per tool in the static prompt |
| `MAX_MESSAGE_CHARS` | `500` | User message limit |
| `LOG_LEVEL` | `INFO` | JSON log level |
| `LOG_MESSAGES` | `true` | Log raw user messages |

Individual `LLM_TIMEOUT_S`, `API_TIMEOUT_S`, `CONNECT_TIMEOUT_S`, and `HEALTH_TIMEOUT_S` override `TIMEOUTS`.

`QWEN_MODEL_REPO` and `QWEN_MODEL_FILE` are Docker Compose settings used by
`model-downloader` and `llm`; the app does not read them. `N_THREADS` is a
llama-server concern, not an app setting. Use `-t <physical cores>`.

## 6. API

### Search products

```bash
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"find tshirt with color red"}'
```

```json
{
  "status": "ok",
  "tool": "search_products",
  "result": "Found 5 product(s).",
  "data": {
    "action": "search_products",
    "filters": {"query": "tshirt", "category": "tshirt", "color": "red"},
    "count": 5,
    "product_ids": [1, 2, 3, 4, 5],
    "items": [
      {"id": 1, "name": "Northline Red Classic T-Shirt", "category": "tshirt", "color": "red", "price": 37.04},
      {"id": 2, "name": "Basalt Red Relaxed T-Shirt", "category": "tshirt", "color": "red", "price": 39.98},
      {"id": 3, "name": "Field & Form Red Heavyweight T-Shirt", "category": "tshirt", "color": "red", "price": 41.21},
      {"id": 4, "name": "Sunday Standard Red Pocket T-Shirt", "category": "tshirt", "color": "red", "price": 27.43},
      {"id": 5, "name": "Alder Red Oversized T-Shirt", "category": "tshirt", "color": "red", "price": 31.27}
    ]
  },
  "latency_ms": {"queue": 0, "llm": 2100, "validate": 1, "api": 8, "total": 2112}
}
```

The `action`, `filters`, `count`, and `product_ids` fields are what the storefront
bridge uses to apply the same filters to the React catalog.

### Add to cart

```bash
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"add the red tshirt to my cart"}'
```

```json
{
  "status": "ok",
  "tool": "add_to_cart",
  "result": "Added Northline Red Classic T-Shirt to cart.",
  "data": {
    "action": "add_to_cart",
    "id": 1,
    "product_id": 1,
    "name": "Northline Red Classic T-Shirt",
    "category": "tshirt",
    "color": "red",
    "price": 37.04,
    "qty": 1
  },
  "latency_ms": {"queue": 0, "llm": 1800, "validate": 1, "api": 8, "total": 1812}
}
```

### Remove from cart (confirmation required)

Seed the cart directly in the mock storefront if needed:

```bash
curl -s -X POST http://127.0.0.1:8001/actions/cart \
  -H 'Content-Type: application/json' \
  -d '{"product_name":"tshirt","color":"red","qty":1}'
```

Propose the removal:

```bash
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"remove the red tshirt from my cart"}'
```

```json
{
  "status": "needs_confirmation",
  "action_id": "…",
  "summary": "Remove tshirt from your cart?",
  "tool": "remove_from_cart",
  "expires_in_s": 120,
  "latency_ms": {"queue": 0, "llm": 1500, "validate": 1, "api": 0, "total": 1504}
}
```

Confirm with the **same session** (and the same `Authorization` header, if you use one):

```bash
ACTION_ID=<paste action_id>
curl -s -X POST "http://127.0.0.1:8049/confirm/$ACTION_ID" \
  -H 'X-Session-Id: alice'
```

```json
{
  "status": "ok",
  "tool": "remove_from_cart",
  "result": "Removed Northline Red Classic T-Shirt from cart.",
  "data": {
    "action": "remove_from_cart",
    "id": 1,
    "product_id": 1,
    "name": "Northline Red Classic T-Shirt",
    "category": "tshirt",
    "color": "red",
    "price": 37.04,
    "qty": 1
  },
  "latency_ms": {"queue": 0, "llm": 0, "validate": 0, "api": 4, "total": 4}
}
```

The action is single-use, bound to the session hash, and expires after `CONFIRM_TTL_S`. Unknown, expired, replayed, or wrong-session actions return `404 action_unavailable`.

### Nonsense / no matching tool

```bash
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"what is the weather in Cairo?"}'
```

```json
{
  "status": "no_action",
  "tool": "none",
  "reason": "That is not a storefront shopping command.",
  "latency_ms": {"queue": 0, "llm": 1400, "validate": 1, "api": 0, "total": 1404}
}
```

### Navigate

```bash
curl -s http://127.0.0.1:8049/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: alice' \
  -d '{"message":"go to checkout"}'
```

### Health

```bash
curl -s http://127.0.0.1:8049/health
```

Returns `200` when llama-server is reachable and ready, `503` with `"status":"degraded"` otherwise.

### Identity and auth

- Send `X-Session-Id` on `/chat` and `/confirm`. Without it, identity falls back to a hash of `Authorization`, then to the client host.
- The user's `Authorization` header is forwarded only to `BASE_URL` by the executor. It is never sent to the model and never logged.
- `Authorization` is not stored with a pending action. Send it again on `/confirm` if the Business API needs it.

## 7. Tool registry

`tools.json` is the only source of truth. At startup the registry validates it and generates:

1. the **system prompt** (static; up to two examples per tool by default),
2. the **JSON schema** passed to llama-server as `response_format.json_schema.schema` (a `oneOf` of all tools),
3. the **GBNF grammar** fallback,
4. per-tool jsonschema validators,
5. result/confirmation templates.

To add a tool, edit `tools.json` only. The registry rejects duplicate names, absolute URLs, missing `none`, missing `additionalProperties: false`, invalid examples, and GET/POST/DELETE inconsistencies (DELETE/PUT/PATCH must be `destructive: true`).

The `none` tool is non-executable and must exist. `GET` args not used in the URL become query parameters; other methods send them as a JSON body.

## 8. Structured output and GBNF fallback

Normal request:

```json
{
  "model": "qwen1.5-1.8b-chat",
  "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}],
  "temperature": 0,
  "max_tokens": 80,
  "stream": false,
  "cache_prompt": true,
  "response_format": {
    "type": "json_schema",
    "json_schema": {"name": "tool_action", "strict": true, "schema": {"oneOf": ["..."]}}
  }
}
```

The schema is generated from `tools.json`; it is never hand-copied. The system prompt is identical on every request so llama.cpp can reuse the KV prefix. Dynamic data (the user message and the retry error) goes only in the user message.

If llama-server rejects `response_format` with HTTP 400/422, the client switches mode once to GBNF and retries the request with a top-level `"grammar"` string. `json_schema` and `grammar` are mutually exclusive in llama.cpp, so `response_format` is omitted for that request. The GBNF is generated from the same `tools.json`; unsupported details such as `maximum` are still enforced by the Python validator. Force this path with:

```dotenv
LLM_STRUCTURED_MODE=gbnf
```

If your llama.cpp build rejects `grammar` on the OpenAI chat endpoint, upgrade llama.cpp; the native `/completion` fallback would require manually rendering Qwen's chat template and is intentionally not used.

## 9. Validation and retry

- Output must be exactly one JSON object with keys `tool` and `args`.
- The tool must be in the allowlist.
- Args are checked by Draft 2020-12 jsonschema with `additionalProperties: false`.
- On failure, the app retries **once**, appending the validator's error to the user message.
- A second failure returns `422 invalid_model_output` with a short explanation. No API call is made.

Prompt injection is treated as untrusted data. The primary controls are constrained output, the allowlist, schema validation, and confirmation for destructive tools. An injection can at most produce an allowed non-destructive action; destructive actions still require `/confirm`.

## 10. Logging

JSON logs go to stdout. Per request they include:

- request id, session hash prefix, user message (unless `LOG_MESSAGES=false`),
- LLM attempt, mode, queue/LLM latency, raw output (truncated),
- validation result, proposed tool/args,
- confirmation creation/consumption,
- executed method/path/status and API latency,
- total latency.

`Authorization` and `LLM_API_KEY` are never logged.

## 11. Tests

```bash
. .venv/bin/activate
pytest -q
```

The default suite uses a scripted fake LLM, an in-process mock Business API over ASGI, and an injectable clock, so it needs no model and no network. It covers:

- product search with category, color, and price filters,
- add to cart,
- cart removal requiring confirmation, wrong-session rejection, replay rejection, expiry,
- invalid JSON retry success and retry exhaustion,
- unknown tool and invalid args,
- prompt-injection text,
- auth forwarding, redirect refusal, origin restriction,
- JSON-schema → GBNF fallback,
- static system prompt / prompt caching fields,
- health checks.

Run the optional live model test after starting llama-server:

```bash
RUN_LIVE_LLM=1 pytest -q tests/test_live_llm.py
```

## 12. Latency on a 4-core CPU

The table below is reference data for Qwen2.5; benchmark Qwen1.5-1.8B on your own hardware. Warm model, cached system prefix (~318 estimated tokens), ~15-token user message, 30–45 output tokens:

| Step | Qwen2.5-1.5B | Qwen2.5-3B |
|---|---|---|
| Queue (single request) | ~0 ms | ~0 ms |
| Prompt prefill (cache hit) | 30–100 ms | 60–200 ms |
| Generation | 1.2–3.0 s | 2.5–6.0 s |
| Validation | < 2 ms | < 2 ms |
| Business API (local) | 2–15 ms | 2–15 ms |
| **Total** | **~1.3–3.3 s** | **~2.7–6.5 s** |

A cold first request adds prompt processing and grammar compilation. A retry doubles the LLM portion. Tune in this order:

1. Use the default Qwen1.5-1.8B (or Qwen2.5-1.5B) if the 3B misses the budget.
2. Shorten `tools.json` descriptions and keep `PROMPT_EXAMPLE_LIMIT=2`.
3. Lower `max_tokens` in `app/llm.py` from 80 to 48–64 if outputs fit.
4. Use physical-core `-t`/`-tb`, keep `--mlock`, and try `-fa on`.
5. Improve examples/prompt to avoid retries.
6. Keep llama-server warm; run one orchestrator worker; set the CPU governor to `performance`.

With `LLM_MAX_CONCURRENCY=1`, a second concurrent request queues behind the first. `LLM_QUEUE_TIMEOUT_S` bounds that wait and returns `503 llm_busy` instead of hanging.

## 13. Production notes / limitations

- In-memory confirmation state and the single LLM semaphore assume **one process**. For multiple workers, implement `ConfirmStore` on Redis and use a shared queue/rate limiter.
- Forwarding the user's `Authorization` to the Business API is only appropriate when both services share a trust domain. Prefer a service credential or token exchange for a public deployment.
- `--mlock` is sensible when the model and context fit comfortably in RAM, but can fail under restrictive `ulimit -l` or memory pressure; it is optional.
- Confirmation actions are consumed before execution to prevent double-delete. If the downstream call fails, re-propose the action.
- The service is English-only and intentionally has no conversation memory beyond pending confirmations.
