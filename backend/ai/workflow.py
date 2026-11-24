from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langsmith import tracing_context

from .contracts import AGENT_INSTRUCTIONS, Agent, RunInput
from .providers import Answer, ProviderSettings, model_answer
from .telemetry import RunTrace
from .workspace import read_workspace


class AgentState(TypedDict, total=False):
    request: RunInput
    workspace: str | None
    answer: Answer


class WorkflowContext(TypedDict):
    provider: ProviderSettings
    telemetry: RunTrace


def prepare_context(state: AgentState, runtime: Runtime[WorkflowContext]) -> dict:
    request = state["request"]
    with runtime.context["telemetry"].step("prepare_context"):
        if request.provider == "workspace" or request.include_workspace:
            return {"workspace": read_workspace(request.agent, request.prompt)}
    return {"workspace": None}


def route_agent(state: AgentState) -> Agent:
    return state["request"].agent


def agent_node(agent: Agent):
    def run(state: AgentState, runtime: Runtime[WorkflowContext]) -> dict:
        settings = runtime.context["provider"]
        request = state["request"]
        with runtime.context["telemetry"].step(agent):
            if settings.name == "workspace":
                return {"answer": Answer(state["workspace"] or "")}
            return {"answer": model_answer(settings, agent, request.prompt, state["workspace"])}
    return run


graph = StateGraph(AgentState, context_schema=WorkflowContext)
graph.add_node("prepare_context", prepare_context)
graph.add_edge(START, "prepare_context")
for agent in AGENT_INSTRUCTIONS:
    graph.add_node(agent, agent_node(agent))
    graph.add_edge(agent, END)
graph.add_conditional_edges("prepare_context", route_agent, {agent: agent for agent in AGENT_INSTRUCTIONS})
workflow = graph.compile()


def run_agent(request: RunInput, provider: ProviderSettings, telemetry: RunTrace) -> Answer:
    with tracing_context(enabled=False):
        return workflow.invoke(
            {"request": request},
            context={"provider": provider, "telemetry": telemetry},
        )["answer"]
