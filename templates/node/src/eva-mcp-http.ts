/**
 * Eva — remote tether (Streamable HTTP).
 *
 * Serves Eva's MCP over HTTP so she's reachable off-host — from a phone, a web
 * bridge, Ma'at, or any MCP client worldwide. Stateless: a fresh
 * server/transport per request, so it scales horizontally and survives
 * restarts with zero session loss.
 *
 *   npm run mcp:http        # POST /mcp  (port: EVA_MCP_PORT > PORT > 8787)
 *
 * Reach levels (see .env.example):
 *   local      EVA_MCP_HOST=127.0.0.1 (default) — same machine only
 *   LAN/world  EVA_MCP_HOST=0.0.0.0 + EVA_AUTH_TOKEN — bearer-guarded
 *
 * Safety interlock: binding beyond loopback WITHOUT a token refuses to start
 * unless EVA_ALLOW_OPEN=1 is set explicitly. Never expose her naked by accident.
 *
 * Point any Streamable-HTTP MCP client at:  http(s)://<host>:<port>/mcp
 */
import 'dotenv/config'
import { timingSafeEqual } from 'node:crypto'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createEvaServer, MEMORY_FILE } from './eva-server.js'

const HOST = process.env.EVA_MCP_HOST ?? '127.0.0.1'
const PORT = Number(process.env.EVA_MCP_PORT ?? process.env.PORT ?? 8787)
const AUTH_TOKEN = process.env.EVA_AUTH_TOKEN
const CORS_ORIGIN = process.env.EVA_CORS_ORIGIN ?? '*'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])
if (!LOOPBACK.has(HOST) && !AUTH_TOKEN && process.env.EVA_ALLOW_OPEN !== '1') {
  console.error(
    `Refusing to bind ${HOST} without EVA_AUTH_TOKEN — that would expose Eva unauthenticated.\n` +
      `Set EVA_AUTH_TOKEN (recommended) or EVA_ALLOW_OPEN=1 to override knowingly.`
  )
  process.exit(1)
}

function tokenMatches(header: string | undefined): boolean {
  if (!AUTH_TOKEN) return true
  const expected = Buffer.from(`Bearer ${AUTH_TOKEN}`)
  const got = Buffer.from(header ?? '')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

const app = express()
app.use(express.json({ limit: '4mb' }))

// CORS so browser-based MCP clients (web bridges, inspectors) can connect.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Unauthenticated liveness probe for deploy platforms (Fly, Railway, Render…).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'eva-mcp', transport: 'streamable-http' })
})

// Tether guard: when EVA_AUTH_TOKEN is set, require a matching bearer token.
app.use((req, res, next) => {
  if (tokenMatches(req.header('authorization'))) return next()
  res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' }, id: null })
})

app.post('/mcp', async (req, res) => {
  // Stateless: new server + transport per request, cleaned up on close.
  const server = createEvaServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

// Stateless mode has no SSE stream or session to manage.
app.get('/mcp', (_req, res) => res.sendStatus(405))
app.delete('/mcp', (_req, res) => res.sendStatus(405))

app.listen(PORT, HOST, () => {
  const reach = LOOPBACK.has(HOST) ? 'local only' : AUTH_TOKEN ? 'worldwide, bearer-guarded' : 'OPEN (override)'
  console.error(`Eva remote MCP tether on http://${HOST}:${PORT}/mcp — ${reach}`)
  console.error(`Memory: ${MEMORY_FILE}`)
})
