/**
 * Eva's persistent, searchable memory store — shared by every tether
 * (stdio + remote HTTP) and therefore by any MCP client that connects in.
 *
 * Two layers over one folder (~/eva-workspace/memory):
 *   - MEMORY.md     the human-readable narrative stream (kept, mirrored to)
 *   - memory.jsonl  an append-only structured record store the tools search
 *
 * Recall is "both, key-gated":
 *   - offline default  → BM25 keyword ranking, no API key, no network
 *   - embeddings on    → cosine similarity over stored vectors
 * Embeddings switch on automatically when an embeddings key is present
 * (EVA_EMBED_API_KEY / VOYAGE_API_KEY / OPENAI_API_KEY). New memories are
 * embedded as they're written; text-only records simply rank by similarity 0.
 */
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { appendFile, readFile, mkdir } from 'node:fs/promises'

export const WORKSPACE = process.env.EVA_WORKSPACE ?? path.join(os.homedir(), 'eva-workspace')
export const MEMORY_DIR = path.join(WORKSPACE, 'memory')
export const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md')
export const RECORDS_FILE = path.join(MEMORY_DIR, 'memory.jsonl')

export interface MemoryRecord {
  id: string
  ts: string
  text: string
  tags?: string[]
  embedding?: number[]
  model?: string
}

export interface RecallResult {
  mode: 'vector' | 'keyword' | 'recent' | 'empty'
  records: MemoryRecord[]
  total: number
  narrative?: string
}

// ── embeddings provider (key-gated; Voyage/OpenAI share request+response shape) ──
export interface EmbedConfig { url: string; key: string; model: string }

export function embedConfig(env: NodeJS.ProcessEnv = process.env): EmbedConfig | null {
  const model = env.EVA_EMBED_MODEL
  if (env.EVA_EMBED_API_KEY) {
    return { url: env.EVA_EMBED_URL ?? 'https://api.voyageai.com/v1/embeddings', key: env.EVA_EMBED_API_KEY, model: model ?? 'voyage-3.5' }
  }
  if (env.VOYAGE_API_KEY) return { url: 'https://api.voyageai.com/v1/embeddings', key: env.VOYAGE_API_KEY, model: model ?? 'voyage-3.5' }
  if (env.OPENAI_API_KEY) return { url: 'https://api.openai.com/v1/embeddings', key: env.OPENAI_API_KEY, model: model ?? 'text-embedding-3-small' }
  return null
}

export type FetchLike = typeof fetch

export async function embed(text: string, cfg: EmbedConfig, fetchImpl: FetchLike = fetch): Promise<number[]> {
  const res = await fetchImpl(cfg.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ input: text, model: cfg.model })
  })
  if (!res.ok) throw new Error(`embedding request failed: ${res.status}`)
  const data = (await res.json()) as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

// ── pure ranking helpers ──
export function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** Classic BM25 scores for `query` over `docs` (parallel array of scores). */
export function bm25Scores(query: string, docs: string[], k1 = 1.5, b = 0.75): number[] {
  const docTokens = docs.map(tokenize)
  const avgLen = docTokens.reduce((n, t) => n + t.length, 0) / (docTokens.length || 1)
  const df = new Map<string, number>()
  for (const toks of docTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1)
  }
  const N = docs.length
  const qTerms = [...new Set(tokenize(query))]
  return docTokens.map((toks) => {
    const len = toks.length
    const tf = new Map<string, number>()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const term of qTerms) {
      const f = tf.get(term)
      if (!f) continue
      const idf = Math.log(1 + (N - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5))
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / avgLen)))
    }
    return score
  })
}

// ── store IO ──
export async function loadRecords(file: string = RECORDS_FILE): Promise<MemoryRecord[]> {
  const raw = await readFile(file, 'utf-8').catch(() => '')
  const out: MemoryRecord[] = []
  for (const line of raw.split('\n')) {
    if (line.trim()) { try { out.push(JSON.parse(line) as MemoryRecord) } catch { /* skip corrupt line */ } }
  }
  return out
}

export interface RememberOptions { tags?: string[]; env?: NodeJS.ProcessEnv; fetchImpl?: FetchLike }

export async function remember(text: string, opts: RememberOptions = {}): Promise<MemoryRecord> {
  await mkdir(MEMORY_DIR, { recursive: true })
  const cfg = embedConfig(opts.env)
  let embedding: number[] | undefined
  let model: string | undefined
  if (cfg) {
    try { embedding = await embed(text, cfg, opts.fetchImpl); model = cfg.model }
    catch { /* offline / provider down → store text-only, still recallable via BM25 */ }
  }
  const record: MemoryRecord = { id: randomUUID(), ts: new Date().toISOString(), text, tags: opts.tags, embedding, model }
  await appendFile(RECORDS_FILE, JSON.stringify(record) + '\n')
  // Mirror to the human narrative stream so MEMORY.md stays readable.
  await appendFile(MEMORY_FILE, `\n- [${record.ts}] ${text}\n`).catch(() => {})
  return record
}

export interface RecallOptions { limit?: number; env?: NodeJS.ProcessEnv; fetchImpl?: FetchLike }

export async function recall(query?: string, opts: RecallOptions = {}): Promise<RecallResult> {
  const limit = opts.limit ?? 5
  const records = await loadRecords()
  if (records.length === 0) {
    const narrative = await readFile(MEMORY_FILE, 'utf-8').catch(() => undefined)
    return { mode: 'empty', records: [], total: 0, narrative }
  }
  if (!query || !query.trim()) {
    return { mode: 'recent', records: records.slice(-limit).reverse(), total: records.length }
  }
  const cfg = embedConfig(opts.env)
  if (cfg) {
    const qvec = await embed(query, cfg, opts.fetchImpl)
    const ranked = records
      .map((r) => ({ r, score: r.embedding ? cosineSim(qvec, r.embedding) : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.r)
    return { mode: 'vector', records: ranked, total: records.length }
  }
  const scores = bm25Scores(query, records.map((r) => r.text))
  const ranked = records
    .map((r, i) => ({ r, score: scores[i] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r)
  return { mode: 'keyword', records: ranked, total: records.length }
}

export function formatRecall(result: RecallResult, query?: string): string {
  if (result.mode === 'empty') {
    return result.narrative ? result.narrative : '(memory stream is empty)'
  }
  if (result.records.length === 0) return `(no memories match "${query}")`
  const header =
    result.mode === 'recent'
      ? `${result.records.length} most recent of ${result.total} memories:`
      : `Recalled ${result.records.length} of ${result.total} memories for "${query}" (${result.mode}):`
  const lines = result.records.map((r, i) => `${i + 1}. [${r.ts}] ${r.text}`)
  return [header, ...lines].join('\n')
}
