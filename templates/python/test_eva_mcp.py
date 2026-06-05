"""Tests for the Python MCP tether — memory tools work without an API key."""
import eva_mcp


def test_remember_then_recall(monkeypatch, tmp_path):
    memory_file = tmp_path / "memory" / "MEMORY.md"
    monkeypatch.setattr(eva_mcp, "MEMORY_FILE", memory_file)

    assert eva_mcp.eva_recall() == "(memory stream is empty)"

    eva_mcp.eva_remember("first durable fact")
    eva_mcp.eva_remember("second durable fact")

    recalled = eva_mcp.eva_recall()
    assert "first durable fact" in recalled
    assert "second durable fact" in recalled


def test_first_text_skips_non_text_blocks():
    class Tool:
        type = "tool_use"

    class Text:
        type = "text"
        text = "remembered"

    class Resp:
        content = [Tool(), Text()]

    assert eva_mcp.first_text(Resp()) == "remembered"
