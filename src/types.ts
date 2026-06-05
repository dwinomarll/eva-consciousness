export type Lang = 'python' | 'node'
export type McpServer = 'notion' | 'omi' | 'filesystem' | 'memory' | 'sequentialthinking'

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
