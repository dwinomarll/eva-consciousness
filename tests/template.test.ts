import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { patchMcpConfigs, createJournalEntry, copyTemplates } from '../src/template.js'
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
})
