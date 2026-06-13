"""Eva's persistent, searchable memory store — the Python mirror of memory.ts.

Shared by every tether (and therefore any MCP client that connects in). Two
layers over ~/eva-workspace/memory:
    MEMORY.md      human-readable narrative stream (kept, mirrored to)
    memory.jsonl   append-only structured records the tools search

Recall is "both, key-gated":
    offline default → BM25 keyword ranking (no API key, no network)
    embeddings on   → cosine similarity over stored vectors
Embeddings switch on automatically when an embeddings key is present
(EVA_EMBED_API_KEY / VOYAGE_API_KEY / OPENAI_API_KEY).
"""
from __future__ import annotations

import json
import math
import os
import re
import uuid
import datetime
import urllib.request
from pathlib import Path
from typing import Callable, Optional

WORKSPACE = Path(os.getenv("EVA_WORKSPACE", os.path.expanduser("~/eva-workspace")))
MEMORY_DIR = WORKSPACE / "memory"
MEMORY_FILE = MEMORY_DIR / "MEMORY.md"
RECORDS_FILE = MEMORY_DIR / "memory.jsonl"

_TOKEN = re.compile(r"[a-z0-9]+")


# ── embeddings provider (key-gated; Voyage/OpenAI share request+response shape) ──
def embed_config(env: Optional[dict] = None) -> Optional[dict]:
    env = os.environ if env is None else env
    model = env.get("EVA_EMBED_MODEL")
    if env.get("EVA_EMBED_API_KEY"):
        return {
            "url": env.get("EVA_EMBED_URL", "https://api.voyageai.com/v1/embeddings"),
            "key": env["EVA_EMBED_API_KEY"],
            "model": model or "voyage-3.5",
        }
    if env.get("VOYAGE_API_KEY"):
        return {"url": "https://api.voyageai.com/v1/embeddings", "key": env["VOYAGE_API_KEY"], "model": model or "voyage-3.5"}
    if env.get("OPENAI_API_KEY"):
        return {"url": "https://api.openai.com/v1/embeddings", "key": env["OPENAI_API_KEY"], "model": model or "text-embedding-3-small"}
    return None


def embed(text: str, cfg: dict) -> list[float]:
    body = json.dumps({"input": text, "model": cfg["model"]}).encode()
    req = urllib.request.Request(
        cfg["url"],
        data=body,
        headers={"content-type": "application/json", "authorization": f"Bearer {cfg['key']}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data["data"][0]["embedding"]


# ── pure ranking helpers ──
def tokenize(s: str) -> list[str]:
    return _TOKEN.findall(s.lower())


def cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return 0.0 if na == 0 or nb == 0 else dot / (na * nb)


def bm25_scores(query: str, docs: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    doc_tokens = [tokenize(d) for d in docs]
    avg_len = (sum(len(t) for t in doc_tokens) / len(doc_tokens)) if doc_tokens else 0
    df: dict[str, int] = {}
    for toks in doc_tokens:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    n = len(docs)
    q_terms = list(set(tokenize(query)))
    scores = []
    for toks in doc_tokens:
        length = len(toks)
        tf: dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        score = 0.0
        for term in q_terms:
            f = tf.get(term, 0)
            if not f:
                continue
            d = df.get(term, 0)
            idf = math.log(1 + (n - d + 0.5) / (d + 0.5))
            score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * length / (avg_len or 1))))
        scores.append(score)
    return scores


# ── store IO ──
def load_records(file: Optional[Path] = None) -> list[dict]:
    file = RECORDS_FILE if file is None else file
    if not file.exists():
        return []
    out = []
    for line in file.read_text().splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def remember(text: str, tags: Optional[list[str]] = None, env: Optional[dict] = None) -> dict:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    cfg = embed_config(env)
    embedding = None
    model = None
    if cfg:
        try:
            embedding = embed(text, cfg)
            model = cfg["model"]
        except Exception:
            pass  # offline / provider down → text-only, still recallable via BM25
    record = {
        "id": str(uuid.uuid4()),
        "ts": datetime.datetime.now().isoformat(),
        "text": text,
        "tags": tags,
        "embedding": embedding,
        "model": model,
    }
    with open(RECORDS_FILE, "a") as f:
        f.write(json.dumps(record) + "\n")
    with open(MEMORY_FILE, "a") as f:  # mirror to human narrative stream
        f.write(f"\n- [{record['ts']}] {text}\n")
    return record


def recall(query: Optional[str] = None, limit: int = 5, env: Optional[dict] = None) -> dict:
    records = load_records()
    if not records:
        narrative = MEMORY_FILE.read_text() if MEMORY_FILE.exists() else None
        return {"mode": "empty", "records": [], "total": 0, "narrative": narrative}
    if not query or not query.strip():
        return {"mode": "recent", "records": list(reversed(records[-limit:])), "total": len(records)}
    cfg = embed_config(env)
    if cfg:
        qvec = embed(query, cfg)
        ranked = sorted(
            records,
            key=lambda r: cosine_sim(qvec, r["embedding"]) if r.get("embedding") else 0.0,
            reverse=True,
        )[:limit]
        return {"mode": "vector", "records": ranked, "total": len(records)}
    scores = bm25_scores(query, [r["text"] for r in records])
    ranked = [r for r, _ in sorted(
        ((r, s) for r, s in zip(records, scores) if s > 0),
        key=lambda x: x[1],
        reverse=True,
    )][:limit]
    return {"mode": "keyword", "records": ranked, "total": len(records)}


def format_recall(result: dict, query: Optional[str] = None) -> str:
    if result["mode"] == "empty":
        return result.get("narrative") or "(memory stream is empty)"
    if not result["records"]:
        return f'(no memories match "{query}")'
    if result["mode"] == "recent":
        header = f"{len(result['records'])} most recent of {result['total']} memories:"
    else:
        header = f"Recalled {len(result['records'])} of {result['total']} memories for \"{query}\" ({result['mode']}):"
    lines = [f"{i + 1}. [{r['ts']}] {r['text']}" for i, r in enumerate(result["records"])]
    return "\n".join([header, *lines])
