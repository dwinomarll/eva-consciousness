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
`templates/node/src/eva-mcp.ts` flips the direction: it exposes Eva **as** an MCP
server over stdio, so any MCP client can connect in and operate her.

- `eva_chat` — talk to Eva, in character
- `eva_remember` — append a durable note to the stream
- `eva_recall` — read the stream

Register with any client:
```json
{ "command": "npm", "args": ["run", "mcp"], "cwd": "/path/to/playground" }
```

For HTTP/remote operation, the `/chat` endpoint is bearer-guarded: set
`EVA_AUTH_TOKEN` and callers must send `Authorization: Bearer <token>`.

## Roadmap
- **Remote transport** — wrap the stdio tether in SSE/HTTP so it's reachable off
  the host (today's remote path is the bearer-guarded `/chat`).
- **More tools** — Gmail, Calendar, Slack, Drive each need their own MCP server +
  OAuth; add them as `mcp/<name>.json` once the exact server + credentials are
  pinned (kept out until verified — Eva doesn't ship commands that don't run).
- **Python tether parity** — an `eva-mcp` server for the FastAPI scaffold.
