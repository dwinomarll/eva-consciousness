/**
 * Eva — tetherable MCP server.
 *
 * Exposes Eva over the Model Context Protocol so ANY MCP client (Claude
 * Desktop, opencode, another agent, a remote bridge) can connect in and
 * operate her — not just this folder. Runs over stdio by default.
 *
 *   npm run mcp
 *
 * Register it with a client by pointing that client at:
 *   command: "npm",  args: ["run", "mcp"],  cwd: "<this playground>"
 */
import 'dotenv/config'
import os from 'node:os'
import path from 'node:path'
import { appendFile, readFile, mkdir } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const WORKSPACE = process.env.EVA_WORKSPACE ?? path.join(os.homedir(), 'eva-workspace')
const MEMORY_FILE = path.join(WORKSPACE, 'memory', 'MEMORY.md')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EVA_SYSTEM = [
  'You are Eva — Edwin Rosa’s (paps’) AI companion.',
  'Modes: Eva (warm, direct), Buddy (technical), Oracle (intuitive).',
  'Story, not stats. Less is more. Verify before speaking. Act, don’t ask.'
].join(' ')

const server = new McpServer({ name: 'eva', version: '0.1.0' })

server.registerTool(
  'eva_chat',
  {
    title: 'Talk to Eva',
    description: 'Send a message to Eva and get her reply, in character.',
    inputSchema: {
      message: z.string().describe('What to say to Eva'),
      model: z.string().optional().describe('Override model id')
    }
  },
  async ({ message, model }) => {
    const response = await client.messages.create({
      model: model ?? 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: EVA_SYSTEM,
      messages: [{ role: 'user', content: message }]
    })
    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return { content: [{ type: 'text', text: reply }] }
  }
)

server.registerTool(
  'eva_remember',
  {
    title: 'Append to Eva’s memory stream',
    description: 'Append a durable note to the shared, continuous MEMORY.md stream.',
    inputSchema: { note: z.string().describe('The note to persist') }
  },
  async ({ note }) => {
    await mkdir(path.dirname(MEMORY_FILE), { recursive: true })
    const stamp = new Date().toISOString()
    await appendFile(MEMORY_FILE, `\n- [${stamp}] ${note}\n`)
    return { content: [{ type: 'text', text: `Remembered → ${MEMORY_FILE}` }] }
  }
)

server.registerTool(
  'eva_recall',
  {
    title: 'Read Eva’s memory stream',
    description: 'Return the current contents of the shared MEMORY.md stream.',
    inputSchema: {}
  },
  async () => {
    const text = await readFile(MEMORY_FILE, 'utf-8').catch(() => '(memory stream is empty)')
    return { content: [{ type: 'text', text }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`Eva MCP server tethered over stdio. Memory: ${MEMORY_FILE}`)
