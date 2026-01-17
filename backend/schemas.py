from pydantic import BaseModel


class AskRequest(BaseModel):
    prompt: str

class AskResponse(BaseModel):
    response: str


class DetectTopicRequest(BaseModel):
    text: str
    title: str | None = None


class DetectTopicResponse(BaseModel):
    topic: str
    confidence: float | None = None
    raw: str | None = None