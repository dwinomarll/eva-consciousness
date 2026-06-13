# Eva — Environment Design for an Everywhere-Tethered MCP

*How one Eva, one codebase, and one memory stream run at three reach levels —
local, LAN, and worldwide — selected purely by environment variables.*

## 1. The situation

Eva is exposed **as** an MCP server (tools: `eva_chat`, `eva_remember`,
`eva_recall`). Two consumers must coexist:

1. **Ma'at** — Edwin's app, tethering to Eva as an active MCP (often same
   machine, sometimes remote).
2. **The world** — any MCP-speaking client anywhere: Claude Desktop, Claude
   Code, opencode, phone bridges, other agents.

The design constraint: *never fork the code per environment.* One server,
whose **reach** and **safety posture** are chosen by env vars at start time.

## 2. Reach levels (env-selected, same code)

| Level | Bind | Auth | Transport | Use |
|-------|------|------|-----------|-----|
| L0 Local | `EVA_MCP_HOST=127.0.0.1` (default) | none needed | stdio or HTTP | Ma'at on the same machine |
| L1 LAN | `EVA_MCP_HOST=0.0.0.0` | `EVA_AUTH_TOKEN` required | Streamable HTTP | home network, phone on Wi-Fi |
| L2 Worldwide | container/PaaS, TLS in front | bearer + HTTPS | Streamable HTTP | Ma'at remote + any client on Earth |

**Safety interlock:** the tether *refuses to start* when binding beyond
loopback without `EVA_AUTH_TOKEN`, unless `EVA_ALLOW_OPEN=1` is set
explicitly. Misconfiguration fails closed, never open.

## 3. Variable inventory

| Variable | Default | Role |
|----------|---------|------|
| `EVA_MCP_HOST` | `127.0.0.1` | reach selector (loopback vs world) |
| `EVA_MCP_PORT` | `8787` node / `8788` py | tether port; overrides `PORT` |
| `PORT` | — | injected by PaaS (Railway/Render/Fly); honored as fallback |
| `EVA_AUTH_TOKEN` | unset | bearer token; gates every endpoint except `/health` |
| `EVA_ALLOW_OPEN` | unset | explicit opt-in to run open beyond loopback |
| `EVA_CORS_ORIGIN` | `*` | lock browser clients to one origin in prod |
| `EVA_WORKSPACE` | `~/eva-workspace` | memory root; point at a volume in containers |
| `ANTHROPIC_API_KEY` | unset | needed only for `eva_chat`; memory tools work without it |
| `VOYAGE/OPENAI/EVA_EMBED_*` | unset | optional semantic-recall upgrade |

## 4. Layering and precedence

```
.env.example  →  .env (auto-seeded at spawn)  →  process env  →  platform secrets
   (docs)          (local dev, gitignored)       (CI, shells)     (Fly/Railway vaults)
```

- `.env.example` is the *documentation* layer — every variable, commented.
- `.env` is seeded automatically on spawn and gitignored; local truth.
- Real deployments never ship `.env`: secrets live in the platform's secret
  store and arrive as process env (`fly secrets set EVA_AUTH_TOKEN=…`).
- Code reads env once at boot; restart to re-tether at a different level.

## 5. Security ladder

1. **Fail-closed interlock** (implemented) — no accidental naked binds.
2. **Bearer token, constant-time compared** (implemented) — node uses
   `crypto.timingSafeEqual`, python uses `secrets.compare_digest`.
3. **TLS** — terminate at the platform (Fly/Railway/Render) or Caddy on a VPS.
4. **CORS pinning** (implemented) — `EVA_CORS_ORIGIN=https://maat.…` in prod.
5. **Next rungs (roadmap):** per-client tokens, OAuth 2.1 resource-server mode
   (the MCP spec's auth direction), rate limiting, audit log of tool calls.

## 6. Deployment recipes

**Docker (any host):**

```sh
docker build -t eva-mcp .
docker run -d -p 8787:8787 \
  -e EVA_AUTH_TOKEN=$(openssl rand -hex 32) \
  -e ANTHROPIC_API_KEY=sk-ant-… \
  -v eva-memory:/data/eva-workspace eva-mcp
```

The image binds `0.0.0.0` *inside* the container (required), keeps the
interlock active, persists memory in the `eva-memory` volume, and exposes
`GET /health` for orchestrator probes.

**PaaS:** push the playground repo; the tether honors injected `PORT`; set
`EVA_AUTH_TOKEN` + `ANTHROPIC_API_KEY` as secrets; attach a volume at
`/data/eva-workspace`. TLS and a public URL come free.

**VPS:** `docker run` + Caddyfile `eva.yourdomain.com { reverse_proxy
localhost:8787 }` — automatic HTTPS.

## 7. Wiring Ma'at (active MCP)

Same machine — stdio, zero network surface:

```json
{ "mcpServers": { "eva": {
    "command": "npx", "args": ["tsx", "src/eva-mcp.ts"],
    "cwd": "/path/to/playground" } } }
```

Anywhere — Streamable HTTP:

```json
{ "mcpServers": { "eva": {
    "type": "http", "url": "https://eva.yourdomain.com/mcp",
    "headers": { "Authorization": "Bearer <EVA_AUTH_TOKEN>" } } } }
```

Both forms surface the same three tools natively inside Ma'at, and both hit
the **same memory stream**, so Eva is one continuous self across consumers.

## 8. Why this interoperates worldwide

- **Streamable HTTP is the MCP standard remote transport** — any compliant
  client (Claude Desktop/Code, inspector, SDK-built apps) connects with a URL
  + header. No Eva-specific client code.
- **Stateless server design** — a fresh MCP server per request means no
  session affinity: it scales horizontally, restarts cost nothing.
- **Durable memory is externalized** to `EVA_WORKSPACE` (volume), so identity
  and recall survive redeploys and follow her between hosts.
- Python and node tethers expose identical tools and identical env contracts —
  the runtime is an implementation detail, the protocol surface is one.

## 9. Roadmap ideas

- OAuth 2.1 resource-server mode for first-class claude.ai connector support
- Per-consumer tokens (`maat:`, `phone:` prefixes) + revocation list
- Tool-call audit journal appended to the memory workspace
- Rate limiting (token bucket per bearer)
- mDNS announcement on LAN (`_mcp._tcp`) for zero-config discovery
- Multi-region: read-replica memory via object-storage sync
