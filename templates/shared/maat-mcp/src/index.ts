import os from 'node:os'
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const SERVER_NAME = 'maat'
const SERVER_VERSION = '0.1.0'

const workspaceRoot = process.env.MAAT_WORKSPACE ?? path.join(os.homedir(), 'eva-workspace')
const maatRepoPath = process.env.MAAT_REPO_PATH ?? path.join(os.homedir(), 'maat-repo')

const INSTRUCTIONS = [
  "/Ma'at is Eva's doctrine and routing MCP. Use it when a request needs MAAT/NEXUS scope, architecture checks, memory/vault routing, or a decision about whether work belongs in Eva, MAAT, or a spawned playground.",
  "Prefer read-only status and routing first. Do not expose credentials. Treat MAAT_REPO_PATH as the live MAAT checkout and MAAT_WORKSPACE as Eva's durable workspace root."
].join(' ')

const ROUTES = {
  canvas: 'MAAT canvas and block operations',
  memory: 'MAAT/Eva durable memory lookup or append planning',
  vault: 'Secret references only; never reveal values',
  flow: 'Automation or n8n trigger routing',
  notification: 'Push/notification dispatch planning',
  profile: 'Identity, Who I Am, or personality profile reads',
  health: 'Health relay or wellness signal routing',
  shortcuts: 'iOS Shortcut or device-side action routing',
  nexus: "NEXUS/Branch of Ma'at architecture and boundary work"
} as const

type RouteName = keyof typeof ROUTES

function pickRoutes(request: string): RouteName[] {
  const text = request.toLowerCase()
  const routes: RouteName[] = []
  const add = (route: RouteName, patterns: string[]) => {
    if (patterns.some((pattern) => text.includes(pattern))) routes.push(route)
  }

  add('canvas', ['canvas', 'block', 'page', 'board'])
  add('memory', ['memory', 'remember', 'recall', 'history', 'transcript'])
  add('vault', ['secret', 'credential', 'token', 'api key', 'vault'])
  add('flow', ['workflow', 'n8n', 'automation', 'trigger'])
  add('notification', ['notify', 'notification', 'push', 'alert'])
  add('profile', ['profile', 'identity', 'who i am', 'personality'])
  add('health', ['health', 'sleep', 'heart', 'wellness'])
  add('shortcuts', ['shortcut', 'ios', 'phone', 'pushcut'])
  add('nexus', ['nexus', "ma'at", 'maat', 'branch'])

  return routes.length > 0 ? [...new Set(routes)] : ['nexus']
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function readFirstExisting(paths: string[]): Promise<{ path: string; text: string } | undefined> {
  for (const candidate of paths) {
    try {
      return { path: candidate, text: await readFile(candidate, 'utf-8') }
    } catch {
      // Try the next local source. Missing docs are expected on fresh machines.
    }
  }
  return undefined
}

function createMaatServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS }
  )

  server.registerTool(
    'maat_status',
    {
      title: "/Ma'at status",
      description: "Use this when you need to confirm where /Ma'at is rooted and what routes it exposes.",
      inputSchema: {}
    },
    async () => {
      const repoReady = await pathExists(maatRepoPath)
      const workspaceReady = await pathExists(workspaceRoot)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                server: SERVER_NAME,
                version: SERVER_VERSION,
                workspaceRoot,
                maatRepoPath,
                workspaceReady,
                repoReady,
                routes: ROUTES
              },
              null,
              2
            )
          }
        ]
      }
    }
  )

  server.registerTool(
    'maat_route',
    {
      title: "/Ma'at route request",
      description: "Use this when deciding which MAAT surface should handle a request before editing files or calling tools.",
      inputSchema: {
        request: z.string().min(1).describe('The user request or work item to route')
      }
    },
    async ({ request }) => {
      const routes = pickRoutes(request)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                request,
                routes,
                guidance: routes.map((route) => ({ route, purpose: ROUTES[route] }))
              },
              null,
              2
            )
          }
        ]
      }
    }
  )

  server.registerTool(
    'maat_doctrine_read',
    {
      title: "Read /Ma'at doctrine",
      description: "Use this when you need the closest local MAAT doctrine or MCP server notes without scanning blindly.",
      inputSchema: {
        topic: z.string().optional().describe('Optional focus phrase for the caller; returned as context only')
      }
    },
    async ({ topic }) => {
      const source = await readFirstExisting([
        path.join(workspaceRoot, 'memory', 'project_maat_mcp_server.md'),
        path.join(workspaceRoot, 'memory', 'maat-app.md'),
        path.join(workspaceRoot, 'memory', 'project_maat.md'),
        path.join(maatRepoPath, 'docs', 'MCP-SERVER.md'),
        path.join(maatRepoPath, 'README.md')
      ])

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                topic: topic ?? null,
                sourcePath: source?.path ?? null,
                doctrine: source?.text ?? 'No local MAAT doctrine source was found. Check MAAT_WORKSPACE and MAAT_REPO_PATH.'
              },
              null,
              2
            )
          }
        ]
      }
    }
  )

  server.registerTool(
    'maat_codex_config',
    {
      title: 'Generate Codex MCP config',
      description: "Use this when wiring /Ma'at into Codex config.toml as a local STDIO MCP server.",
      inputSchema: {
        cwd: z.string().optional().describe('Absolute path to the playground; defaults to the current process directory')
      }
    },
    async ({ cwd }) => {
      const serverCwd = cwd ?? process.cwd()
      const toml = [
        '[mcp_servers.maat]',
        'command = "npm"',
        'args = ["--prefix", "maat-mcp", "run", "mcp"]',
        `cwd = "${serverCwd.replaceAll('\\', '\\\\')}"`,
        '',
        '[mcp_servers.maat.env]',
        `MAAT_WORKSPACE = "${workspaceRoot.replaceAll('\\', '\\\\')}"`,
        `MAAT_REPO_PATH = "${maatRepoPath.replaceAll('\\', '\\\\')}"`
      ].join('\n')

      return { content: [{ type: 'text', text: toml }] }
    }
  )

  return server
}

const server = createMaatServer()
const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`/Ma'at MCP server tethered over stdio. Workspace: ${workspaceRoot}`)
