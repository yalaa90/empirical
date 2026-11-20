import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
const apiTarget = (
  process.env.EMPIRICAL_API_URL ??
  process.env.API_URL ??
  'http://127.0.0.1:8000'
).replace(/\/+$/, '')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

async function proxy(request, response) {
  const originalUrl = request.url ?? '/api'
  const path = originalUrl.slice('/api'.length) || '/'

  const headers = { ...request.headers }
  delete headers.host
  delete headers.connection

  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  if (body) headers['content-length'] = String(body.length)

  try {
    const upstream = await fetch(`${apiTarget}${path}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
      redirect: 'manual',
    })

    response.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      if (
        key === 'content-encoding' ||
        key === 'content-length' ||
        key === 'transfer-encoding' ||
        key === 'connection'
      ) {
        return
      }
      response.setHeader(key, value)
    })

    const payload = Buffer.from(await upstream.arrayBuffer())
    response.end(payload)
  } catch {
    response.statusCode = 502
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        status: 'error',
        code: 'proxy_error',
        message: `Could not reach the Empirical API at ${apiTarget}.`,
      }),
    )
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  let filePath = resolve(root, pathname.replace(/^\/+/, ''))
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    response.statusCode = 403
    response.end('Forbidden')
    return
  }

  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
    const content = await readFile(filePath)
    response.statusCode = 200
    response.setHeader(
      'Content-Type',
      MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    )
    response.setHeader(
      'Cache-Control',
      pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    )
    response.end(content)
  } catch {
    try {
      const fallback = await readFile(join(root, 'index.html'))
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('Cache-Control', 'no-cache')
      response.end(fallback)
    } catch {
      response.statusCode = 404
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.end(
        'empirical-web is not built yet. Run "npm run build" first.\n',
      )
    }
  }
}

const server = createServer((request, response) => {
  const url = request.url ?? '/'
  if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
    void proxy(request, response)
    return
  }
  void serveStatic(request, response)
})

server.listen(port, host, () => {
  console.log(`empirical-web listening on http://${host}:${port}`)
  console.log(`proxying /api -> ${apiTarget}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
