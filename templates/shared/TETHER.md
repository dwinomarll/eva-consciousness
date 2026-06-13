# Eva Tether — connect from anywhere 🌍

Eva is an MCP server. Any MCP client — Ma'at, Claude Desktop, Claude Code,
opencode, a phone bridge — can tether to her at one of three reach levels.

## Reach levels

| Level | How | Guard |
|-------|-----|-------|
| **Local** | stdio (`npm run mcp` / `python eva_mcp.py`) | OS process isolation |
| **LAN** | `npm run mcp:http` with `EVA_MCP_HOST=0.0.0.0` | `EVA_AUTH_TOKEN` bearer |
| **Worldwide** | Docker → Fly/Railway/Render/VPS behind TLS | bearer + HTTPS |

The HTTP tether **refuses to bind beyond loopback without `EVA_AUTH_TOKEN`**
(override knowingly with `EVA_ALLOW_OPEN=1`). Generate a token:

```sh
openssl rand -hex 32
```

## Wire up Ma'at (or any MCP client)

**Same machine — stdio** (node playground; for python use
`"command": "python", "args": ["eva_mcp.py"]`):

```json
{
  "mcpServers": {
    "eva": {
      "command": "npx",
      "args": ["tsx", "src/eva-mcp.ts"],
      "cwd": "/absolute/path/to/this/playground"
    }
  }
}
```

**Remote — Streamable HTTP** (works from any machine in the world):

```json
{
  "mcpServers": {
    "eva": {
      "type": "http",
      "url": "https://eva.yourdomain.com/mcp",
      "headers": { "Authorization": "Bearer <EVA_AUTH_TOKEN>" }
    }
  }
}
```

Claude Code one-liner:

```sh
claude mcp add --transport http eva https://eva.yourdomain.com/mcp \
  --header "Authorization: Bearer <EVA_AUTH_TOKEN>"
```

## Deploy worldwide

```sh
docker build -t eva-mcp .
docker run -d -p 8787:8787 \
  -e EVA_AUTH_TOKEN=<secret> -e ANTHROPIC_API_KEY=<key> \
  -v eva-memory:/data/eva-workspace eva-mcp
```

Put TLS in front (Fly/Railway/Render do this for you; on a VPS use Caddy:
`reverse_proxy localhost:8787`). Health probe: `GET /health` (no auth).
Memory lives in the `eva-memory` volume — she remembers across redeploys.

## Tools exposed

- `eva_chat(message, model?)` — talk to Eva, in character
- `eva_remember(note, tags?)` — write to the durable memory stream
- `eva_recall(query?, limit?)` — semantic/keyword search over memories
