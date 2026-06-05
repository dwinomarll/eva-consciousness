import { execa } from 'execa'
import * as p from '@clack/prompts'
import path from 'path'
import { copyTemplates, ensureMemoryWorkspace } from './template.js'
import type { SpawnOptions } from './types.js'

export async function spawnPlayground(options: SpawnOptions): Promise<void> {
  const s = p.spinner()

  s.start('Tethering to memory stream…')
  const memoryFile = await ensureMemoryWorkspace(options.workspaceDir)
  s.stop(`Memory stream ready → ${memoryFile}`)

  s.start('Copying templates…')
  const dest = await copyTemplates(options)
  s.stop(`Templates copied → ${dest}`)

  s.start('Initialising git…')
  await execa('git', ['init'], { cwd: dest })
  await execa('git', ['add', '.'], { cwd: dest })
  await execa('git', ['commit', '-m', 'chore: init Eva Consciousness playground'], { cwd: dest })
  s.stop('Git initialised')

  s.start('Installing dependencies…')
  if (options.lang === 'node') {
    await execa('npm', ['install'], { cwd: dest })
  } else {
    const hasUv = await commandExists('uv')
    if (hasUv) {
      await execa('uv', ['sync'], { cwd: dest })
    } else {
      await execa('pip', ['install', '-e', '.'], { cwd: dest })
    }
  }
  s.stop('Dependencies installed')

  const relPath = path.relative(process.cwd(), dest)
  p.outro([
    '',
    `  Playground ready at: ${dest}`,
    `  Memory stream:       ${memoryFile}`,
    '',
    `  cd ${relPath}`,
    `  opencode .    ← launch opencode`,
    `  claude        ← launch Claude Code`,
    options.lang === 'node' ? `  npm run mcp   ← expose Eva as a tetherable MCP server` : '',
    ''
  ].filter(Boolean).join('\n'))
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa('which', [cmd])
    return true
  } catch {
    return false
  }
}
