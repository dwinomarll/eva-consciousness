/**
 * Eva — remote tether (Streamable HTTP).
 *
 * Serves Eva's MCP over HTTP so she's reachable off-host — from a phone, a web
 * bridge, or another machine. Stateless: a fresh server/transport per request.
 *
 *   npm run mcp:http        # listens on EVA_MCP_PORT (default 8787) at POST /mcp
 *
 * Secure it by setting EVA_AUTH_TOKEN — callers must then send
 *   Authorization: Bearer <token>
 *
 * Point any Streamable-HTTP MCP client at:  http://<host>:<port>/mcp
 */
import 'dotenv/config'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createEvaServer, MEMORY_FILE } from './eva-server.js'

const PORT = Number(process.env.EVA_MCP_PORT ?? 8787)
const AUTH_TOKEN = process.env.EVA_AUTH_TOKEN

const app = express()
app.use(express.json())

// Tether guard: when EVA_AUTH_TOKEN is set, require a matching bearer token.
app.use((req, res, next) => {
  if (!AUTH_TOKEN) return next()
  if (req.header('authorization') === `Bearer ${AUTH_TOKEN}`) return next()
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

app.listen(PORT, () => {
  console.error(`Eva remote MCP tether on http://localhost:${PORT}/mcp`)
  console.error(`Memory: ${MEMORY_FILE}${AUTH_TOKEN ? ' (bearer-guarded)' : ' (open — local only)'}`)
})
