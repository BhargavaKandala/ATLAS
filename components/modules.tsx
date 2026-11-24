"use client";

import { useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, Building2, ChevronDown, Ellipsis,
  ExternalLink, FileText, Handshake, PiggyBank, Plus, ReceiptText, TrendingUp, Wallet,
} from "lucide-react";
import {
  dateLabel, dealStatuses, incomeTotals, jobStatuses, money, ofKind, safeLink, transactionStatuses,
  type Kind, type Workspace, type WorkspaceRecord,
} from "@/lib/workspace";
import { CashFlow, Stat } from "./dashboard";

type OpenRecord = (kind: Kind, record?: WorkspaceRecord) => void;
type ModuleProps = { workspace: Workspace; today: string; open: OpenRecord };

function Filter({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: readonly string[] }) {
  return <label className="compact-select"><span className="sr-only">{label}</span>
    <select value={value} onChange={(event) => setValue(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
    <ChevronDown size={13} aria-hidden="true" />
  </label>;
}

const tagTones: Record<string, string> = {
  Saved: "neutral", Applied: "blue", Interview: "lavender", Offer: "mint", Accepted: "mint", Closed: "neutral",
  Lead: "blue", Prospect: "lavender", Proposal: "amber", Client: "mint", Lost: "neutral",
  Income: "mint", Expense: "amber", Savings: "blue",
};

function Status({ value }: { value: string }) {
  return <span className={`status-tag ${tagTones[value]}`}><i />{value}</span>;
}

function RecordAction({ record, open }: { record: WorkspaceRecord; open: OpenRecord }) {
  return <button className="icon-button row-action" aria-label={`Edit ${record.title}`} onClick={() => open(record.kind, record)}><Ellipsis size={19} /></button>;
}

function Empty({ label, icon: Icon }: { label: string; icon: typeof Wallet }) {
  return <div className="empty-table"><span className="metric-icon mint"><Icon size={20} /></span><p>{label}</p></div>;
}

function Tabs({ options, tab, setTab }: { options: string[]; tab: string; setTab: (tab: string) => void }) {
  return <div className="view-tabs" aria-label="View">{options.map((option) =>
    <button key={option} className={tab === option ? "selected" : ""} aria-pressed={tab === option} onClick={() => setTab(option)}>{option}</button>)}</div>;
}

export function Career({ workspace, today, open }: ModuleProps) {
  const [tab, setTab] = useState("Applications");
  const [status, setStatus] = useState("All statuses");
  const jobs = ofKind(workspace.records, "job");
  const resumes = ofKind(workspace.records, "resume");
  const active = jobs.filter((job) => ["Applied", "Interview", "Offer"].includes(job.status));
  const interviews = jobs.filter((job) => job.interview_date && job.interview_date >= today && !["Accepted", "Closed"].includes(job.status)).sort((a, b) => a.interview_date!.localeCompare(b.interview_date!));
  const offers = jobs.filter((job) => job.status === "Offer");
  const visible = status === "All statuses" ? jobs : jobs.filter((job) => job.status === status);

  return <>
    <div className="stats-grid">
      <Stat icon={BriefcaseBusiness} tone="lavender" label="Active applications" value={active.length} detail={`${jobs.length} tracked in total`} />
      <Stat icon={ArrowUpRight} tone="blue" label="Upcoming interviews" value={interviews.length} detail={interviews[0]?.interview_date ? `Next on ${dateLabel(interviews[0].interview_date)}` : "None scheduled"} />
      <Stat icon={Handshake} tone="mint" label="Open offers" value={offers.length} detail={`${jobs.filter((job) => job.status === "Accepted").length} accepted`} />
      <Stat icon={FileText} tone="amber" label="Résumé versions" value={resumes.length} detail="Saved in this workspace" onClick={() => setTab("Résumé versions")} />
    </div>
    <section className="panel records-panel">
      <div className="module-controls">
        <Tabs options={["Applications", "Résumé versions"]} tab={tab} setTab={setTab} />
        {tab === "Applications" ? <Filter label="Application status" value={status} setValue={setStatus} options={["All statuses", ...jobStatuses]} /> :
          <button className="button button-light button-small" onClick={() => open("resume")}><Plus size={15} /> Add version</button>}
      </div>
      {tab === "Applications" ? visible.length > 0 ? <div className="table-scroll"><table>
        <thead><tr><th>Role / Company</th><th>Status</th><th>Applied on</th><th>Interview</th><th>Résumé</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{visible.map((job) => <tr key={job.id}>
          <td><button className="record-name" onClick={() => open("job", job)}>{job.title}</button><small>{job.company}</small></td>
          <td><Status value={job.status} /></td><td>{job.date ? dateLabel(job.date) : "—"}</td><td>{job.interview_date ? dateLabel(job.interview_date) : "—"}</td>
          <td>{resumes.find((resume) => resume.id === job.resume_id)?.title ?? "—"}</td><td><RecordAction record={job} open={open} /></td>
        </tr>)}</tbody>
      </table></div> : <Empty label={jobs.length ? "No applications match this status." : "Add your first application to start tracking it."} icon={BriefcaseBusiness} /> :
        resumes.length > 0 ? <div className="resume-grid">{resumes.map((resume) => {
          const link = safeLink(resume.link);
          return <article className="resume-card" key={resume.id}>
            <span className="metric-icon lavender"><FileText size={18} /></span>
            <div><button className="record-name" onClick={() => open("resume", resume)}>{resume.title}</button>{resume.date && <small>{dateLabel(resume.date, { month: "short", day: "numeric", year: "numeric" })}</small>}</div>
            <RecordAction record={resume} open={open} />
            {resume.notes && <p>{resume.notes}</p>}
            {link && <a className="text-button" href={link} target="_blank" rel="noreferrer">Open résumé <ExternalLink size={13} /></a>}
          </article>;
        })}</div> : <Empty label="Add a résumé version and link it to applications." icon={FileText} />}
    </section>
  </>;
}

export function Business({ workspace, today, open }: ModuleProps) {
  const [tab, setTab] = useState("Pipeline");
  const [status, setStatus] = useState("All stages");
  const deals = ofKind(workspace.records, "deal");
  const clients = deals.filter((deal) => deal.status === "Client");
  const pipeline = deals.filter((deal) => ["Lead", "Prospect", "Proposal"].includes(deal.status));
  const proposals = pipeline.filter((deal) => deal.status === "Proposal");
  const sum = (items: typeof deals) => money(items.reduce((total, deal) => total + deal.amount, 0), workspace.currency);
  const visible = tab === "Clients" ? clients : status === "All stages" ? deals.filter((deal) => deal.status !== "Client") : deals.filter((deal) => deal.status === status);
  const revenueByDeal = new Map<string, number>();
  for (const transaction of ofKind(workspace.records, "transaction")) {
    if (transaction.status === "Income" && transaction.date <= today && transaction.deal_id) {
      revenueByDeal.set(transaction.deal_id, (revenueByDeal.get(transaction.deal_id) ?? 0) + transaction.amount);
    }
  }
  const revenue = [...revenueByDeal.values()].reduce((total, amount) => total + amount, 0);

  return <>
    <div className="stats-grid">
      <Stat icon={TrendingUp} tone="amber" label="Open pipeline" value={sum(pipeline)} detail={`${pipeline.length} open opportunities`} />
      <Stat icon={FileText} tone="lavender" label="Proposals" value={proposals.length} detail={`${sum(proposals)} proposed`} />
      <Stat icon={Building2} tone="mint" label="Active clients" value={clients.length} detail={`${sum(clients)} in client value`} onClick={() => setTab("Clients")} />
      <Stat icon={Wallet} tone="blue" label="Collected revenue" value={money(revenue, workspace.currency)} detail="Linked income, all time" />
    </div>
    <section className="panel records-panel">
      <div className="module-controls">
        <Tabs options={["Pipeline", "Clients"]} tab={tab} setTab={setTab} />
        {tab === "Pipeline" && <Filter label="Pipeline stage" value={status} setValue={setStatus} options={["All stages", ...dealStatuses.filter((stage) => stage !== "Client")]} />}
      </div>
      {visible.length > 0 ? <div className="table-scroll"><table>
        <thead><tr><th>Opportunity / Company</th><th>Stage</th><th>Value</th><th>Collected</th><th>Follow-up</th><th>Contact</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{visible.map((deal) => <tr key={deal.id}>
          <td><button className="record-name" onClick={() => open("deal", deal)}>{deal.title}</button><small>{deal.company}</small></td>
          <td><Status value={deal.status} /></td><td className="table-number">{money(deal.amount, workspace.currency)}</td>
          <td className="table-number">{money(revenueByDeal.get(deal.id) ?? 0, workspace.currency)}</td><td>{deal.date ? dateLabel(deal.date) : "—"}</td><td>{deal.contact || "—"}</td><td><RecordAction record={deal} open={open} /></td>
        </tr>)}</tbody>
      </table></div> : <Empty label={tab === "Clients" ? "Move a deal to Client to see it here." : deals.length ? "No opportunities match this stage." : "Add your first lead or opportunity."} icon={Building2} />}
    </section>
  </>;
}

export function Finance({ workspace, today, open }: ModuleProps) {
  const [type, setType] = useState("All types");
  const [period, setPeriod] = useState("This month");
  const records = ofKind(workspace.records, "transaction").sort((a, b) => b.date.localeCompare(a.date));
  const scoped = period === "All time" ? records : records.filter((record) => record.date.startsWith(today.slice(0, period === "This month" ? 7 : 4)));
  const totals = incomeTotals(scoped.filter((record) => record.date <= today));
  const visible = type === "All types" ? scoped : scoped.filter((record) => record.status === type);
  const companies = new Map(ofKind(workspace.records, "deal").map((deal) => [deal.id, deal.company]));
  const currency = workspace.currency;
  const detail = period === "This month" ? dateLabel(today, { month: "long", year: "numeric" }) : period === "This year" ? today.slice(0, 4) : "All posted transactions";

  return <>
    <div className="stats-grid">
      <Stat icon={ArrowDownLeft} tone="mint" label="Income" value={money(totals.Income, currency)} detail={detail} />
      <Stat icon={ArrowUpRight} tone="amber" label="Expenses" value={money(totals.Expense, currency)} detail={detail} />
      <Stat icon={PiggyBank} tone="lavender" label="Saved" value={money(totals.Savings, currency)} detail={detail} />
      <Stat icon={Wallet} tone="blue" label="Net cash flow" value={money(totals.Income - totals.Expense, currency)} detail="Income less expenses" />
    </div>
    <section className="panel records-panel finance-records">
      <div className="module-controls">
        <div><h2>Transactions</h2><p>Ledger in {currency}</p></div>
        <div className="filter-group"><Filter label="Transaction type" value={type} setValue={setType} options={["All types", ...transactionStatuses]} />
          <Filter label="Transaction period" value={period} setValue={setPeriod} options={["This month", "This year", "All time"]} /></div>
      </div>
      {visible.length > 0 ? <div className="table-scroll"><table>
        <thead><tr><th>Transaction</th><th>Type</th><th>Date</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{visible.map((record) => <tr key={record.id}>
          <td><button className="record-name" onClick={() => open("transaction", record)}>{record.title}</button><small>{record.category}{companies.has(record.deal_id) && ` · ${companies.get(record.deal_id)}`}</small></td>
          <td><Status value={record.status} /></td><td>{dateLabel(record.date, { month: "short", day: "numeric", year: "numeric" })}</td>
          <td className={`table-number ${record.status === "Income" ? "positive" : ""}`}>{record.status === "Income" ? "+" : record.status === "Expense" ? "−" : ""}{money(record.amount, currency)}</td>
          <td><RecordAction record={record} open={open} /></td>
        </tr>)}</tbody>
      </table></div> : <Empty label={records.length ? "No transactions match these filters." : "Add an income, expense, or savings entry."} icon={ReceiptText} />}
    </section>
    <CashFlow records={records} today={today} currency={currency} />
  </>;
}
