# Northline Supply Co.

A demo storefront with 100 products, catalog search/filtering, a working cart,
and a checkout flow. The floating **Ask Empirical** assistant embeds the existing
[`empirical-clients/web`](../empirical-clients/web) chat client in an iframe and applies
structured tool results to the storefront through `postMessage`.

No real orders or payments are processed. Cart, orders, and chat history are
kept in browser local storage.

## What is included

- 100 generated products across t-shirts, hoodies, shoes, hats, and accessories
- URL-synced search, category/color/size/price filters, and sorting
- Product detail pages, persisted cart drawer, demo checkout, order confirmation
- Embedded Empirical chat panel with host-to-chat prompt shortcuts
- Empirical tools for search, add/remove cart, open product, and navigation
- Local mock product API used by `empirical-api` as its executable `BASE_URL`
- Vitest coverage for catalog filtering, cart math, and tool action mapping

## Requirements

- Node.js 20+
- The sibling `../empirical-clients/web` project
- For real chat replies: `../empirical-api` and a running `llama-server` on `:8080`
- For storefront actions only: no LLM is required; the mock API can be exercised
  directly with `curl`

## Run the demo

Install dependencies in both frontend projects:

```bash
cd /home/yehia.saleh/projects/empirical/demo-filter && npm install
cd /home/yehia.saleh/projects/empirical/empirical-clients/web && npm install
```

Start the storefront and its mock product API:

```bash
cd /home/yehia.saleh/projects/empirical/demo-filter
npm run dev
```

Start the Empirical web client in a second terminal:

```bash
cd /home/yehia.saleh/projects/empirical/empirical-clients/web
npm run dev
```

Open <http://localhost:5176>. The chat iframe points at
<http://localhost:5175/?embed=1&hostOrigin=http://localhost:5176>.

If `empirical-api` and `llama-server` are running, use the tools registry:

```bash
cd /home/yehia.saleh/projects/empirical/demo-filter
npm run empirical
```

The script starts `empirical-api` on `:8049` with:

```text
TOOLS_PATH=/home/yehia.saleh/projects/empirical/demo-filter/empirical/tools.ecommerce.json
BASE_URL=http://127.0.0.1:8003
LLM_URL=http://127.0.0.1:8080
```

Override `EMPIRICAL_DIR`, `TOOLS_PATH`, `BASE_URL`, `API_PORT`, or `LLM_URL` as
needed. Without the LLM, the chat panel still loads but shows **Model degraded**.

## Try it

- Search by typing in the catalog search box, or use the header categories.
- Ask the assistant: `find red t-shirts`, `show me hoodies under $60`,
  `add the black hoodie to my cart`, `remove the red t-shirt`, or
  `go to checkout`.
- The assistant result is advisory: the storefront applies a validated local
  action, so filtering and cart state stay in sync with the React app.
- Complete checkout with any demo values. Orders are stored locally and shown on
  the confirmation page.

## Ports

| Service | Port | Notes |
| --- | --- | --- |
| Storefront (Vite) | `5176` | `npm run dev` in this repo |
| Empirical web (Vite) | `5175` | `npm run dev` in `empirical-clients/web` |
| Empirical API | `8049` | `npm run empirical` |
| Mock product API | `8003` | Started by `npm run dev` / `npm run mock` |
| llama-server | `8080` | External requirement for live chat |

## Configuration

Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_EMPIRICAL_WEB_URL` | `http://localhost:5175` | Embedded chat client URL |
| `VITE_EMPIRICAL_WEB_ORIGIN` | Derived from above | Allowed `postMessage` origin |
| `VITE_STOREFRONT_ORIGIN` | `window.location.origin` | Origin sent to the chat client |
| `MOCK_API_PORT` | `8003` | Mock server port |

## Bridge protocol

The parent validates both `event.origin` and `event.source` before handling a
message.

Child (`empirical-web`) to host (`northline-store`):

```text
ready   { version }
health  { ok, api, llm }
response ChatResponse payload from useChat
```

Host to child:

```text
ping    request a fresh health result
prompt  { text } -> dispatched as the empirical:prompt DOM event
```

The parent maps `response.data.action`:

| Action | Storefront effect |
| --- | --- |
| `search_products` | Navigate to `/` with `q`, `category`, `color`, `maxPrice` |
| `add_to_cart` | Add product, open cart drawer |
| `remove_from_cart` | Remove matching cart lines |
| `open_product` | Navigate to `/product/:id` |
| `navigate` | Go to `/`, cart drawer, or `/checkout` |

Confirmation-required, no-action, and error responses become toasts rather than
storefront mutations.

## Mock API and Empirical tools

`mock-server.mjs` exposes:

```text
GET  /health
GET  /products
GET  /actions/search-products?query=tshirt&color=red
GET  /actions/product?product_name=hoodie&color=black
GET  /actions/navigate?page=checkout
POST /actions/cart
POST /actions/cart/remove
```

`empirical/tools.ecommerce.json` defines the six tools available to the model. The
registry is intentionally GBNF-safe: `search_products` is the only tool with
three optional arguments.

The mock API finds products by name/color but does not persist cart state. The
storefront owns the cart, so the model's `add_to_cart` result is a lookup and the
parent applies the local mutation.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Mock API on `:8003` + Vite on `:5176` |
| `npm run mock` | Mock API only |
| `npm run empirical` | Start `empirical-api` with the ecommerce tools registry |
| `npm run data:generate` | Regenerate `src/data/products.json` |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview build on `:4174` |

## Verification

```bash
npm run typecheck
npm run test
npm run build

# Mock API smoke test
curl -s 'http://127.0.0.1:8003/actions/search-products?query=tshirt&color=red'
```

If the chat panel says **Connecting…**, confirm `empirical-clients/web` is running on
`:5175` and that the host origin matches `VITE_STOREFRONT_ORIGIN`. If it says
**Model degraded**, the iframe loaded but `empirical-api` or `llama-server` is not
healthy. In both cases, the **Open** link opens the chat in a new tab.

The chat client checks its proxy at `/api/health`; `http://localhost:5175/health`
is only Vite's SPA fallback and returns `index.html`.

## Project structure

```text
demo-filter/
├── empirical/tools.ecommerce.json   Empirical tool registry
├── mock-server.mjs              Product/tool mock API
├── scripts/
│   ├── generate-products.mjs    Deterministic 100-product generator
│   └── run-empirical-demo.sh        Empirical API launcher
└── src/
    ├── components/
    │   ├── cart/                Cart drawer and controls
    │   ├── catalog/             Filter bar, active filters, product grid
    │   ├── chat/                Chat launcher and embedded panel
    │   ├── layout/              Header and footer
    │   └── ui/                  Toasts and shared controls
    ├── data/products.json       Generated catalog
    ├── hooks/useEmpiricalBridge.ts  postMessage bridge and action handling
    ├── lib/                     Empirical URLs, catalog, filters, utilities
    ├── pages/                   Home, product, checkout, order, 404
    ├── store/                   Zustand cart, order, and UI stores
    └── types.ts
```
