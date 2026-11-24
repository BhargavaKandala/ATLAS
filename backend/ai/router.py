import json
import logging
from datetime import datetime, timezone
from time import perf_counter

from fastapi import APIRouter, HTTPException, Request
from opentelemetry.trace import Context, StatusCode
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..storage import AgentRun, engine
from .contracts import AgentConfig, RunInput, RunResult, RunSummary
from .providers import Answer, ProviderError, configured_providers
from .telemetry import RunTrace, elapsed_ms
from .workflow import run_agent

router = APIRouter(prefix="/ai", tags=["AI Command"])
logger = logging.getLogger("uvicorn.error")
ERRORS = {
    "provider_unavailable": "The configured model did not respond. Check its service, credentials, and model name, then retry.",
    "empty_response": "The configured model returned an empty response.",
    "workflow_failed": "The workflow could not complete. Use the trace ID to identify the failed run.",
}


@router.get("/config", response_model=AgentConfig)
def ai_config():
    return AgentConfig(providers=[provider.public_config() for provider in configured_providers().values()])


@router.get("/runs", response_model=list[RunSummary])
def ai_runs():
    with Session(engine) as session:
        recent = session.scalars(select(AgentRun).order_by(AgentRun.started_at.desc(), AgentRun.trace_id.desc()).limit(12))
        return [RunSummary.model_validate(run) for run in recent]


@router.post("/runs", response_model=RunResult)
def run_ai(payload: RunInput, request: Request):
    provider = configured_providers()[payload.provider]
    if not provider.configured:
        raise HTTPException(400, "This provider is not configured.")
    if provider.cloud and (not payload.cloud_consent or payload.include_workspace):
        raise HTTPException(400, "Cloud runs require confirmation and accept only the prompt.")

    tracer = request.app.state.agent_tracer
    started = perf_counter()
    created = datetime.now(timezone.utc)
    answer: Answer | None = None
    error_code = None
    with tracer.start_as_current_span(
        "atlas.ai.run",
        context=Context(),
        attributes={"atlas.agent": payload.agent, "atlas.provider": provider.name},
        record_exception=False,
        set_status_on_exception=False,
    ) as span:
        telemetry = RunTrace(tracer, span)
        try:
            answer = run_agent(payload, provider, telemetry)
        except ProviderError as error:
            code = str(error)
            error_code = code if code in ERRORS else "provider_unavailable"
        except Exception:
            error_code = "workflow_failed"

        status = "failed" if error_code else "completed"
        span.set_status(StatusCode.ERROR if error_code else StatusCode.OK)
        if error_code:
            span.set_attribute("atlas.error_code", error_code)
        if answer and answer.input_tokens is not None:
            span.set_attribute("atlas.input_tokens", answer.input_tokens)
        if answer and answer.output_tokens is not None:
            span.set_attribute("atlas.output_tokens", answer.output_tokens)

        run = RunSummary(
            trace_id=telemetry.id,
            agent=payload.agent,
            provider=provider.name,
            model=provider.model,
            status=status,
            started_at=created,
            duration_ms=elapsed_ms(started),
            steps=telemetry.steps,
            error_code=error_code,
            input_tokens=answer.input_tokens if answer else None,
            output_tokens=answer.output_tokens if answer else None,
        )
        with Session(engine) as session, session.begin():
            session.add(AgentRun(**run.model_dump(mode="json")))

        logger.info("atlas.ai.run %s", json.dumps({
            "trace_id": run.trace_id, "agent": run.agent, "provider": run.provider,
            "status": run.status, "duration_ms": run.duration_ms, "error_code": run.error_code,
        }))
        return RunResult(run=run, output=answer.text if answer else None, detail=ERRORS.get(error_code) if error_code else None)
