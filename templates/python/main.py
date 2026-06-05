from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Eva Consciousness Playground")

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

# Tether guard: when EVA_AUTH_TOKEN is set, require a matching bearer token.
# This is what lets you safely expose /chat beyond localhost.
AUTH_TOKEN = os.getenv("EVA_AUTH_TOKEN", "")


def require_auth(authorization: str | None) -> None:
    if AUTH_TOKEN and authorization != f"Bearer {AUTH_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class ChatRequest(BaseModel):
    message: str
    model: str = "claude-sonnet-4-6"


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health():
    return {"status": "ok", "playground": "eva-consciousness"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    require_auth(authorization)
    response = client.messages.create(
        model=req.model,
        max_tokens=1024,
        messages=[{"role": "user", "content": req.message}],
    )
    return ChatResponse(reply=response.content[0].text)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
