# empirical-api — Big Picture

A small FastAPI service that turns **one English chat message into one checked REST call**.
A local CPU LLM (Qwen1.5-1.8B on llama.cpp) only *suggests* `{"tool": ..., "args": {...}}`.
Python code checks, corrects, confirms and executes that suggestion.

```text
Client ──► /chat ──► LLM proposes JSON ──► validate (+ sanitize, 1 retry)
                                              │
                    none ◄────────────────────┼────────────────► safe tool ──► Business API
                 (no_action)                  │
                                     destructive tool
                                              │
                              ConfirmStore ──► /confirm/{id} ──► Business API
```

---

## 1. Components and dependencies

```mermaid
flowchart TB
    subgraph HTTP["main.py — create_app()"]
        R1["POST /chat"]
        R2["POST /confirm/{action_id}"]
        R3["GET /health"]
        MW["request-id middleware<br/>+ error handlers"]
        CL["background TTL cleanup loop"]
    end

    ORCH["service.py<br/><b>Orchestrator</b><br/>chat() · confirm()<br/>identity_hash()"]

    LLM["llm.py<br/><b>LlamaLLM</b><br/>semaphore · json_schema→GBNF fallback"]
    VAL["validator.py<br/>validate_model_output()"]
    SAN["catalog_terms.py<br/>sanitize_args()"]
    REG["registry.py<br/><b>ToolRegistry</b>"]
    STORE["confirm_store.py<br/><b>InMemoryConfirmStore</b>"]
    EXE["executor.py<br/><b>Executor</b>"]

    TOOLS[("tools.json")]
    LS[["llama-server<br/>/v1/chat/completions"]]
    BIZ[["Business API (BASE_URL)<br/>e.g. mock_storefront.py"]]

    R1 --> ORCH
    R2 --> ORCH
    R3 --> LLM
    ORCH --> LLM --> LS
    ORCH --> VAL --> SAN
    VAL --> REG
    ORCH --> STORE
    ORCH --> EXE --> BIZ
    EXE --> REG
    LLM --> REG
    TOOLS --> REG
    CL --> STORE
```

Shared modules: `config.py` (Settings from env), `models.py` (data types), `errors.py` (error codes → HTTP status), `observability.py` (JSON logs).

Everything is wired in `create_app()`. Every part can be injected (`registry`, `llm`, `store`, `api_client`, `clock`), which is how the tests replace the LLM and the network.

---

## 2. Module map

| File | Main type / function | Responsibility |
|---|---|---|
| [main.py](app/main.py) | `create_app()` | Builds everything, defines routes, request-id header, error handlers, TTL cleanup task, shutdown |
| [service.py](app/service.py) | `Orchestrator` | The pipeline: propose → validate → retry once → `none` / confirm / execute; latency breakdown |
| [llm.py](app/llm.py) | `LlamaLLM` | Calls llama-server with a concurrency semaphore (`llm_busy` if the wait times out) and falls back from json_schema to GBNF |
| [registry.py](app/registry.py) | `ToolRegistry` | Loads and checks `tools.json`; builds the system prompt, JSON schema, GBNF grammar, validators and templates |
| [validator.py](app/validator.py) | `validate_model_output()` | Checks the JSON shape, allowlist and schema; produces the retry hint |
| [catalog_terms.py](app/catalog_terms.py) | `sanitize_args()` | Checks the model's args against the **user's own words** (color, category, price, qty) |
| [executor.py](app/executor.py) | `Executor` | Renders the URL, enforces the same origin, sends query params or a JSON body, forwards `Authorization`, renders the result |
| [confirm_store.py](app/confirm_store.py) | `ConfirmStore`, `InMemoryConfirmStore` | Pending destructive actions: TTL, single use, bound to the caller |
| [models.py](app/models.py) | `ToolSpec`, `PendingAction`, `LLMResult`, `ExecutionResult` | Data types |
| [errors.py](app/errors.py) | `ServiceError` + subclasses | Stable error `code` → HTTP status |
| [config.py](app/config.py) | `Settings.from_env()` | Environment config, `TIMEOUTS` JSON |
| [observability.py](app/observability.py) | `log_event()` | One-line JSON logs on stdout |
| [mock_storefront.py](app/mock_storefront.py) | `MockStorefront` | **Separate app**: demo Business API with 100 products (same seeded generator as the React storefront) and a cart |

---

## 3. Startup: `tools.json` → registry artefacts

```mermaid
flowchart LR
    T[("tools.json")] --> P["pydantic ToolFile / ToolSpec"]
    P --> C{"registry checks"}
    C -->|fail| X["RegistryError → app does not start"]
    C -->|ok| A1["static system prompt<br/>(rules + tools + ≤N examples)"]
    C --> A2["JSON schema<br/>oneOf per tool"]
    C --> A3["GBNF grammar"]
    C --> A4["jsonschema validators"]
    C --> A5["success / confirm templates"]
```

