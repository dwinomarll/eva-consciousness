import * as p from '@clack/prompts'
import type { SpawnOptions, Lang, McpServer } from './types.js'

export async function runSpawnPrompts(): Promise<SpawnOptions> {
  p.intro('  Eva Consciousness — Playground Spawner  ')

  const name = await p.text({
    message: 'Playground name:',
    placeholder: 'my-eva-experiment',
    validate: (v) => {
      const t = v.trim()
      if (t.length === 0) return 'Name is required'
      if (!/^[A-Za-z0-9._-]+$/.test(t)) return 'Use letters, numbers, dot, dash, or underscore only'
      return undefined
    }
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
      { value: 'filesystem',         label: 'Filesystem',          hint: 'read/write local files' },
      { value: 'memory',             label: 'Memory (the stream)', hint: 'shared cross-playground memory' },
      { value: 'sequentialthinking', label: 'Sequential Thinking', hint: 'structured step-by-step reasoning' },
      { value: 'gmail',              label: 'Gmail',               hint: 'read/send mail (OAuth)' },
      { value: 'gcal',               label: 'Google Calendar',     hint: 'events + scheduling (OAuth)' },
      { value: 'slack',              label: 'Slack',               hint: 'channels + messages (bot token)' },
      { value: 'notion',             label: 'Notion',              hint: 'query Notion databases' },
      { value: 'omi',                label: 'Omi',                 hint: 'Omi memory + conversations' }
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
