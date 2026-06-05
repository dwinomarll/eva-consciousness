import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

const app = express()
app.use(express.json())

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Tether guard: when EVA_AUTH_TOKEN is set, require a matching bearer token.
// This is what lets you safely expose /chat beyond localhost.
const AUTH_TOKEN = process.env.EVA_AUTH_TOKEN
app.use('/chat', (req, res, next) => {
  if (!AUTH_TOKEN) return next()
  if (req.header('authorization') === `Bearer ${AUTH_TOKEN}`) return next()
  res.status(401).json({ error: 'unauthorized' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', playground: 'eva-consciousness' })
})

app.post('/chat', async (req, res) => {
  const { message, model = 'claude-sonnet-4-6' } = req.body as { message: string; model?: string }
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }]
  })
  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  res.json({ reply })
})

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`Eva playground running on http://localhost:${PORT}`)
})
