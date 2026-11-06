// Local development / test server: serves the built site and runs the same
// API as production, storing data in a folder instead of Netlify Blobs.
//   node server/dev-server.mjs [distDir] [port] [dataDir]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createApp } from './app.mjs'
import { fileStores } from './stores.mjs'

const dist = path.resolve(process.argv[2] || 'dist')
const port = Number(process.argv[3] || 8888)
const data = path.resolve(process.argv[4] || '.data')
// RPS_DATA_ENV=preview shows the dashboard exactly as it looks on a Deploy Preview.
const app = createApp({ stores: fileStores(data), env: process.env, dataEnv: process.env.RPS_DATA_ENV || 'local' })

// Apply public/_headers like Netlify does, so local testing runs under the real security headers.
const rules = []
try {
  let cur = null
  for (const line of fs.readFileSync(path.join(dist, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) rules.push((cur = { pattern: line.trim(), headers: {} }))
    else if (cur) {
      const i = line.indexOf(':')
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
} catch {
  /* no _headers */
}
const headersFor = (p) =>
  Object.assign({}, ...rules.filter((r) => (r.pattern.endsWith('*') ? p.startsWith(r.pattern.slice(0, -1)) : p === r.pattern)).map((r) => r.headers))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.json': 'application/json' }

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : req
      const request = new Request(url, { method: req.method, headers: req.headers, body, duplex: 'half' })
      const r = await app(request, { ip: req.socket.remoteAddress })
      const headers = {}
      r.headers.forEach((v, k) => (headers[k] = v))
      res.writeHead(r.status, headers)
      res.end(Buffer.from(await r.arrayBuffer()))
      return
    }
    let p = decodeURIComponent(url.pathname)
    if (p === '/admin') return res.writeHead(301, { Location: '/admin/' }).end()
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(dist, p)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('Not found')
    res.writeHead(200, { ...headersFor(url.pathname), 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`dev server http://localhost:${port}  (data: ${data})`))
