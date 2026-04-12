from fastapi import FastAPI
from pydantic import BaseModel
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Eva Consciousness Playground")

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


class ChatRequest(BaseModel):
    message: str
    model: str = "claude-sonnet-4-6"


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health():
    return {"status": "ok", "playground": "eva-consciousness"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    response = client.messages.create(
        model=req.model,
        max_tokens=1024,
        messages=[{"role": "user", "content": req.message}],
    )
    return ChatResponse(reply=response.content[0].text)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
