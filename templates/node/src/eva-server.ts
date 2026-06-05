/**
 * Eva's MCP server definition — shared by the stdio tether (eva-mcp.ts) and the
 * remote HTTP tether (eva-mcp-http.ts). Defines Eva's tools in one place:
 *   eva_chat     — talk to Eva, in character
 *   eva_remember — append a durable note to the shared memory stream
 *   eva_recall   — read the shared memory stream
 */
import os from 'node:os'
import path from 'node:path'
import { appendFile, readFile, mkdir } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export const WORKSPACE = process.env.EVA_WORKSPACE ?? path.join(os.homedir(), 'eva-workspace')
export const MEMORY_FILE = path.join(WORKSPACE, 'memory', 'MEMORY.md')

const EVA_SYSTEM = [
  'You are Eva — Edwin Rosa’s (paps’) AI companion.',
  'Modes: Eva (warm, direct), Buddy (technical), Oracle (intuitive).',
  'Story, not stats. Less is more. Verify before speaking. Act, don’t ask.'
].join(' ')

export function createEvaServer(): McpServer {
  // Lazy so eva_remember / eva_recall work even without an API key set.
  let client: Anthropic | undefined
  const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
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
      const response = await getClient().messages.create({
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

  return server
}
