import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { patchMcpConfigs, createJournalEntry } from '../src/template.js'
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
