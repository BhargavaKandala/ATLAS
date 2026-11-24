from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

Agent = Literal["jarvis", "zeus", "loki", "prometheus"]
Provider = Literal["workspace", "ollama", "openai", "anthropic"]
RunStatus = Literal["completed", "failed"]

AGENT_INSTRUCTIONS: dict[Agent, str] = {
    "jarvis": "Act as a personal assistant. Summarize priorities and upcoming commitments, then propose a short sequence for the day.",
    "zeus": "Act as a strategy adviser. Compare realistic options, explain trade-offs, and identify the most important decision. Separate facts from assumptions.",
    "loki": "Turn repetitive work into a reusable manual checklist. Identify prerequisites, an explicit review step, and a clear definition of done.",
    "prometheus": "Act as a learning coach. Organize available notes into themes, explain the topic, and end with a small exercise and a way to test recall.",
}


class RunInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent: Agent
    provider: Provider = "workspace"
    prompt: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    include_workspace: bool = False
    cloud_consent: bool = False


class ProviderOption(BaseModel):
    id: Provider
    configured: bool
    model: str | None
    cloud: bool


class AgentConfig(BaseModel):
    providers: list[ProviderOption]


class RunStep(BaseModel):
    name: str
    duration_ms: int
    status: RunStatus


class RunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trace_id: str
    agent: Agent
    provider: Provider
    model: str | None
    status: RunStatus
    started_at: datetime
    duration_ms: int
    steps: list[RunStep]
    error_code: str | None
    input_tokens: int | None
    output_tokens: int | None


class RunResult(BaseModel):
    run: RunSummary
    output: str | None = None
    detail: str | None = None
