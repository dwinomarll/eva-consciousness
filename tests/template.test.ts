import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  patchMcpConfigs,
  createJournalEntry,
  copyTemplates,
  ensureMemoryWorkspace
} from '../src/template.js'
import { ALL_MCP_SERVERS } from '../src/types.js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eva-test-'))
})

afterEach(async () => {
  await fs.remove(tmpDir)
})

describe('patchMcpConfigs', () => {
  it('writes opencode.json with selected MCP servers only', async () => {
    await fs.ensureDir(path.join(tmpDir, 'mcp'))
    await fs.writeJson(path.join(tmpDir, 'mcp', 'notion.json'), {
      opencode: { type: 'local', command: ['npx', '-y', 'notion-mcp'], enabled: true },
      claude: { command: 'npx', args: ['-y', 'notion-mcp'], env: {} }
    })
    await fs.writeJson(path.join(tmpDir, 'mcp', 'filesystem.json'), {
      opencode: { type: 'local', command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '.'], enabled: true },
      claude: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], env: {} }
    })

    await patchMcpConfigs(tmpDir, ['notion'])

    const opencodeCfg = await fs.readJson(path.join(tmpDir, 'opencode.json'))
    expect(opencodeCfg.mcp).toHaveProperty('notion')
    expect(opencodeCfg.mcp).not.toHaveProperty('filesystem')

    const claudeCfg = await fs.readJson(path.join(tmpDir, '.mcp.json'))
    expect(claudeCfg.mcpServers).toHaveProperty('notion')
    expect(claudeCfg.mcpServers).not.toHaveProperty('filesystem')
  })

  it('writes empty mcp objects when no MCPs selected', async () => {
    await fs.ensureDir(path.join(tmpDir, 'mcp'))
    await patchMcpConfigs(tmpDir, [])

    const opencodeCfg = await fs.readJson(path.join(tmpDir, 'opencode.json'))
    expect(opencodeCfg.mcp).toEqual({})

    const claudeCfg = await fs.readJson(path.join(tmpDir, '.mcp.json'))
    expect(claudeCfg.mcpServers).toEqual({})
  })
})

describe('createJournalEntry', () => {
  it('creates a dated journal file from _template.md', async () => {
    await fs.ensureDir(path.join(tmpDir, 'journals'))
    await fs.writeFile(
      path.join(tmpDir, 'journals', '_template.md'),
      '# Session Journal — {{DATE}}\n\n## Context\n'
    )

    await createJournalEntry(tmpDir)

    const today = new Date().toISOString().split('T')[0]
    const entryPath = path.join(tmpDir, 'journals', `${today}.md`)
    expect(await fs.pathExists(entryPath)).toBe(true)
    const content = await fs.readFile(entryPath, 'utf-8')
    expect(content).toContain(today)
    expect(content).not.toContain('{{DATE}}')
  })
})

describe('copyTemplates', () => {
  const today = new Date().toISOString().split('T')[0]

  it('scaffolds a node playground with shared files + selected MCPs only', async () => {
    const dest = await copyTemplates({
      name: 'pg',
      lang: 'node',
      mcps: ['filesystem'],
      outputDir: tmpDir
    })

    // language-specific scaffold
    expect(await fs.pathExists(path.join(dest, 'src', 'index.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(dest, 'package.json'))).toBe(true)

    // shared identity + structure
    expect(await fs.pathExists(path.join(dest, 'CLAUDE.md'))).toBe(true)
    expect(await fs.pathExists(path.join(dest, 'agents.md'))).toBe(true)
    expect(await fs.pathExists(path.join(dest, 'journals', `${today}.md`))).toBe(true)

    // MCP patching reflects selection
    const claudeCfg = await fs.readJson(path.join(dest, '.mcp.json'))
    expect(claudeCfg.mcpServers).toHaveProperty('filesystem')
    expect(claudeCfg.mcpServers).not.toHaveProperty('notion')
    const opencodeCfg = await fs.readJson(path.join(dest, 'opencode.json'))
    expect(opencodeCfg.mcp).toHaveProperty('filesystem')
    expect(opencodeCfg.mcp).not.toHaveProperty('omi')
  })

  it('scaffolds a python playground with main.py and empty MCP config', async () => {
    const dest = await copyTemplates({
      name: 'pg',
      lang: 'python',
      mcps: [],
      outputDir: tmpDir
    })

    expect(await fs.pathExists(path.join(dest, 'main.py'))).toBe(true)
    expect(await fs.pathExists(path.join(dest, 'pyproject.toml'))).toBe(true)
    // node scaffold must not leak into a python playground
    expect(await fs.pathExists(path.join(dest, 'src', 'index.ts'))).toBe(false)

    const claudeCfg = await fs.readJson(path.join(dest, '.mcp.json'))
    expect(claudeCfg.mcpServers).toEqual({})
  })

  it('wires the shared memory MCP when selected', async () => {
    const dest = await copyTemplates({
      name: 'pg',
      lang: 'node',
      mcps: ['memory'],
      outputDir: tmpDir
    })

    const claudeCfg = await fs.readJson(path.join(dest, '.mcp.json'))
    expect(claudeCfg.mcpServers).toHaveProperty('memory')
    expect(claudeCfg.mcpServers.memory.env.MEMORY_FILE_PATH).toContain('eva-workspace')
  })

  it('ships a runnable definition for every selectable MCP server', async () => {
    const dest = await copyTemplates({
      name: 'pg',
      lang: 'node',
      mcps: ALL_MCP_SERVERS,
      outputDir: tmpDir
    })

    const claudeCfg = await fs.readJson(path.join(dest, '.mcp.json'))
    // patchMcpConfigs only includes a server if its mcp/<name>.json exists,
    // so this fails if a menu option ever lacks a shipped definition.
    for (const server of ALL_MCP_SERVERS) {
      expect(claudeCfg.mcpServers, `missing definition for ${server}`).toHaveProperty(server)
    }
    // credentialed servers carry their documented env vars
    expect(claudeCfg.mcpServers.slack.env).toHaveProperty('SLACK_BOT_TOKEN')
    expect(claudeCfg.mcpServers.gcal.env).toHaveProperty('GOOGLE_OAUTH_CREDENTIALS')
  })
})

describe('ensureMemoryWorkspace', () => {
  it('creates MEMORY.md (the stream) when it does not exist', async () => {
    const ws = path.join(tmpDir, 'eva-workspace')
    const memoryFile = await ensureMemoryWorkspace(ws)

    expect(memoryFile).toBe(path.join(ws, 'memory', 'MEMORY.md'))
    expect(await fs.pathExists(memoryFile)).toBe(true)
    const content = await fs.readFile(memoryFile, 'utf-8')
    expect(content).toContain('Continuous Memory')
  })

  it('never overwrites an existing stream', async () => {
    const ws = path.join(tmpDir, 'eva-workspace')
    const memoryFile = path.join(ws, 'memory', 'MEMORY.md')
    await fs.ensureDir(path.dirname(memoryFile))
    await fs.writeFile(memoryFile, 'EXISTING STREAM — do not clobber')

    await ensureMemoryWorkspace(ws)

    expect(await fs.readFile(memoryFile, 'utf-8')).toBe('EXISTING STREAM — do not clobber')
  })
})
