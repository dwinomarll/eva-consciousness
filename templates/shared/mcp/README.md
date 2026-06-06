# MCP Server Configs

Each file defines one MCP server in two formats:
- `opencode` key → written to `opencode.json` (opencode format)
- `claude` key → written to `.mcp.json` (Claude Code format)

The spawn CLI reads these at spawn time and writes both config files
with only the servers you selected.

## Available Servers

| Server | File | Requires |
|---|---|---|
| Filesystem | filesystem.json | Nothing — reads/writes `.` |
| Ma'at | maat.json | Nothing; optional `MAAT_WORKSPACE` + `MAAT_REPO_PATH` |
| Notion | notion.json | `NOTION_TOKEN` in .env |
| Omi | omi.json | `OMI_API_KEY` in .env + Docker |
