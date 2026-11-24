import json
import os
import unittest
from contextlib import ExitStack
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.ai.telemetry import build_tracer_provider
from backend.main import app


class AiCommandTests(unittest.TestCase):
    def setUp(self):
        resources = self.enterContext(ExitStack())
        resources.enter_context(patch.dict(os.environ, {
            "ATLAS_DEMO_DATA": "0",
            "ATLAS_CURRENCY": "USD",
            "ATLAS_ENABLE_CLOUD_AI": "0",
            "ATLAS_OLLAMA_MODEL": "",
            "ATLAS_OTLP_TRACES_ENDPOINT": "",
        }))
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        for module in ("backend.main", "backend.ai.router", "backend.ai.workspace"):
            resources.enter_context(patch(f"{module}.engine", engine))
        self.exporter = InMemorySpanExporter()
        provider = build_tracer_provider()
        provider.add_span_processor(SimpleSpanProcessor(self.exporter))
        resources.enter_context(patch("backend.main.build_tracer_provider", return_value=provider))
        self.client = resources.enter_context(TestClient(app, base_url="http://localhost"))
        self.private_title = "Private project milestone"
        today = datetime.now(ZoneInfo(os.getenv("ATLAS_TIMEZONE", "Asia/Kolkata"))).date().isoformat()
        response = self.client.post("/records", json={
            "kind": "task", "title": self.private_title, "date": today, "priority": "High",
            "notes": "Internal project onboarding notes for the prototype.",
        })
        self.assertEqual(response.status_code, 201)

    def run_agent(self, agent="jarvis", **options):
        response = self.client.post("/ai/runs", json={
            "agent": agent, "prompt": "Review the prototype project.", **options,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_workspace_agents_route_and_use_saved_records(self):
        for agent, expected in (
            ("jarvis", self.private_title),
            ("zeus", "Due priorities: 1."),
            ("loki", f"Checklist for {self.private_title}"),
            ("prometheus", "Internal project onboarding notes"),
        ):
            with self.subTest(agent=agent):
                result = self.run_agent(agent)
                self.assertIn(expected, result["output"])
                self.assertEqual(result["run"]["provider"], "workspace")
                self.assertEqual([step["name"] for step in result["run"]["steps"]], ["prepare_context", agent])
        self.assertEqual(len(self.client.get("/ai/runs").json()), 4)

    def test_cloud_requires_consent_and_cannot_receive_workspace_records(self):
        with patch.dict(os.environ, {"ATLAS_OPENAI_MODEL": "test-model", "OPENAI_API_KEY": "test-key"}):
            providers = {item["id"]: item for item in self.client.get("/ai/config").json()["providers"]}
            self.assertFalse(providers["openai"]["configured"])
            with patch.dict(os.environ, {"ATLAS_ENABLE_CLOUD_AI": "1"}):
                with patch("backend.ai.providers.chat_model") as factory:
                    base = {"agent": "jarvis", "provider": "openai", "prompt": "My explicit question"}
                    self.assertEqual(self.client.post("/ai/runs", json=base).status_code, 400)
                    self.assertEqual(self.client.post("/ai/runs", json={
                        **base, "cloud_consent": True, "include_workspace": True,
                    }).status_code, 400)
                    factory.assert_not_called()

                    factory.return_value.invoke.return_value = AIMessage(content="A cloud response", usage_metadata={
                        "input_tokens": 13, "output_tokens": 4, "total_tokens": 17,
                    })
                    result = self.run_agent(provider="openai", prompt=base["prompt"], cloud_consent=True)
                    messages = factory.return_value.invoke.call_args.args[0]
                    self.assertEqual(messages[-1].content, base["prompt"])
                    self.assertNotIn(self.private_title, repr(messages))
                    self.assertEqual(result["run"]["output_tokens"], 4)

    def test_ollama_context_requires_selection(self):
        with patch.dict(os.environ, {"ATLAS_OLLAMA_MODEL": "test-local-model"}):
            with patch("backend.ai.providers.chat_model") as factory:
                factory.return_value.invoke.return_value = AIMessage(content="A local response")
                self.run_agent(provider="ollama")
                messages = factory.return_value.invoke.call_args.args[0]
                self.assertNotIn(self.private_title, messages[-1].content)
                self.run_agent(provider="ollama", include_workspace=True)
                messages = factory.return_value.invoke.call_args.args[0]
                self.assertIn(self.private_title, messages[-1].content)

    def test_trace_links_steps_and_excludes_sensitive_run_content(self):
        prompt = "Sensitive prompt marker"
        error = "Private provider exception and secret key"
        response = "Sensitive response marker"
        with patch.dict(os.environ, {"ATLAS_OLLAMA_MODEL": "test-local-model"}):
            with patch("backend.ai.providers.chat_model") as factory:
                factory.return_value.invoke.side_effect = [RuntimeError(error), AIMessage(content=response)]
                with self.assertLogs("uvicorn.error", level="INFO") as logs:
                    failed = self.run_agent(provider="ollama", prompt=prompt, include_workspace=True)
                    completed = self.run_agent(provider="ollama", prompt=prompt)
        self.assertEqual(failed["run"]["error_code"], "provider_unavailable")
        self.assertEqual(failed["run"]["steps"][-1]["status"], "failed")
        self.assertEqual(completed["output"], response)
        traces = self.exporter.get_finished_spans()
        history = self.client.get("/ai/runs").text
        telemetry = "\n".join([history, json.dumps(logs.output), *(span.to_json() for span in traces)])
        for text in (prompt, error, response, self.private_title):
            self.assertNotIn(text, telemetry)
        trace_id = int(failed["run"]["trace_id"], 16)
        failed_spans = [span for span in traces if span.context.trace_id == trace_id]
        self.assertEqual(len(failed_spans), 3)
        parent = next(span for span in failed_spans if span.name == "atlas.ai.run")
        self.assertTrue(all(span.parent.span_id == parent.context.span_id for span in failed_spans if span.parent))


if __name__ == "__main__":
    unittest.main()
