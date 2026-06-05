export type Lang = 'python' | 'node'
export type McpServer =
  | 'notion'
  | 'omi'
  | 'filesystem'
  | 'memory'
  | 'sequentialthinking'
  | 'gmail'
  | 'gcal'
  | 'slack'

/** Every selectable MCP server. Each must ship a templates/shared/mcp/<name>.json. */
export const ALL_MCP_SERVERS: McpServer[] = [
  'filesystem',
  'memory',
  'sequentialthinking',
  'gmail',
  'gcal',
  'slack',
  'notion',
  'omi'
]

export interface SpawnOptions {
  name: string
  lang: Lang
  mcps: McpServer[]
  outputDir?: string
  /** Root of Eva's persistent cross-playground memory. Defaults to ~/eva-workspace. */
  workspaceDir?: string
}

export interface McpOpenCodeEntry {
  type: 'local'
  command: string[]
  enabled: boolean
  env?: Record<string, string>
}

export interface McpClaudeEntry {
  command: string
  args: string[]
  env?: Record<string, string>
}
