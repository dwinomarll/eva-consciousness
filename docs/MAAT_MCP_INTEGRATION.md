# MAAT MCP Integration

Status: ready as a generated MCP tether, with deployment choices still explicit.

Eva Consciousness is not a single always-on daemon in this repository. It is a
playground spawner. Every generated playground can expose Eva as an MCP server:

- `eva_chat`: send a message to Eva with the playground identity loaded.
- `eva_remember`: append a durable note to the shared memory stream.
- `eva_recall`: read the shared memory stream.

The shared memory stream defaults to:

```text
~/eva-workspace/memory/MEMORY.md
```

## Verified Locally

On 2026-06-13, the repository passed:

```bash
npm test
npm run build
npm run build && npm run verify:templates
```

`verify:templates` generated both Python and Node playgrounds, installed the
Node scaffold, and type-checked the Node app plus MCP stdio and HTTP tethers.

## Recommended MAAT Path

Use the Node Streamable HTTP tether when MAAT needs to call Eva from FIRE or any
other app surface:

```bash
cd /path/to/eva-playground
EVA_WORKSPACE="$HOME/eva-workspace" \
EVA_AUTH_TOKEN="<vault-secret>" \
EVA_MCP_PORT=8787 \
npm run mcp:http
```

Then in MAAT:

```text
FIRE -> Add Node -> MCP discovery
serverUrl: http://<mac-or-tailscale-host>:8787/mcp
Vault token name: Eva_MCP
tool: eva_chat, eva_remember, or eva_recall
```

Keep the token value in MAAT Vault. Flows and docs should reference only the
Vault token name.

## Paste-Ready Custom MCP Fields

Generate the same profile from the repo:

```bash
eva-consciousness mcp-config --transport stdio --cwd /path/to/eva-playground
eva-consciousness mcp-config --transport http --cwd /path/to/eva-playground --host http://127.0.0.1 --port 8787
```

For a custom MCP screen like Codex:

```text
Name: Eva Consciousness
Transport: STDIO
Command to launch: npm
Arguments:
  run
  mcp
Environment variable passthrough:
  ANTHROPIC_API_KEY
  EVA_WORKSPACE
Working directory: /path/to/eva-playground
```

For Streamable HTTP:

```text
Name: Eva Consciousness
Transport: Streamable HTTP
URL: http://<host>:8787/mcp
Authorization: Bearer token from the client secret store
```

## Local Model/App Client Path

Use stdio when the MCP client runs in the same folder:

```json
{
  "command": "npm",
  "args": ["run", "mcp"],
  "cwd": "/path/to/eva-playground"
}
```

Python parity exists for local stdio:

```json
{
  "command": "python",
  "args": ["eva_mcp.py"],
  "cwd": "/path/to/eva-playground"
}
```

## SSH Workflow Shape

SSH is useful as an operator transport, not as the MCP protocol itself. The clean
shape is:

1. Run the Eva HTTP tether on the Mac, Jetson, or VPS host that owns the memory
   workspace.
2. Reach it over Tailscale, LAN, or an SSH tunnel.
3. Let MAAT call the HTTP MCP endpoint with a Vault-referenced bearer token.

Example tunnel from another machine:

```bash
ssh -N -L 8787:127.0.0.1:8787 <host-alias>
```

Then point the local client at:

```text
http://127.0.0.1:8787/mcp
```

## Boundaries

- Do not expose the HTTP tether on the public internet without TLS and a bearer
  token.
- Do not print `EVA_AUTH_TOKEN` in shell traces, docs, or flow payloads.
- `eva_chat` requires `ANTHROPIC_API_KEY`; `eva_remember` and `eva_recall` work
  without a model API key.
- MAAT already has MCP client and discovery surfaces. This repo owns the Eva
  server contract; MAAT owns the workflow nodes that consume it.

## Readiness Verdict

Ready for local and private-network integration.

Not yet a hardened public service. Before public exposure, add per-client token
rotation, TLS termination notes, health checks, and a launchd/container deployment
profile.
