"""Eva — tetherable MCP server (Python / stdio).

Exposes Eva over the Model Context Protocol so any MCP client can connect in
and operate her — the FastAPI scaffold's counterpart to node's eva-mcp.ts.

    uv run eva_mcp.py        # or: python eva_mcp.py

Tools: eva_chat, eva_remember, eva_recall.
Register with a client by pointing it at this command with cwd = playground.
"""
import os

import anthropic
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

import memory as mem

load_dotenv()

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
def eva_remember(note: str, tags: list[str] | None = None) -> str:
    """Save a durable memory to the shared store, searchable across every tether."""
    rec = mem.remember(note, tags=tags)
    how = f"embedded ({rec['model']})" if rec.get("embedding") else "text-only"
    return f"Remembered ({how}) → {mem.RECORDS_FILE}"


@mcp.tool()
def eva_recall(query: str | None = None, limit: int = 5) -> str:
    """Recall relevant memories: semantic (embeddings) or keyword (BM25) ranked
    search when given a query; the most recent memories when not."""
    return mem.format_recall(mem.recall(query, limit), query)


if __name__ == "__main__":
    mcp.run()
