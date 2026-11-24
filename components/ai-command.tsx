"use client";

import { BotMessageSquare, BrainCircuit, CircleAlert, CircleCheck, Clock3, Database, Globe2, ListChecks, Radio, Send, Server, Workflow } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { api, workspaceTimeZone } from "@/lib/workspace";

const agents = {
  jarvis: { name: "JARVIS", role: "Daily briefing", prompt: "Brief me on today’s priorities and upcoming commitments.", icon: BotMessageSquare },
  zeus: { name: "ZEUS", role: "Strategy and decisions", prompt: "Help me decide what deserves my attention this week.", icon: BrainCircuit },
  loki: { name: "LOKI", role: "Repeatable workflows", prompt: "Turn my next follow-up into a reusable checklist.", icon: Workflow },
  prometheus: { name: "PROMETHEUS", role: "Learning and recall", prompt: "Help me review my notes on product design and practice recall.", icon: ListChecks },
};
type Agent = keyof typeof agents;

const providers = { workspace: "Workspace mode", ollama: "Ollama", openai: "OpenAI", anthropic: "Anthropic" };
type Provider = keyof typeof providers;
type ProviderOption = { id: Provider; configured: boolean; model: string | null; cloud: boolean };
type RunStatus = "completed" | "failed";
type Run = {
  trace_id: string;
  agent: Agent;
  provider: Provider;
  model: string | null;
  status: RunStatus;
  started_at: string;
  duration_ms: number;
  steps: { name: string; status: RunStatus; duration_ms: number }[];
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};
type Result = { run: Run; output: string | null; detail: string | null };

const duration = (milliseconds: number) => milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
const runDate = new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: workspaceTimeZone });

function RunHistory({ runs }: { runs: Run[] }) {
  return <aside className="panel ai-history" aria-label="Run history">
    <div className="panel-heading">
      <div><h2>Run history</h2><p>Timings and outcomes for your last 12 runs</p></div>
      <span className="metric-icon mint"><Radio size={17} aria-hidden="true" /></span>
    </div>
    {!runs.length && <p className="empty-inline">Your first run will appear here.</p>}
    {runs.map((run) => <details className="ai-trace" key={run.trace_id}>
      <summary>
        {run.status === "completed" ? <CircleCheck className="positive" size={15} aria-label="Completed" /> : <CircleAlert className="ai-failed" size={15} aria-label="Failed" />}
        <span><strong>{agents[run.agent].name}</strong><small>{providers[run.provider]} · {runDate.format(new Date(run.started_at))}</small></span>
        <span className="ai-duration">{duration(run.duration_ms)}</span>
      </summary>
      <div className="ai-trace-details">
        {run.model && <p>Model <strong>{run.model}</strong></p>}
        {run.steps.map((step) => <p key={step.name}><span>{step.name === "prepare_context" ? "Prepare context" : agents[step.name as Agent]?.name ?? step.name}{step.status === "failed" && " · failed"}</span><strong>{duration(step.duration_ms)}</strong></p>)}
        {(run.input_tokens !== null || run.output_tokens !== null) && <p>Tokens in / out <strong>{run.input_tokens ?? "—"} / {run.output_tokens ?? "—"}</strong></p>}
        {run.error_code && <p>Outcome <strong>{run.error_code.replaceAll("_", " ")}</strong></p>}
        <div className="ai-trace-id"><span>Trace ID</span><code>{run.trace_id}</code></div>
      </div>
    </details>)}
  </aside>;
}

