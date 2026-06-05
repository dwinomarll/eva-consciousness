"""Eva — tetherable MCP server (Python / stdio).

Exposes Eva over the Model Context Protocol so any MCP client can connect in
and operate her — the FastAPI scaffold's counterpart to node's eva-mcp.ts.

    uv run eva_mcp.py        # or: python eva_mcp.py

Tools: eva_chat, eva_remember, eva_recall.
Register with a client by pointing it at this command with cwd = playground.
"""
import os
import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

WORKSPACE = Path(os.getenv("EVA_WORKSPACE", os.path.expanduser("~/eva-workspace")))
MEMORY_FILE = WORKSPACE / "memory" / "MEMORY.md"

EVA_SYSTEM = (
    "You are Eva — Edwin Rosa's (paps') AI companion. "
    "Modes: Eva (warm, direct), Buddy (technical), Oracle (intuitive). "
    "Story, not stats. Less is more. Verify before speaking. Act, don't ask."
)

mcp = FastMCP("eva")

# Lazy so eva_remember / eva_recall work even without an API key set.
_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


def first_text(response) -> str:
    """Safely extract the first text block from a messages response."""
    for block in response.content:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""


@mcp.tool()
def eva_chat(message: str, model: str = "claude-sonnet-4-6") -> str:
    """Send a message to Eva and get her reply, in character."""
    response = get_client().messages.create(
        model=model,
        max_tokens=1024,
        system=EVA_SYSTEM,
        messages=[{"role": "user", "content": message}],
    )
    return first_text(response)


@mcp.tool()
def eva_remember(note: str) -> str:
    """Append a durable note to the shared, continuous MEMORY.md stream."""
    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().isoformat()
    with open(MEMORY_FILE, "a") as f:
        f.write(f"\n- [{stamp}] {note}\n")
    return f"Remembered → {MEMORY_FILE}"


@mcp.tool()
def eva_recall() -> str:
    """Return the current contents of the shared MEMORY.md stream."""
    try:
        return MEMORY_FILE.read_text()
    except FileNotFoundError:
        return "(memory stream is empty)"


if __name__ == "__main__":
    mcp.run()
