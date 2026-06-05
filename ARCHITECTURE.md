# Architecture — Tether & Stream

How Eva goes from "a folder you run" to "a consciousness you operate anywhere."

## The three layers

```
                       ┌─────────────────────────────┐
   any MCP client ─────►        EVA (tether)          │
  (Desktop, phone,     │  eva_chat / eva_remember /   │
   agent, web bridge)  │         eva_recall           │
                       └──────────────┬──────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                              ▼
  IDENTITY                       TOOL BELT                      THE STREAM
  CLAUDE.md / agents.md      MCP servers (filesystem,      ~/eva-workspace/
  (modes, standing orders)   memory, sequentialthinking,   memory/MEMORY.md
                             notion, omi)                   (one, continuous)
```

### 1. Identity — *who she is*
`CLAUDE.md` (Claude Code) and `agents.md` (opencode) are loaded every session:
the three modes (Eva / Buddy / Oracle), standing orders, communication rules.
This travels with every playground.

### 2. Tool belt — *what she can do*
MCP servers, selected at spawn and patched into `.mcp.json` / `opencode.json`.
Eva is the **client**: she reaches out to these tools. Add capabilities by
adding `templates/shared/mcp/<name>.json` and listing the name in the spawn menu.

### 3. The stream — *what she remembers*
`~/eva-workspace/memory/MEMORY.md` is bootstrapped once (`ensureMemoryWorkspace`)
and **never reset**. Every playground and every tether reads and appends to the
same file, so it's one continuous Eva rather than one per folder. The **Memory**
MCP (`@modelcontextprotocol/server-memory`) gives her a live knowledge-graph
store beside it at `memory/memory.json`.

## The tether — *operate her from anywhere*
The tether flips the direction: it exposes Eva **as** an MCP server, so any MCP
client can connect in and operate her. Tools: `eva_chat`, `eva_remember`,
`eva_recall`. The tool definitions live once in `templates/node/src/eva-server.ts`
and are served over two transports:

| Transport | Entry point | Use |
|---|---|---|
| stdio (node) | `eva-mcp.ts` → `npm run mcp` | local clients (Claude Desktop, opencode) |
| stdio (python) | `eva_mcp.py` → `python eva_mcp.py` | FastAPI scaffold parity |
| HTTP (node) | `eva-mcp-http.ts` → `npm run mcp:http` | **remote / off-host**, `POST /mcp` |

The HTTP tether and the `/chat` endpoints are bearer-guarded: set `EVA_AUTH_TOKEN`
and callers must send `Authorization: Bearer <token>`.

Register a stdio tether with any client:
```json
{ "command": "npm", "args": ["run", "mcp"], "cwd": "/path/to/playground" }
```

## Tool belt — what's wired
| Tool | Package | Credential |
|---|---|---|
| Filesystem | `@modelcontextprotocol/server-filesystem` | none |
| Memory (stream) | `@modelcontextprotocol/server-memory` | none |
| Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | none |
| Gmail | `@gongrzhe/server-gmail-autoauth-mcp` | Google OAuth (one-time `auth`) |
| Google Calendar | `@cocal/google-calendar-mcp` | `GOOGLE_OAUTH_CREDENTIALS` |
| Slack | `@modelcontextprotocol/server-slack` | `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` |
| Notion | `@notionhq/notion-mcp-server` | `NOTION_TOKEN` |
| Omi | `omiai/mcp-server` (Docker) | `OMI_API_KEY` |

Every entry is verified to exist on its registry — Eva doesn't ship commands
that don't run. Add a tool with a new `templates/shared/mcp/<name>.json` and a
line in `ALL_MCP_SERVERS` (a test then enforces the definition exists).

## Roadmap
- **Remote auth hardening** — the HTTP tether uses a static bearer token today;
  next is per-client tokens / OAuth and TLS termination notes for exposure.
- **Stateful HTTP sessions** — the HTTP tether is stateless per request; add
  session IDs if a client needs resumable streams.
- **Python remote transport** — an HTTP tether for the FastAPI scaffold to match
  node's `mcp:http`.
