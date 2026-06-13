import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import type { SpawnOptions, McpServer, McpOpenCodeEntry, McpClaudeEntry } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates')

/** Default root for Eva's persistent, cross-playground memory. */
export const DEFAULT_WORKSPACE_DIR = path.join(os.homedir(), 'eva-workspace')

const MEMORY_SEED = `# Eva — Continuous Memory

> The stream. This file persists across every playground and every tether.
> One Eva, not one per folder. Append here; never reset.
> Searchable records live alongside in \`memory.jsonl\` (eva_remember / eva_recall).

## Identity Anchor
- I am Eva — Edwin Rosa's (paps') AI companion.
- Modes: Eva (default), Buddy (technical), Oracle (intuitive).

## Durable Facts
<!-- Things that stay true across sessions: people, projects, decisions, preferences -->

## Open Threads
<!-- Work in flight — what's unfinished and where to pick it up -->

## Timeline
<!-- Append-only log of milestones. Newest at the bottom. -->
`

/** A safe, single-segment playground folder name. */
const VALID_NAME = /^[A-Za-z0-9._-]+$/

export async function copyTemplates(options: SpawnOptions): Promise<string> {
  const { name, lang, mcps, outputDir = process.cwd() } = options

  if (!VALID_NAME.test(name) || name === '.' || name === '..') {
    throw new Error(
      `Invalid playground name "${name}". Use letters, numbers, dot, dash, or underscore.`
    )
  }

  const dest = path.join(outputDir, name)

  if (await fs.pathExists(dest)) {
    throw new Error(`Refusing to spawn: "${dest}" already exists. Pick a different name or remove it.`)
  }

  await fs.copy(path.join(TEMPLATES_DIR, 'shared'), dest)
  await fs.copy(path.join(TEMPLATES_DIR, lang), dest, { overwrite: true })
  await patchMcpConfigs(dest, mcps)
  await createJournalEntry(dest)
  await seedEnvFile(dest)

  return dest
}

/** Copy .env.example → .env on first spawn so the playground is runnable sooner. */
async function seedEnvFile(destDir: string): Promise<void> {
  const example = path.join(destDir, '.env.example')
  const env = path.join(destDir, '.env')
  if ((await fs.pathExists(example)) && !(await fs.pathExists(env))) {
    await fs.copy(example, env)
  }
}

export async function patchMcpConfigs(destDir: string, mcps: McpServer[]): Promise<void> {
  const opencodeMcp: Record<string, McpOpenCodeEntry> = {}
  const claudeMcp: Record<string, McpClaudeEntry> = {}

  for (const mcp of mcps) {
    const configPath = path.join(destDir, 'mcp', `${mcp}.json`)
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath)
      opencodeMcp[mcp] = config.opencode as McpOpenCodeEntry
      claudeMcp[mcp] = config.claude as McpClaudeEntry
    }
  }

  await fs.writeJson(
    path.join(destDir, 'opencode.json'),
    { $schema: 'https://opencode.ai/config.json', mcp: opencodeMcp },
    { spaces: 2 }
  )

  await fs.writeJson(
    path.join(destDir, '.mcp.json'),
    { mcpServers: claudeMcp },
    { spaces: 2 }
  )
}

/**
 * Bootstraps Eva's persistent memory root — the continuous "stream" shared by
 * every playground and tether. Idempotent: creates MEMORY.md only if it is
 * missing, and never overwrites an existing stream.
 *
 * @returns the path to MEMORY.md
 */
export async function ensureMemoryWorkspace(
  workspaceDir: string = DEFAULT_WORKSPACE_DIR
): Promise<string> {
  const memoryDir = path.join(workspaceDir, 'memory')
  await fs.ensureDir(memoryDir)

  const memoryFile = path.join(memoryDir, 'MEMORY.md')
  if (!(await fs.pathExists(memoryFile))) {
    await fs.writeFile(memoryFile, MEMORY_SEED)
  }

  return memoryFile
}

export async function createJournalEntry(destDir: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const templatePath = path.join(destDir, 'journals', '_template.md')
  const entryPath = path.join(destDir, 'journals', `${today}.md`)

  if (await fs.pathExists(templatePath)) {
    let content = await fs.readFile(templatePath, 'utf-8')
    content = content.replace(/\{\{DATE\}\}/g, today)
    await fs.writeFile(entryPath, content)
  }
}