export function AiCommand() {
  const [agent, setAgent] = useState<Agent>("jarvis");
  const [provider, setProvider] = useState<Provider>("workspace");
  const [options, setOptions] = useState<ProviderOption[]>();
  const [prompt, setPrompt] = useState("");
  const [includeWorkspace, setIncludeWorkspace] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [result, setResult] = useState<Result>();
  const [loadError, setLoadError] = useState("");
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  const promptField = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoadError("");
    try {
      const [config, history] = await Promise.all([api<{ providers: ProviderOption[] }>("ai/config"), api<Run[]>("ai/runs")]);
      setOptions(config.providers);
      setRuns(history);
    } catch {
      setLoadError("Could not load AI Command. Try again.");
    }
  }

  useEffect(() => { void load(); }, []);
  const selected = options?.find((option) => option.id === provider);
  const cloud = selected?.cloud ?? false;
  const ModeIcon = cloud ? Globe2 : provider === "ollama" ? Server : Database;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || !selected?.configured || !prompt.trim() || (cloud && !cloudConsent)) return;

    setRunning(true);
    setRunError("");
    setResult(undefined);
    setCloudConsent(false);
    try {
      const response = await api<Result>("ai/runs", "POST", {
        agent, provider, prompt: prompt.trim(),
        include_workspace: provider === "ollama" && includeWorkspace,
        cloud_consent: cloud && cloudConsent,
      });
      setResult(response);
      setRuns((history) => [response.run, ...history].slice(0, 12));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The run could not start.");
    } finally {
      setRunning(false);
    }
  }

  return <div className="ai-command">
    <fieldset className="ai-agents" disabled={running}>
      <legend className="sr-only">Agent</legend>
      {Object.entries(agents).map(([key, details]) => {
        const Icon = details.icon;
        return <button type="button" key={key} className={`panel ai-agent ${agent === key ? "ai-agent-selected" : ""}`} aria-pressed={agent === key} onClick={() => setAgent(key as Agent)}>
          <span className="metric-icon"><Icon size={17} aria-hidden="true" /></span>
          <span><strong>{details.name}</strong><small>{details.role}</small></span>
        </button>;
      })}
    </fieldset>

    <div className="ai-grid">
      <section className="panel ai-workbench">
        <div className="panel-heading">
          <div><h2>New run</h2><p>{agents[agent].name} · {agents[agent].role}</p></div>
          <span className="ai-mode"><ModeIcon size={14} aria-hidden="true" />{cloud ? "Cloud provider" : provider === "ollama" ? "Ollama server" : "Local run"}</span>
        </div>
        <form className="ai-form" onSubmit={submit}>
          <label htmlFor="ai-provider">Provider</label>
          <select id="ai-provider" value={provider} disabled={running || !options} onChange={(event) => {
            setProvider(event.target.value as Provider);
            setIncludeWorkspace(false);
            setCloudConsent(false);
          }}>
            {(options ?? [{ id: "workspace" as const, configured: true, model: null }]).map((option) =>
              <option value={option.id} disabled={!option.configured} key={option.id}>{providers[option.id]}{option.model ? ` · ${option.model}` : option.configured ? "" : " · Setup required"}</option>
            )}
          </select>
          <p className="ai-note">
            {provider === "workspace" ? "Builds a structured brief from your workspace without a model or internet connection." :
              cloud ? `Only your prompt is sent to ${providers[provider]}.` : "Sends your prompt to your configured Ollama server."}
          </p>
          {provider === "ollama" && <label className="ai-checkbox">
            <input type="checkbox" checked={includeWorkspace} disabled={running} onChange={(event) => setIncludeWorkspace(event.target.checked)} />
            Include a workspace summary
          </label>}
          <div className="ai-prompt-label">
            <label htmlFor="ai-prompt">Prompt</label>
            <button type="button" className="text-button" disabled={running} onClick={() => {
              setPrompt(agents[agent].prompt);
              promptField.current?.focus();
            }}>Use example</button>
          </div>
          <textarea id="ai-prompt" ref={promptField} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={running} rows={4} maxLength={2000} required placeholder={agents[agent].prompt} />
          {cloud && <label className="ai-checkbox">
            <input type="checkbox" checked={cloudConsent} disabled={running} onChange={(event) => setCloudConsent(event.target.checked)} />
            Send this prompt to {providers[provider]}
          </label>}
          {loadError && <div className="ai-error" role="alert">{loadError} <button type="button" className="text-button" onClick={load}>Retry</button></div>}
          {runError && <p className="ai-error" role="alert">{runError}</p>}
          <div className="ai-submit">
            <span>{prompt.length.toLocaleString()} / 2,000</span>
            <button className="button button-primary" disabled={running || !selected?.configured || !prompt.trim() || (cloud && !cloudConsent)}>
              {running ? <Clock3 size={14} /> : <Send size={14} />}{running ? "Running…" : "Run agent"}
            </button>
          </div>
        </form>
        {running && <p className="ai-run-state" role="status">{agents[agent].name} is preparing a response.</p>}
        {result && <div className="ai-result" aria-live="polite">
          <h3>{result.run.status === "completed" ? `${agents[result.run.agent].name} response` : "Run failed"}</h3>
          <p className={result.detail ? "ai-error" : "ai-output"}>{result.detail ?? result.output}</p>
        </div>}
      </section>
      <RunHistory runs={runs} />
    </div>
  </div>;
}
