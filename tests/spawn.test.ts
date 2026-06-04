import { describe, it, expect, vi, beforeEach } from 'vitest'

// execa is the only side-effecting dependency we need to observe.
const execaMock = vi.fn()
vi.mock('execa', () => ({ execa: (...args: unknown[]) => execaMock(...args) }))

// copyTemplates is covered by template.test.ts — stub it here so spawn tests
// stay focused on the orchestration (git + dependency install) logic.
vi.mock('../src/template.js', () => ({
  copyTemplates: vi.fn().mockResolvedValue('/tmp/fake-playground/pg')
}))

// @clack/prompts only provides UI affordances; render them as no-ops.
vi.mock('@clack/prompts', () => ({
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  outro: vi.fn()
}))

import { spawnPlayground } from '../src/spawn.js'

/** Flatten each execa call into a "cmd arg arg" string for easy assertions. */
function runCommands(): string[] {
  return execaMock.mock.calls.map((call) => {
    const [cmd, args = []] = call as [string, string[]?]
    return [cmd, ...args].join(' ')
  })
}

describe('spawnPlayground', () => {
  beforeEach(() => {
    execaMock.mockReset()
    execaMock.mockResolvedValue({ stdout: '' })
  })

  it('initialises git and installs npm deps for a node playground', async () => {
    await spawnPlayground({ name: 'pg', lang: 'node', mcps: [] })

    const cmds = runCommands()
    expect(cmds).toContain('git init')
    expect(cmds).toContain('git add .')
    expect(cmds.some((c) => c.startsWith('git commit'))).toBe(true)
    expect(cmds).toContain('npm install')
    // node path must never reach for python tooling
    expect(cmds).not.toContain('uv sync')
  })

  it('prefers `uv sync` for python when uv is available', async () => {
    await spawnPlayground({ name: 'pg', lang: 'python', mcps: [] })

    const cmds = runCommands()
    expect(cmds).toContain('which uv')
    expect(cmds).toContain('uv sync')
    expect(cmds).not.toContain('npm install')
  })

  it('falls back to `pip install -e .` when uv is missing', async () => {
    execaMock.mockImplementation((cmd: string, args: string[] = []) => {
      if (cmd === 'which' && args[0] === 'uv') {
        return Promise.reject(new Error('uv not found'))
      }
      return Promise.resolve({ stdout: '' })
    })

    await spawnPlayground({ name: 'pg', lang: 'python', mcps: [] })

    const cmds = runCommands()
    expect(cmds).toContain('pip install -e .')
    expect(cmds).not.toContain('uv sync')
  })
})
