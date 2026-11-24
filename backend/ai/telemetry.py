import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from time import perf_counter

from opentelemetry.trace import Span, StatusCode, Tracer, format_trace_id, set_span_in_context
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import ALWAYS_ON

from .contracts import RunStep


def build_tracer_provider():
    provider = TracerProvider(
        resource=Resource({"service.name": "atlas-api"}),
        sampler=ALWAYS_ON,
        shutdown_on_exit=False,
    )
    if endpoint := os.getenv("ATLAS_OTLP_TRACES_ENDPOINT"):
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, timeout=5)))
    return provider


def elapsed_ms(start: float) -> int:
    return round((perf_counter() - start) * 1000)


@dataclass
class RunTrace:
    tracer: Tracer
    root: Span
    steps: list[RunStep] = field(default_factory=list)

    @property
    def id(self) -> str:
        return format_trace_id(self.root.get_span_context().trace_id)

    @contextmanager
    def step(self, name: str):
        started = perf_counter()
        with self.tracer.start_as_current_span(
            f"atlas.ai.{name}",
            context=set_span_in_context(self.root),
            record_exception=False,
            set_status_on_exception=False,
        ) as span:
            try:
                yield
            except Exception:
                span.set_status(StatusCode.ERROR)
                self.steps.append(RunStep(name=name, duration_ms=elapsed_ms(started), status="failed"))
                raise
            else:
                span.set_status(StatusCode.OK)
                self.steps.append(RunStep(name=name, duration_ms=elapsed_ms(started), status="completed"))
