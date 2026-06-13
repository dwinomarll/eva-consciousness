"""Eva — tetherable MCP server (Python / stdio + Streamable HTTP).

Exposes Eva over the Model Context Protocol so any MCP client can connect in
and operate her — the FastAPI scaffold's counterpart to node's eva-mcp.ts.

    python eva_mcp.py            # stdio — local clients (cwd = playground)
    python eva_mcp.py --http     # Streamable HTTP at /mcp — remote clients

Reach levels for --http (mirrors the node tether):
    local      EVA_MCP_HOST=127.0.0.1 (default) — same machine only
    LAN/world  EVA_MCP_HOST=0.0.0.0 + EVA_AUTH_TOKEN — bearer-guarded

Safety interlock: binding beyond loopback WITHOUT a token refuses to start
unless EVA_ALLOW_OPEN=1 is set explicitly.

Tools: eva_chat, eva_remember, eva_recall.
"""
import json
import os
import secrets
import sys

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


def bearer_guard(app, token: str):
    """Pure-ASGI wrapper: /health stays open for probes, everything else
    requires `Authorization: Bearer <token>` (constant-time compare)."""

    async def guarded(scope, receive, send):
        if scope["type"] != "http":
            return await app(scope, receive, send)
        if scope["path"] == "/health":
            body = json.dumps(
                {"status": "ok", "service": "eva-mcp", "transport": "streamable-http"}
            ).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            return await send({"type": "http.response.body", "body": body})
        auth = dict(scope.get("headers") or []).get(b"authorization", b"").decode()
        if token and not secrets.compare_digest(auth, f"Bearer {token}"):
            await send(
                {
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            return await send(
                {
                    "type": "http.response.body",
                    "body": b'{"jsonrpc":"2.0","error":{"code":-32001,"message":"unauthorized"},"id":null}',
                }
            )
        return await app(scope, receive, send)

    return guarded


def run_http() -> None:
    import uvicorn

    host = os.getenv("EVA_MCP_HOST", "127.0.0.1")
    port = int(os.getenv("EVA_MCP_PORT") or os.getenv("PORT") or 8788)
    token = os.getenv("EVA_AUTH_TOKEN", "")

    loopback = host in {"127.0.0.1", "localhost", "::1"}
    if not loopback and not token and os.getenv("EVA_ALLOW_OPEN") != "1":
        sys.exit(
            f"Refusing to bind {host} without EVA_AUTH_TOKEN — that would expose "
            "Eva unauthenticated. Set EVA_AUTH_TOKEN or EVA_ALLOW_OPEN=1 to override."
        )

    reach = "local only" if loopback else ("worldwide, bearer-guarded" if token else "OPEN (override)")
    print(f"Eva remote MCP tether on http://{host}:{port}/mcp — {reach}", file=sys.stderr)
    uvicorn.run(bearer_guard(mcp.streamable_http_app(), token), host=host, port=port)


if __name__ == "__main__":
    if "--http" in sys.argv:
        run_http()
    else:
        mcp.run()
