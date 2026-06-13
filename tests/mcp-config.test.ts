import { describe, expect, it } from 'vitest'
import { buildMcpConfigProfile, renderMcpConfigProfile } from '../src/mcp-config.js'

describe('buildMcpConfigProfile', () => {
  it('prints paste-ready stdio settings', () => {
    const profile = buildMcpConfigProfile({
      transport: 'stdio',
      cwd: '/tmp/eva-playground'
    })

    expect(profile.name).toBe('Eva Consciousness')
    expect(profile.fields).toContainEqual({ label: 'Command to launch', value: 'npm' })
    expect(profile.fields).toContainEqual({ label: 'Arguments', value: 'run mcp' })
    expect(profile.fields).toContainEqual({ label: 'Working directory', value: '/tmp/eva-playground' })
    expect(renderMcpConfigProfile(profile)).toContain('"args": [')
  })

  it('prints paste-ready streamable HTTP settings', () => {
    const profile = buildMcpConfigProfile({
      transport: 'http',
      cwd: '/tmp/eva-playground',
      host: 'http://eva.local',
      port: 8788,
      tokenEnv: 'Eva_MCP'
    })

    expect(profile.fields).toContainEqual({ label: 'Transport', value: 'Streamable HTTP' })
    expect(profile.fields).toContainEqual({ label: 'URL', value: 'http://eva.local:8788/mcp' })
    expect(profile.fields).toContainEqual({ label: 'Authorization', value: 'Bearer from Eva_MCP' })
  })
})
