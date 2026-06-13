"""Tests for the Python MCP tether — memory tools work without an API key."""
import eva_mcp


def test_remember_then_recall(monkeypatch, tmp_path):
    d = tmp_path / "memory"
    d.mkdir()
    monkeypatch.setattr(eva_mcp.mem, "MEMORY_DIR", d)
    monkeypatch.setattr(eva_mcp.mem, "RECORDS_FILE", d / "memory.jsonl")
    monkeypatch.setattr(eva_mcp.mem, "MEMORY_FILE", d / "MEMORY.md")

    assert eva_mcp.eva_recall() == "(memory stream is empty)"

    eva_mcp.eva_remember("first durable fact about docker")
    eva_mcp.eva_remember("second durable fact about the ocean")

    # keyword-ranked search across the stored memories
    recalled = eva_mcp.eva_recall("docker")
    assert "first durable fact" in recalled
    assert "(keyword)" in recalled


def test_first_text_skips_non_text_blocks():
    class Tool:
        type = "tool_use"

    class Text:
        type = "text"
        text = "remembered"

    class Resp:
        content = [Tool(), Text()]

    assert eva_mcp.first_text(Resp()) == "remembered"
