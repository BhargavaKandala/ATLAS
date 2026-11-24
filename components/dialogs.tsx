"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Search, Trash2, X } from "lucide-react";
import {
  dateLabel, dealStatuses, jobStatuses, kinds, ofKind, recordText, safeLink, transactionStatuses,
  type Deal, type Job, type Kind, type Payload, type Task, type Transaction, type Workspace, type WorkspaceRecord,
} from "@/lib/workspace";

export function Modal({ title, children, close, className = "" }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-label={title} className={`modal ${className}`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button></div>
    {children}
  </dialog>;
}

function Options({ name, value, choices, label, change }: { name: string; value?: string; choices: readonly string[]; label: string; change?: (value: string) => void }) {
  return <label>{label}<select name={name} defaultValue={value} onChange={change ? (event) => change(event.target.value) : undefined}>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>;
}

export function EditRecord({ kind, record, today, workspace, close, save, remove }: {
  kind: Kind; record?: WorkspaceRecord; today: string; workspace: Workspace; close: () => void;
  save: (payload: Payload, id?: string) => Promise<void>; remove: (record: WorkspaceRecord) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const task = record?.kind === "task" ? record : undefined;
  const job = record?.kind === "job" ? record : undefined;
  const resume = record?.kind === "resume" ? record : undefined;
  const deal = record?.kind === "deal" ? record : undefined;
  const transaction = record?.kind === "transaction" ? record : undefined;
  const [transactionType, setTransactionType] = useState(transaction?.status ?? "Expense");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    const title = value("title");
    if (!title) { setError("Enter a title."); return; }
    const date = value("date") || null;
    const common = { title, date, notes: value("notes") };
    const amount = Math.round(Number(value("amount")) * 100);
    let payload: Payload;

    switch (kind) {
      case "task":
        payload = { ...common, kind, date: date!, status: value("status") as Task["status"], priority: value("priority") as Task["priority"], area: value("area") as Task["area"] };
        break;
      case "job":
        payload = { ...common, kind, company: value("company"), status: value("status") as Job["status"], interview_date: value("interview_date") || null, resume_id: value("resume_id") };
        break;
      case "resume": {
        const link = value("link");
        if (link && !safeLink(link)) { setError("Enter an HTTP or HTTPS résumé link."); return; }
        payload = { ...common, kind, link };
        break;
      }
      case "deal":
        payload = { ...common, kind, company: value("company"), contact: value("contact"), status: value("status") as Deal["status"], amount };
        break;
      case "transaction":
        payload = { ...common, kind, date: date!, status: value("status") as Transaction["status"], category: value("category"), amount, deal_id: value("status") === "Income" ? value("deal_id") : "" };
        break;
    }

    setPending(true);
    try {
      await save(payload, record?.id);
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "This record could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function deleteRecord() {
    if (!record) return;
    setError("");
    setPending(true);
    try {
      await remove(record);
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "This record could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  const titleLabel = { task: "Priority", job: "Role", resume: "Version name", deal: "Opportunity", transaction: "Description" }[kind];
  const dateField = (label: string, required = false) => <label>{label}<input name="date" type="date" defaultValue={record?.date ?? (required || kind === "resume" ? today : "")} required={required} /></label>;
  const amountField = (label: string, required = false) => <label>{label} ({workspace.currency})<input name="amount" type="number" step="0.01" min={required ? "0.01" : "0"} max="1000000000" placeholder="0.00" defaultValue={deal ? deal.amount / 100 : transaction ? transaction.amount / 100 : undefined} required={required} /></label>;

  return <Modal title={`${record ? "Edit" : "Add"} ${kinds[kind].label.toLowerCase()}`} close={() => { if (!pending) close(); }}>
    {confirmDelete ? <div className="dialog-body">
      <p>Delete <strong>{record?.title}</strong> from your workspace?</p>
      {resume && <p className="muted">Applications using this version will keep their other details.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="button button-light" onClick={() => setConfirmDelete(false)} disabled={pending}>Cancel</button><button className="button button-danger" onClick={deleteRecord} disabled={pending}>{pending ? "Deleting…" : "Delete record"}</button></div>
    </div> : <form className="record-form" onSubmit={submit}>
      <div className="form-fields">
        <label className="field-wide">{titleLabel}<input name="title" required maxLength={140} defaultValue={record?.title} autoFocus /></label>
        {kind === "task" && <>
          {dateField("Due date", true)}
          <Options name="priority" label="Priority level" choices={["High", "Medium", "Low"]} value={task?.priority ?? "Medium"} />
          <Options name="area" label="Area" choices={["Workspace", "Career", "Business", "Finance"]} value={task?.area} />
          <Options name="status" label="Status" choices={["Open", "Done"]} value={task?.status} />
        </>}
        {kind === "job" && <>
          <label>Company<input name="company" defaultValue={job?.company} required maxLength={140} /></label>
          <Options name="status" label="Status" choices={jobStatuses} value={job?.status ?? "Applied"} />
          {dateField("Applied on")}
          <label>Interview date<input name="interview_date" type="date" defaultValue={job?.interview_date ?? ""} /></label>
          <label className="field-wide">Résumé version<select name="resume_id" defaultValue={job?.resume_id ?? ""}><option value="">None</option>
            {ofKind(workspace.records, "resume").map((version) => <option key={version.id} value={version.id}>{version.title}</option>)}
          </select></label>
        </>}
        {kind === "resume" && <>
          {dateField("Version date")}
          <label className="field-wide">Résumé URL<input name="link" type="url" defaultValue={resume?.link} maxLength={1000} placeholder="https://… (optional)" /></label>
        </>}
        {kind === "deal" && <>
          <label>Company<input name="company" defaultValue={deal?.company} required maxLength={140} /></label>
          <Options name="status" label="Stage" choices={dealStatuses} value={deal?.status} />
          {amountField("Value")}
          {dateField("Follow-up date")}
          <label className="field-wide">Contact<input name="contact" defaultValue={deal?.contact} maxLength={180} placeholder="Name or email" /></label>
        </>}
        {kind === "transaction" && <>
          <Options name="status" label="Type" choices={transactionStatuses} value={transactionType} change={(status) => setTransactionType(status as Transaction["status"])} />
          {amountField("Amount", true)}
          {dateField("Date", true)}
          <label>Category<input name="category" defaultValue={transaction?.category} required maxLength={140} placeholder="e.g. Software" /></label>
          {transactionType === "Income" && <label className="field-wide">Business opportunity<select name="deal_id" defaultValue={transaction?.deal_id ?? ""}>
            <option value="">None</option>{ofKind(workspace.records, "deal").map((record) => <option key={record.id} value={record.id}>{record.company} · {record.title}</option>)}
          </select></label>}
        </>}
        <label className="field-wide">Notes<textarea name="notes" rows={3} maxLength={6000} defaultValue={record?.notes} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        {record && <button type="button" className="icon-button remove-record" onClick={() => { setConfirmDelete(true); setError(""); }} disabled={pending} aria-label="Delete record"><Trash2 size={18} /></button>}
        <button type="button" className="button button-light" onClick={close} disabled={pending}>Cancel</button>
        <button className="button button-primary" disabled={pending}>{pending ? "Saving…" : record ? "Save changes" : `Add ${kinds[kind].label.toLowerCase()}`}</button>
      </div>
    </form>}
  </Modal>;
}

export function SearchWorkspace({ records, close, open }: { records: WorkspaceRecord[]; close: () => void; open: (kind: Kind, record: WorkspaceRecord) => void }) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const results = search ? records.filter((record) => `${record.title} ${recordText(record)} ${record.notes} ${kinds[record.kind].label}`.toLowerCase().includes(search)) : records;
  return <Modal title="Search workspace" close={close} className="search-modal">
    <label className="search-input"><Search size={18} /><span className="sr-only">Search all records</span>
      <input autoFocus placeholder="Search priorities, applications, transactions…" value={query} onChange={(event) => setQuery(event.target.value)} />
    </label>
    <p className="search-caption">{search ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Recent records"}</p>
    <div className="search-results">{results.slice(0, search ? results.length : 6).map((record) => <button key={record.id} onClick={() => open(record.kind, record)}>
      <span><strong>{record.title}</strong><small>{kinds[record.kind].label} · {recordText(record)}{record.date && ` · ${dateLabel(record.date)}`}</small></span><ArrowRight size={16} />
    </button>)}{results.length === 0 && <p className="muted">{search ? "No records match your search." : "There are no records to search yet."}</p>}</div>
  </Modal>;
}
