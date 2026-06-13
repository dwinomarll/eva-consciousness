import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'

// Point the store at a throwaway workspace BEFORE importing the module
// (it resolves paths from EVA_WORKSPACE at import time).
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-mem-'))
process.env.EVA_WORKSPACE = ws
const mem = await import('../templates/node/src/memory.ts')

// Deterministic fake embeddings: a 3-dim "topic" vector keyed on the input text,
// so vector recall is testable without a real provider or network.
const DIMS = ['deploy', 'cat', 'ocean']
const vecFor = (text: string) => DIMS.map((d) => (text.toLowerCase().includes(d) ? 1 : 0))
const fakeFetch = (async (_url: string, init: { body?: string }) => {
  const { input } = JSON.parse(init.body as string)
  return { ok: true, json: async () => ({ data: [{ embedding: vecFor(input) }] }) }
}) as unknown as typeof fetch

describe('ranking helpers', () => {
  it('tokenizes on alphanumerics, lowercased', () => {
    expect(mem.tokenize('Deploy, the App!')).toEqual(['deploy', 'the', 'app'])
  })

  it('cosineSim is 1 for parallel, 0 for orthogonal', () => {
    expect(mem.cosineSim([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(mem.cosineSim([1, 0], [0, 1])).toBe(0)
  })

  it('bm25 ranks the doc containing the query term highest', () => {
    const docs = ['we deploy via docker', 'the cat slept all day', 'deploy deploy deploy']
    const scores = mem.bm25Scores('deploy', docs)
    expect(scores[2]).toBeGreaterThan(scores[0])
    expect(scores[0]).toBeGreaterThan(scores[1])
    expect(scores[1]).toBe(0)
  })
})

describe('embedConfig (key-gated)', () => {
  it('is null with no keys, picks Voyage then OpenAI', () => {
    expect(mem.embedConfig({})).toBeNull()
    expect(mem.embedConfig({ VOYAGE_API_KEY: 'v' })?.model).toBe('voyage-3.5')
    expect(mem.embedConfig({ OPENAI_API_KEY: 'o' })?.url).toContain('openai')
  })
})

describe('remember + recall', () => {
  it('keyword-ranks recall offline (no embeddings key)', async () => {
    await mem.remember('we will deploy via docker compose')
    await mem.remember('the cat slept on the warm windowsill')
    await mem.remember('notes about the deep blue ocean')

    const res = await mem.recall('deploy')
    expect(res.mode).toBe('keyword')
    expect(res.records[0].text).toContain('deploy')
    expect(res.records[0].embedding).toBeUndefined()
  })

  it('returns most recent when no query is given', async () => {
    const res = await mem.recall()
    expect(res.mode).toBe('recent')
    expect(res.records[0].text).toContain('ocean') // newest first
  })

  it('embeds on write and cosine-ranks when a key is present', async () => {
    const env = { VOYAGE_API_KEY: 'test' } as NodeJS.ProcessEnv
    const rec = await mem.remember('plan to deploy the new service', { env, fetchImpl: fakeFetch })
    expect(rec.embedding).toEqual([1, 0, 0])
    expect(rec.model).toBe('voyage-3.5')

    const res = await mem.recall('deploy', { env, fetchImpl: fakeFetch })
    expect(res.mode).toBe('vector')
    expect(res.records[0].text).toContain('deploy')
  })

  it('formats recall output with a header and numbered lines', async () => {
    const res = await mem.recall('deploy')
    const text = mem.formatRecall(res, 'deploy')
    expect(text).toMatch(/Recalled \d+ of \d+ memories for "deploy"/)
    expect(text).toMatch(/^1\. \[/m)
  })
})
