/**
 * Spawn real playgrounds from the templates and prove they hold together:
 *   - python scaffold generates
 *   - node scaffold generates, installs, and type-checks (index + all tethers)
 *
 * Run after `npm run build`. Used by CI so a broken template can't ship green.
 */
import { execa } from 'execa'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { copyTemplates, ensureMemoryWorkspace } from '../dist/template.js'

const ALL = ['filesystem', 'memory', 'sequentialthinking', 'gmail', 'gcal', 'slack', 'notion', 'omi']

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'eva-ci-'))
const workspaceDir = path.join(tmp, '.workspace')

try {
  await ensureMemoryWorkspace(workspaceDir)

  const py = await copyTemplates({ name: 'pg-python', lang: 'python', mcps: ALL, outputDir: tmp, workspaceDir })
  console.log(`✓ python scaffold generated → ${py}`)

  const node = await copyTemplates({ name: 'pg-node', lang: 'node', mcps: ALL, outputDir: tmp, workspaceDir })
  console.log(`✓ node scaffold generated → ${node}`)

  console.log('▶ installing node playground…')
  await execa('npm', ['install'], { cwd: node, stdio: 'inherit' })

  console.log('▶ type-checking node playground (index + tether servers)…')
  await execa('npx', ['tsc', '--noEmit'], { cwd: node, stdio: 'inherit' })

  console.log('\n✅ template verification passed')
} finally {
  await fs.remove(tmp)
}
