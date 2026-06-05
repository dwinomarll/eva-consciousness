"""Tests for the FastAPI starter — no real Anthropic calls."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_ok_without_api_key():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_chat_rejects_missing_bearer_token(monkeypatch):
    monkeypatch.setattr(main, "AUTH_TOKEN", "secret")
    r = client.post("/chat", json={"message": "hi"})
    assert r.status_code == 401


def test_chat_returns_reply(monkeypatch):
    monkeypatch.setattr(main, "AUTH_TOKEN", "")

    class Block:
        type = "text"
        text = "hello from eva"

    class Resp:
        content = [Block()]

    class FakeClient:
        class messages:
            @staticmethod
            def create(**_kw):
                return Resp()

    monkeypatch.setattr(main, "get_client", lambda: FakeClient())
    r = client.post("/chat", json={"message": "hi"})
    assert r.status_code == 200
    assert r.json()["reply"] == "hello from eva"


def test_first_text_skips_non_text_blocks():
    class Tool:
        type = "tool_use"

    class Text:
        type = "text"
        text = "found it"

    class Resp:
        content = [Tool(), Text()]

    assert main.first_text(Resp()) == "found it"