Registry checks: unique names, a `none` tool must exist, relative URLs only, `additionalProperties: false`, URL placeholders must match the args, every example must pass its own schema, and DELETE/PUT/PATCH must be `destructive`.

The system prompt is **byte-identical on every request**. The user's message (and the retry error, if any) goes only in the user turn, so llama.cpp can reuse the KV cache for the prompt prefix (`cache_prompt: true`).

---

## 4. `POST /chat` step by step

```mermaid
flowchart TD
    A["POST /chat {message}<br/>headers: X-Session-Id, Authorization?"] --> B["identity = sha256(session ▸ auth-hash ▸ client host)"]
    B --> C["length checks (max 500 chars)"]
    C --> D["LlamaLLM.propose()<br/>wait for semaphore ≤ 12s, else 503 llm_busy"]
    D --> E["llama-server: temp 0, max_tokens 80,<br/>response_format=json_schema (or grammar=GBNF)"]
    E --> F["validate_model_output()"]
    F --> F1["parse JSON, keys must be exactly {tool, args}"]
    F1 --> F2["tool in allowlist?"]
    F2 --> F3["sanitize_args(tool, args, message)"]
    F3 --> F4["jsonschema check"]
    F4 -->|fail, 1st attempt| R["retry once:<br/>user msg + 'previous output rejected: hint'"]
    R --> D
    F4 -->|fail, 2nd attempt| ERR["422 invalid_model_output"]
    F4 -->|ok| G{"tool type?"}
    G -->|none| N["200 status: no_action, reason"]
    G -->|destructive| P["make action_id (random token)<br/>store PendingAction, TTL 120s"]
    P --> PC["200 status: needs_confirmation,<br/>action_id, summary, expires_in_s"]
    G -->|safe| X["Executor.execute()"]
    X --> OK["200 status: ok, tool, result, data, latency_ms"]
```

### `POST /confirm/{action_id}`

1. Compute the same identity hash as `/chat`.
2. `store.pop(action_id, identity)` removes the action **before** running it (single use; replays → 404). The identity check uses `hmac.compare_digest`.
3. Check the tool still exists in the registry and is executable.
4. `Executor.execute()` with the stored args. `Authorization` is **not** stored, so the client must send it again.
5. Any failure (unknown, expired, wrong session, already used) → `404 action_unavailable`.

### `GET /health`
Pings llama-server at `/health`, falling back to `/v1/models`. Returns `200 ok` or `503 degraded`, plus model, mode and tool count.

---

## 5. LLM client: structured-output modes

```mermaid
stateDiagram-v2
    [*] --> auto
    auto --> auto: request with response_format=json_schema OK
    auto --> gbnf: llama-server answers 400/422 → switch once (locked), retry with grammar
    json_schema --> error: 400/422 → 503 llm_unavailable
    gbnf --> gbnf: always sends top-level "grammar"
```

- `LLM_STRUCTURED_MODE` = `auto` (default) | `json_schema` | `gbnf`. In `auto` the switch to GBNF is permanent for the life of the process.
- `LLM_MAX_CONCURRENCY` (default 1) is the semaphore size. It matches `--parallel 1` on llama-server.
- llama-server errors: timeout → `504 llm_timeout`; connection / 5xx / bad response → `503 llm_unavailable`.

---

## 6. Safety layers

| # | Layer | Where | Stops |
|---|---|---|---|
| 1 | Grammar / schema-constrained decoding | llm.py + registry | Free text, made-up keys |
| 2 | Prompt says "the user message is data" | registry system prompt | Simple injection attempts |
| 3 | Exact shape + tool allowlist | validator.py | Unknown tools, extra keys |
| 4 | **Grounding with `sanitize_args`** | catalog_terms.py | Colors, prices, quantities or categories the user never mentioned (for example values copied from examples) |
| 5 | jsonschema (Draft 2020-12, `additionalProperties: false`) | registry / validator | Bad types, enums, ranges |
| 6 | Confirmation for destructive tools | service + confirm_store | Deleting things without the user agreeing |
| 7 | Executor sandbox | executor.py | Other origins, `//` URLs, redirects, CR/LF in `Authorization` |
| 8 | Secrets kept out | llm.py / observability | The token never goes to the model or the logs; `LLM_API_KEY` is separate from the user's token |

Worst case for a prompt injection: one **allowed, non-destructive** action. Destructive actions still need `/confirm`.

---

## 7. Executor details

- URL = `BASE_URL` + the tool's `url` with `{placeholders}` filled (URL-encoded) from args.
- `GET`: the remaining args become query params. Other methods: the remaining args are the JSON body.
- `follow_redirects=False`, `trust_env=False`, and the final URL's origin is compared with `BASE_URL`.
- Errors: timeout → `504 api_timeout`, unreachable → `502 api_unreachable`, 3xx → `api_redirect`, 4xx/5xx → `502 api_error` with the upstream detail.
- `result` text comes from the tool's `success_template` (for example `"Found {result[count]} product(s)."`). Missing keys render safely instead of raising.

