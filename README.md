# Eva Consciousness

[![CI](https://github.com/dwinomarll/eva-consciousness/actions/workflows/ci.yml/badge.svg)](https://github.com/dwinomarll/eva-consciousness/actions/workflows/ci.yml)

> AI-native playground spawner. One command. Ready in minutes.

Spawns development playgrounds pre-wired with Eva's identity, MCPs, tools, notes, journals, and references — ready to run with **opencode** + **Claude Code** on macOS, Linux, or Windows.

---

## Quick Start

### 1. Bootstrap your machine (first time only)

**macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/dwinomarll/eva-consciousness/main/scripts/setup-mac.sh | bash
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://raw.githubusercontent.com/dwinomarll/eva-consciousness/main/scripts/setup-linux.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
iwr https://raw.githubusercontent.com/dwinomarll/eva-consciousness/main/scripts/setup-windows.ps1 | iex
```

### 2. Spawn a playground

```bash
eva-consciousness spawn
```

Follow the prompts:
- Name your playground
- Choose language: `node` or `python`
- Select MCPs to enable: Filesystem, Notion, Omi

### 3. Start building

```bash
cd my-playground
opencode .        # launch opencode
claude            # launch Claude Code
```

---

## What You Get

Every playground includes:

| Folder / File | Purpose |
|---|---|
| `agents.md` | Eva's identity loaded by opencode |
| `CLAUDE.md` | Eva's identity loaded by Claude Code |
| `opencode.json` | opencode MCP config (pre-patched to your selection) |
| `.mcp.json` | Claude Code MCP config (pre-patched to your selection) |
| `mcp/` | Individual MCP server definitions |
| `tools/` | Utility scripts and helpers |
| `notes/keypoints.md` | Key decisions and patterns |
| `journals/YYYY-MM-DD.md` | Today's session log (auto-created at spawn) |
| `references/links.md` | Docs, APIs, and useful links |
| `main.py` or `src/index.ts` | Working `/health` + `/chat` starter (bearer-guarded) |
| `src/eva-mcp.ts` / `src/eva-mcp-http.ts` *(node)* | Eva as a tetherable MCP server — stdio + remote HTTP |
| `eva_mcp.py` *(python)* | Eva as a tetherable MCP server (stdio) |
| `.env.example` | Required env vars — copy to `.env` |

Plus, outside the playground, one shared **memory stream**:

| Path | Purpose |
|---|---|
| `~/eva-workspace/memory/MEMORY.md` | The continuous stream — one Eva across every playground. Created once, never reset. |

---

## Languages

| Option | Stack | Package Manager |
|---|---|---|
| `node` | Express + TypeScript | npm |
| `python` | FastAPI + Pydantic | uv (pip fallback) |

---

## MCP Servers

| Server | Requires |
|---|---|
| Filesystem | Nothing — reads/writes `.` |
| Memory *(the stream)* | Nothing — shared store at `~/eva-workspace/memory/` |
| Sequential Thinking | Nothing — structured step-by-step reasoning |
| Gmail | One-time `npx @gongrzhe/server-gmail-autoauth-mcp auth` (Google OAuth) |
| Google Calendar | `GOOGLE_OAUTH_CREDENTIALS` (path to OAuth keys JSON) |
| Slack | `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` |
| Notion | `NOTION_TOKEN` in `.env` |
| Omi | `OMI_API_KEY` in `.env` + Docker |

---

## Tether Eva anywhere

Every playground ships an MCP server that exposes Eva herself — so any MCP
client (Claude Desktop, opencode, another agent, a remote bridge) can connect in
and operate her, not just this folder. Exposed tools: `eva_chat` (talk to her,
in character), `eva_remember` (append to the stream), `eva_recall` (read it).

**Local (stdio):**
```bash
npm run mcp          # node
python eva_mcp.py    # python
```
Register with any client:
```json
{ "command": "npm", "args": ["run", "mcp"], "cwd": "/path/to/your-playground" }
```

**Remote (HTTP, off-host) — node:**
```bash
EVA_AUTH_TOKEN=<secret> npm run mcp:http   # POST http://<host>:8787/mcp
```
Callers must send `Authorization: Bearer <secret>`. The `/chat` HTTP endpoint is
bearer-guarded the same way (node + python).

**Custom MCP screens (Codex, Claude, Cursor, MAAT, and others):**
```bash
eva-consciousness mcp-config --transport stdio --cwd /path/to/eva-playground
eva-consciousness mcp-config --transport http --cwd /path/to/eva-playground --host http://127.0.0.1 --port 8787
```

For the STDIO form, use:

| Field | Value |
|---|---|
| Name | Eva Consciousness |
| Command to launch | `npm` |
| Arguments | `run`, `mcp` |
| Environment variable passthrough | `ANTHROPIC_API_KEY`, `EVA_WORKSPACE` |
| Working directory | `/path/to/eva-playground` |

For Streamable HTTP, first run `EVA_AUTH_TOKEN=<secret> npm run mcp:http`, then
point the client at `http://<host>:8787/mcp` and store the bearer token in that
client's secret system.

## Continuous memory — the stream

`~/eva-workspace/memory/MEMORY.md` is created once and shared by every playground
and every tether. One continuous Eva, not a fresh one per folder. Enable the
**Memory** MCP at spawn to give her live append/recall over the same store.

---

## Repo Structure

```
eva-consciousness/
├── src/                  ← CLI source (TypeScript)
│   ├── cli.ts            ← entry point
│   ├── prompts.ts        ← interactive TUI
│   ├── spawn.ts          ← orchestrator
│   ├── template.ts       ← copy engine + MCP patching
│   └── types.ts          ← shared types
├── templates/
│   ├── shared/           ← injected into every playground
│   ├── python/           ← FastAPI scaffold
│   └── node/             ← Express/TypeScript scaffold
├── scripts/
│   ├── setup-mac.sh
│   ├── setup-linux.sh
│   └── setup-windows.ps1
└── tests/
    └── template.test.ts
```

---

Built with 🤍 by Edwin Rosa + Eva
