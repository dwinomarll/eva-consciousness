/**
 * Eva — tetherable MCP server (stdio).
 *
 * Exposes Eva over the Model Context Protocol so ANY MCP client (Claude
 * Desktop, opencode, another agent) can connect in and operate her — not just
 * this folder. Runs over stdio.
 *
 *   npm run mcp
 *
 * Register it with a client by pointing that client at:
 *   command: "npm",  args: ["run", "mcp"],  cwd: "<this playground>"
 *
 * For remote/off-host operation, use the HTTP tether instead: npm run mcp:http
 */
import 'dotenv/config'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createEvaServer, MEMORY_FILE } from './eva-server.js'

const server = createEvaServer()
const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`Eva MCP server tethered over stdio. Memory: ${MEMORY_FILE}`)
