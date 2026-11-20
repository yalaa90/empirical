import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const catalogPath = resolve(root, 'src/data/products.json')
const port = Number(process.env.MOCK_API_PORT ?? 8003)
const host = process.env.MOCK_API_HOST ?? '127.0.0.1'

const CATEGORIES = new Set(['tshirt', 'hoodie', 'shoes', 'hat', 'accessory'])
const COLORS = new Set(['red', 'blue', 'black', 'white', 'green', 'yellow'])
const PAGES = new Set(['home', 'cart', 'checkout'])
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'to',
  'my',
  'me',
  'in',
  'of',
  'for',
  'with',
  'please',
  'find',
  'show',
  'get',
  'add',
  'put',
  'open',
  'go',
  'take',
  'want',
  'need',
  'some',
])

const products = JSON.parse(await readFile(catalogPath, 'utf8'))

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
}

function productTokens(product) {
  return new Set(
    tokens(
      [
        product.name,
        product.brand,
        product.category,
        product.color,
        ...product.tags,
      ].join(' '),
    ),
  )
}

function scoreProduct(product, queryTokens) {
  if (queryTokens.length === 0) return 0
  const haystack = productTokens(product)
  return queryTokens.reduce(
    (score, token) => score + (haystack.has(token) ? 1 : 0),
    0,
  )
}

function findProduct(productName, color) {
  const wanted = tokens(productName)
  let candidates = products
  if (color && COLORS.has(String(color).toLowerCase())) {
    candidates = candidates.filter(
      (product) => product.color === String(color).toLowerCase(),
    )
  }

  let best = null
  let bestScore = 0
  for (const product of candidates) {
    const score = scoreProduct(product, wanted)
    if (score > bestScore) {
      best = product
      bestScore = score
    }
  }

  if (best) return best
  if (candidates.length === 1) return candidates[0]
  return null
}

function searchProducts(params) {
  const queryTokens = tokens(params.get('query') ?? '')
  const category = (params.get('category') ?? '').toLowerCase()
  const color = (params.get('color') ?? '').toLowerCase()
  const maxPriceRaw = params.get('max_price')
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : null

  const matches = products.filter((product) => {
    if (category && CATEGORIES.has(category) && product.category !== category) {
      return false
    }
    if (color && COLORS.has(color) && product.color !== color) {
      return false
    }
    if (maxPrice !== null && Number.isFinite(maxPrice) && product.price > maxPrice) {
      return false
    }
    if (queryTokens.length > 0 && scoreProduct(product, queryTokens) === 0) {
      return false
    }
    return true
  })

  const filters = {}
  const query = params.get('query')
  if (query) filters.query = query
  if (category && CATEGORIES.has(category)) filters.category = category
  if (color && COLORS.has(color)) filters.color = color
  if (maxPrice !== null && Number.isFinite(maxPrice)) filters.max_price = maxPrice

  return {
    action: 'search_products',
    filters,
    count: matches.length,
    product_ids: matches.map((product) => product.id),
  }
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) {
      throw new Error('request body too large')
    }
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function json(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.end(JSON.stringify(body))
}

async function route(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const path = url.pathname

  if (request.method === 'GET' && path === '/health') {
    return json(response, 200, { status: 'ok', products: products.length })
  }

  if (request.method === 'GET' && path === '/actions/search-products') {
    return json(response, 200, searchProducts(url.searchParams))
  }

  if (request.method === 'POST' && path === '/actions/cart') {
    const body = await readJson(request)
    const product = findProduct(body.product_name ?? body.name, body.color)
    if (!product) {
      return json(response, 404, {
        detail: `No product matched "${body.product_name ?? body.name ?? ''}".`,
      })
    }
    const qty = Math.max(1, Math.floor(Number(body.qty ?? 1)) || 1)
    return json(response, 200, {
      action: 'add_to_cart',
      product_id: product.id,
      name: product.name,
      color: product.color,
      size: product.sizes[0] ?? 'One size',
      qty,
      price: product.price,
      line_total: Math.round(product.price * qty * 100) / 100,
    })
  }

  if (request.method === 'POST' && path === '/actions/cart/remove') {
    const body = await readJson(request)
    const product = findProduct(body.product_name ?? body.name, body.color)
    if (!product) {
      return json(response, 404, {
        detail: `No product matched "${body.product_name ?? body.name ?? ''}".`,
      })
    }
    return json(response, 200, {
      action: 'remove_from_cart',
      product_id: product.id,
      name: product.name,
      color: product.color,
      removed: true,
    })
  }

  if (request.method === 'GET' && path === '/actions/product') {
    const product = findProduct(
      url.searchParams.get('product_name') ?? '',
      url.searchParams.get('color'),
    )
    if (!product) {
      return json(response, 404, {
        detail: `No product matched "${url.searchParams.get('product_name') ?? ''}".`,
      })
    }
    return json(response, 200, {
      action: 'open_product',
      product_id: product.id,
      name: product.name,
      color: product.color,
      price: product.price,
    })
  }

  if (request.method === 'GET' && path === '/actions/navigate') {
    const page = (url.searchParams.get('page') ?? '').toLowerCase()
    if (!PAGES.has(page)) {
      return json(response, 400, {
        detail: `Unknown page "${page}". Use home, cart, or checkout.`,
      })
    }
    return json(response, 200, { action: 'navigate', page })
  }

  return json(response, 404, { detail: `Unknown route ${request.method} ${path}` })
}

const server = createServer((request, response) => {
  route(request, response).catch((error) => {
    json(response, 500, {
      detail: error instanceof Error ? error.message : 'Unexpected error',
    })
  })
})

server.listen(port, host, () => {
  console.log(`northline mock product API listening on http://${host}:${port}`)
  console.log(`loaded ${products.length} products from ${catalogPath}`)
})
