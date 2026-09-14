#!/usr/bin/env node
// Zero-dependency static server for the app (docs/API.md §12).
// Serves app/ at /, core/ at /core/, data/build/ at /data/build/. GET and HEAD only. Nothing else.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, sep, extname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')

const argv = process.argv.slice(2)
const portArg = argv.indexOf('--port')
const port = Number(portArg >= 0 ? argv[portArg + 1] : process.env.GM_APP_PORT || 7401)
const host = '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

// Longest prefix first. Each root is an absolute directory; nothing outside these is reachable.
const MOUNTS = [
  { prefix: '/data/build/', root: join(repo, 'data', 'build') },
  { prefix: '/core/', root: join(repo, 'core') },
  { prefix: '/', root: here },
]

// Returns an absolute file path inside a mount, or null if the request is not allowed.
export function resolveRequest(rawPath) {
  let path
  try {
    path = decodeURIComponent(rawPath)
  } catch {
    return null
  }
  if (path.includes('\0') || path.includes('\\')) return null
  if (path.split('/').some((seg) => seg === '..' || seg === '.')) return null
  if (path === '/') path = '/index.html'
  const mount = MOUNTS.find((m) => path.startsWith(m.prefix))
  if (!mount) return null
  const rel = path.slice(mount.prefix.length)
  if (!rel || rel.endsWith('/')) return null // no directory listing
  // The app's own tests and server script are not part of the site.
  if (mount.root === here && (rel.startsWith('tests/') || rel === 'serve.mjs' || rel.startsWith('playwright'))) return null
  const file = resolve(mount.root, rel)
  if (!file.startsWith(mount.root + sep)) return null
  return file
}

async function notFound(res, method) {
  let body = '<!doctype html><title>Not found</title><p>Page not found.</p>'
  try {
    body = await readFile(join(here, '404.html'), 'utf8')
  } catch {}
  res.writeHead(404, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
  res.end(method === 'HEAD' ? undefined : body)
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' })
    return res.end('Method not allowed')
  }
  const url = new URL(req.url || '/', `http://${host}`)
  const file = resolveRequest(url.pathname)
  if (!file) return notFound(res, method)
  try {
    const info = await stat(file)
    if (!info.isFile()) return notFound(res, method)
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    res.end(method === 'HEAD' ? undefined : body)
  } catch {
    return notFound(res, method)
  }
})

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => console.log(`Grant Match NL app on http://${host}:${port}/`))
}
