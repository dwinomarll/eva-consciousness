"""Tests for the persistent memory store — offline BM25 + key-gated vectors."""
import memory as mem


def use_tmp_store(monkeypatch, tmp_path):
    d = tmp_path / "memory"
    d.mkdir()
    monkeypatch.setattr(mem, "MEMORY_DIR", d)
    monkeypatch.setattr(mem, "RECORDS_FILE", d / "memory.jsonl")
    monkeypatch.setattr(mem, "MEMORY_FILE", d / "MEMORY.md")


def test_tokenize_and_cosine():
    assert mem.tokenize("Deploy, the App!") == ["deploy", "the", "app"]
    assert abs(mem.cosine_sim([1, 2, 3], [2, 4, 6]) - 1.0) < 1e-9
    assert mem.cosine_sim([1, 0], [0, 1]) == 0.0


def test_bm25_ranks_query_term_highest():
    docs = ["we deploy via docker", "the cat slept all day", "deploy deploy deploy"]
    scores = mem.bm25_scores("deploy", docs)
    assert scores[2] > scores[0] > scores[1]
    assert scores[1] == 0


def test_embed_config_key_gated():
    assert mem.embed_config({}) is None
    assert mem.embed_config({"VOYAGE_API_KEY": "v"})["model"] == "voyage-3.5"
    assert "openai" in mem.embed_config({"OPENAI_API_KEY": "o"})["url"]


def test_remember_and_keyword_recall_offline(monkeypatch, tmp_path):
    use_tmp_store(monkeypatch, tmp_path)

    mem.remember("we will deploy via docker compose")
    mem.remember("the cat slept on the warm windowsill")
    mem.remember("notes about the deep blue ocean")

    res = mem.recall("deploy")
    assert res["mode"] == "keyword"
    assert "deploy" in res["records"][0]["text"]
    assert res["records"][0]["embedding"] is None

    recent = mem.recall()
    assert recent["mode"] == "recent"
    assert "ocean" in recent["records"][0]["text"]  # newest first


def test_vector_recall_when_key_present(monkeypatch, tmp_path):
    use_tmp_store(monkeypatch, tmp_path)
    dims = ["deploy", "cat", "ocean"]
    monkeypatch.setattr(mem, "embed", lambda text, cfg: [1 if d in text.lower() else 0 for d in dims])

    env = {"VOYAGE_API_KEY": "test"}
    rec = mem.remember("plan to deploy the new service", env=env)
    assert rec["embedding"] == [1, 0, 0]
    assert rec["model"] == "voyage-3.5"
    mem.remember("the cat watched the ocean", env=env)

    res = mem.recall("deploy", env=env)
    assert res["mode"] == "vector"
    assert "deploy" in res["records"][0]["text"]


def test_format_recall_has_header_and_lines(monkeypatch, tmp_path):
    use_tmp_store(monkeypatch, tmp_path)
    mem.remember("we will deploy via docker")
    text = mem.format_recall(mem.recall("deploy"), "deploy")
    assert 'memories for "deploy"' in text
    assert text.splitlines()[1].startswith("1. [")
