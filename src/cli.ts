#!/usr/bin/env node
import { Command } from 'commander'
import { runSpawnPrompts } from './prompts.js'
import { spawnPlayground } from './spawn.js'
import {
  buildMcpConfigProfile,
  renderMcpConfigProfile,
  type McpTransport
} from './mcp-config.js'

const program = new Command()

program
  .name('eva-consciousness')
  .description('Eva Consciousness — AI-native playground spawner')
  .version('0.1.0')

program
  .command('spawn')
  .description('Spawn a new Eva playground')
  .action(async () => {
    const options = await runSpawnPrompts()
    await spawnPlayground(options)
  })

program
  .command('mcp-config')
  .description('Print paste-ready custom MCP settings for an Eva playground')
  .option('-t, --transport <transport>', 'stdio or http', 'stdio')
  .option('--cwd <path>', 'playground working directory', process.cwd())
  .option('--host <url>', 'HTTP base URL, without port', 'http://127.0.0.1')
  .option('--port <port>', 'HTTP MCP port', '8787')
  .option('--token-env <name>', 'env var or Vault-backed token name for HTTP bearer auth', 'EVA_AUTH_TOKEN')
  .action((options) => {
    const transport = options.transport as McpTransport
    if (transport !== 'stdio' && transport !== 'http') {
      throw new Error(`Invalid transport "${options.transport}". Use "stdio" or "http".`)
    }

    const profile = buildMcpConfigProfile({
      transport,
      cwd: options.cwd,
      host: options.host,
      port: Number(options.port),
      tokenEnv: options.tokenEnv
    })

    console.log(renderMcpConfigProfile(profile))
  })

program.parse()
