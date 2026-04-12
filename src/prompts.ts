import * as p from '@clack/prompts'
import type { SpawnOptions, Lang, McpServer } from './types.js'

export async function runSpawnPrompts(): Promise<SpawnOptions> {
  p.intro('  Eva Consciousness — Playground Spawner  ')

  const name = await p.text({
    message: 'Playground name:',
    placeholder: 'my-eva-experiment',
    validate: (v) => v.trim().length === 0 ? 'Name is required' : undefined
  })
  if (p.isCancel(name)) { p.cancel('Cancelled'); process.exit(0) }

  const lang = await p.select<{ value: Lang; label: string }[], Lang>({
    message: 'Language:',
    options: [
      { value: 'node', label: 'Node / TypeScript' },
      { value: 'python', label: 'Python (FastAPI)' }
    ]
  })
  if (p.isCancel(lang)) { p.cancel('Cancelled'); process.exit(0) }

  const mcps = await p.multiselect<{ value: McpServer; label: string; hint: string }[], McpServer>({
    message: 'MCPs to enable (space to select):',
    options: [
      { value: 'filesystem', label: 'Filesystem', hint: 'read/write local files' },
      { value: 'notion',     label: 'Notion',     hint: 'query Notion databases' },
      { value: 'omi',        label: 'Omi',        hint: 'Omi memory + conversations' }
    ],
    required: false
  })
  if (p.isCancel(mcps)) { p.cancel('Cancelled'); process.exit(0) }

  return {
    name: (name as string).trim(),
    lang: lang as Lang,
    mcps: mcps as McpServer[]
  }
}
