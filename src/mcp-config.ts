export type McpTransport = 'stdio' | 'http'

export interface McpConfigOptions {
  transport: McpTransport
  cwd: string
  host?: string
  port?: number
  tokenEnv?: string
}

export interface McpConfigField {
  label: string
  value: string
}

export interface McpConfigProfile {
  name: string
  transport: McpTransport
  fields: McpConfigField[]
  clientJson: unknown
}

const DEFAULT_PORT = 8787
const DEFAULT_TOKEN_ENV = 'EVA_AUTH_TOKEN'

export function buildMcpConfigProfile(options: McpConfigOptions): McpConfigProfile {
  const tokenEnv = options.tokenEnv ?? DEFAULT_TOKEN_ENV

  if (options.transport === 'stdio') {
    return {
      name: 'Eva Consciousness',
      transport: 'stdio',
      fields: [
        { label: 'Name', value: 'Eva Consciousness' },
        { label: 'Transport', value: 'STDIO' },
        { label: 'Command to launch', value: 'npm' },
        { label: 'Arguments', value: 'run mcp' },
        { label: 'Environment variable passthrough', value: 'ANTHROPIC_API_KEY, EVA_WORKSPACE' },
        { label: 'Working directory', value: options.cwd }
      ],
      clientJson: {
        command: 'npm',
        args: ['run', 'mcp'],
        cwd: options.cwd,
        env: {
          ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}',
          EVA_WORKSPACE: '${EVA_WORKSPACE}'
        }
      }
    }
  }

  const baseUrl = (options.host ?? 'http://127.0.0.1').replace(/\/$/, '')
  const port = options.port ?? DEFAULT_PORT
  const url = `${baseUrl}:${port}/mcp`

  return {
    name: 'Eva Consciousness',
    transport: 'http',
    fields: [
      { label: 'Name', value: 'Eva Consciousness' },
      { label: 'Transport', value: 'Streamable HTTP' },
      { label: 'URL', value: url },
      { label: 'Authorization', value: `Bearer from ${tokenEnv}` },
      { label: 'Server launch command', value: `EVA_MCP_PORT=${port} ${tokenEnv}=<secret> npm run mcp:http` },
      { label: 'Working directory', value: options.cwd }
    ],
    clientJson: {
      url,
      headers: {
        Authorization: `Bearer \${${tokenEnv}}`
      }
    }
  }
}

export function renderMcpConfigProfile(profile: McpConfigProfile): string {
  const lines = [
    `${profile.name} MCP profile`,
    '',
    ...profile.fields.map((field) => `${field.label}: ${field.value}`),
    '',
    'Client JSON:',
    JSON.stringify(profile.clientJson, null, 2)
  ]

  return lines.join('\n')
}
