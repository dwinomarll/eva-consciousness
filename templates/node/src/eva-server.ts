/**
 * Eva's MCP server definition — shared by the stdio tether (eva-mcp.ts) and the
 * remote HTTP tether (eva-mcp-http.ts). Defines Eva's tools in one place:
 *   eva_chat     — talk to Eva, in character
 *   eva_remember — append a durable note to the shared memory stream
 *   eva_recall   — read the shared memory stream
 */
import Anthropic from '@anthropic-ai/sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { remember, recall, formatRecall, WORKSPACE, MEMORY_FILE } from './memory.js'

export { WORKSPACE, MEMORY_FILE }

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
      title: 'Persist a memory',
      description: 'Save a durable memory to the shared, continuous store (searchable across every playground and tether).',
      inputSchema: {
        note: z.string().describe('The fact or memory to persist'),
        tags: z.array(z.string()).optional().describe('Optional labels for grouping')
      }
    },
    async ({ note, tags }) => {
      const rec = await remember(note, { tags })
      const how = rec.embedding ? `embedded (${rec.model})` : 'text-only'
      return { content: [{ type: 'text', text: `Remembered (${how}) → ${MEMORY_FILE.replace('MEMORY.md', 'memory.jsonl')}` }] }
    }
  )

  server.registerTool(
    'eva_recall',
    {
      title: 'Search Eva’s memory',
      description: 'Recall relevant memories. With a query: semantic (embeddings) or keyword (BM25) ranked search. Without: the most recent memories.',
      inputSchema: {
        query: z.string().optional().describe('What to search for; omit for most recent'),
        limit: z.number().int().positive().optional().describe('Max results (default 5)')
      }
    },
    async ({ query, limit }) => {
      const result = await recall(query, { limit })
      return { content: [{ type: 'text', text: formatRecall(result, query) }] }
    }
  )

  return server
}
