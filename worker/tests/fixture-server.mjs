// SAMPLE fixture server for the Worker's live-check tests. Serves the SAMPLE source pages (as saved in
// core/tests/fixtures/sources/) at the paths of their https://sample.invalid/ URLs, with two planted problems:
//   - one page has one quote removed (its first criterion quote),
//   - robots.txt disallows the path of one other source.
// GET /__requests lists every path requested, so a test can prove the disallowed page was never fetched.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { pageText } from '../../core/text.js'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function loadSample() {
  return JSON.parse(readFileSync(resolve(repo, 'data/build/sample.json'), 'utf8'))
}

// Picks the planted problems deterministically from the SAMPLE bundle.
export function plan(bundle = loadSample()) {
  const withQuote = bundle.programs.find((p) => p.criteria.length && p.sources.length > 0)
  const altered = withQuote.criteria[0]
  const alteredSource = withQuote.sources.find((s) => s.id === altered.source)
  const blocked = bundle.programs
    .flatMap((p) => p.sources.map((s) => ({ program: p.slug, source: s })))
    .find((x) => x.source.id !== alteredSource.id && new URL(x.source.url).pathname !== new URL(alteredSource.url).pathname)
  return {
    removed: { program_slug: withQuote.slug, source_id: alteredSource.id, quote: altered.quote },
    blocked: { program_slug: blocked.program, source_id: blocked.source.id, path: new URL(blocked.source.url).pathname },
  }
}

export function startFixtureServer(port, bundle = loadSample()) {
  const p = plan(bundle)
  const byPath = new Map()
  for (const program of bundle.programs) {
    for (const s of program.sources) byPath.set(new URL(s.url).pathname, s.id)
  }
  const requests = []
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname
    if (path === '/__requests') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify(requests))
    }
    requests.push({ path, ua: req.headers['user-agent'] || '' })
    if (path === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      return res.end(`User-agent: *\nDisallow: ${p.blocked.path}\n`)
    }
    const id = byPath.get(path)
    if (!id) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('not found')
    }
    let html = readFileSync(resolve(repo, 'core/tests/fixtures/sources', `${id}.html`), 'utf8')
    if (id === p.removed.source_id) {
      // Rebuild the page from its page text minus one quote, so every other quote still matches exactly.
      const text = pageText(html).replace(p.removed.quote, '')
      html = `<!doctype html><html><body><p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p></body></html>`
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, plan: p, requests })))
}