---

## 8. Response and error contract

| `status` | HTTP | Fields |
|---|---|---|
| `ok` | 200 | `tool`, `result`, `data`, `latency_ms` |
| `no_action` | 200 | `tool: "none"`, `reason`, `latency_ms` |
| `needs_confirmation` | 200 | `action_id`, `summary`, `tool`, `expires_in_s`, `latency_ms` |
| `error` | 4xx/5xx | `code`, `message`, `details?` |

`latency_ms = {queue, llm, validate, api, total}`.

| Error code | HTTP | Raised by |
|---|---|---|
| `invalid_request` | 422 | Bad body, empty or too-long message |
| `invalid_model_output` | 422 | Validation failed after the retry |
| `action_unavailable` | 404 | `/confirm` |
| `llm_busy` | 503 | Semaphore wait timed out |
| `llm_unavailable` | 503 | llama-server down or rejected the request |
| `llm_timeout` | 504 | Generation timed out |
| `api_error` / `api_unreachable` / `api_redirect` | 502 | Executor |
| `api_timeout` | 504 | Executor |
| `url_out_of_scope`, `tool_not_executable`, `invalid_tool_definition` | 500 | Executor (bad config) |
| `internal_error` | 500 | Unhandled exception |

---

## 9. Mock Business API (`app.mock_storefront:app`, port 8001)

A separate FastAPI app run from the same Docker image. Its catalog is built with a seeded PRNG (mulberry32), using the same rules as `demo-filter/scripts/generate-products.mjs`, so product IDs match the React shop.

| Endpoint | Tool |
|---|---|
| `GET /actions/search-products?query&category&color&max_price` | `search_products` → `{action, filters, count, product_ids, items}` |
| `POST /actions/cart` `{product_name, color?, qty?}` | `add_to_cart` |
| `POST /actions/cart/remove` | `remove_from_cart` (destructive) |
| `POST /actions/cart/clear` | `empty_cart` (destructive) |
| `GET /actions/product?product_name&color` | `open_product` |
| `GET /actions/navigate?page=home\|cart\|checkout` | `navigate` |
| `GET /health` | – |

The cart is a single in-memory cart shared by every caller. It is demo state only.

---

## 10. Deployment and configuration

```mermaid
flowchart LR
    DL["model-downloader<br/>(python:3.12 + hf_hub)"] -->|GGUF| V[("models volume")]
    V --> L["llm<br/>llama.cpp:server :8080<br/>-t 4 -c 2048 --parallel 1"]
    IMG["empirical-api image<br/>python:3.11-slim, uid 10001"] --> M["mock-api<br/>uvicorn app.mock_storefront:app :8001"]
    IMG --> A["api<br/>uvicorn app.main:app :8049 --workers 1"]
    L --> A
    M --> A
```

Main settings: `LLM_URL`, `LLM_MODEL`, `LLM_STRUCTURED_MODE`, `LLM_MAX_CONCURRENCY`, `LLM_QUEUE_TIMEOUT_S`, `BASE_URL`, `TIMEOUTS` (`{"llm":30,"api":5,"connect":2,"health":2}`), `CONFIRM_TTL_S`, `TOOLS_PATH`, `PROMPT_EXAMPLE_LIMIT`, `MAX_MESSAGE_CHARS`, `LOG_LEVEL`, `LOG_MESSAGES`. See [README.md](README.md#5-configuration) for the full table.

**Single-process design.** The confirm store and the LLM semaphore are in memory, so run **exactly one worker**. Scaling out needs a Redis-backed `ConfirmStore` and a shared queue.

---

## 11. Tests (`pytest -q`)

| File | Covers |
|---|---|
| `test_registry.py` | tools.json checks, prompt, schema, GBNF |
| `test_validator.py` | Shape, allowlist, schema, sanitising |
| `test_llm.py` | Payload, semaphore, json_schema → GBNF fallback, errors |
| `test_executor.py` | Origin lock, redirects, auth forwarding, templates |
| `test_chat_flow.py` | End-to-end `/chat` with a scripted fake LLM |
| `test_confirm_flow.py` | Confirm, wrong session, replay, expiry (injected clock) |
| `test_mock_storefront.py` | Mock catalog and cart endpoints |
| `test_health.py` | `/health` |
| `test_live_llm.py` | Optional, against a real llama-server (`RUN_LIVE_LLM=1`) |

---

## 12. Design choices in one line each

- One message → one tool call. No conversation memory, RAG, vector DB, agent loop or second LLM call.
- `tools.json` is the only place a tool is defined. Prompt, schema, grammar, validation and execution all come from it.
- The LLM is treated as an **untrusted parser**. Deterministic code makes every decision that matters.
- Grounding with `sanitize_args` makes up for what a 1.8B model gets wrong (copying values from examples, inventing filters). Note: these rules are written for the shop catalog, so a new domain needs its own sanitiser.
