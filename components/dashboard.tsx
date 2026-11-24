"use client";

import { useState } from "react";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CalendarRange, Check, ChevronDown,
  CircleCheck, Compass, Crosshair, Plus, TrendingUp, Wallet,
} from "lucide-react";
import {
  dateLabel, incomeTotals, money, ofKind, offsetMonth, priorityWeights,
  type Kind, type Module, type RecordOf, type Task, type Transaction, type Workspace,
  type WorkspaceRecord,
} from "@/lib/workspace";

type OpenRecord = (kind: Kind, record?: WorkspaceRecord) => void;

export function CashFlow({ records, today, currency }: { records: Transaction[]; today: string; currency: string }) {
  const [range, setRange] = useState(6);
  const series = Array.from({ length: range }, (_, index) => {
    const date = offsetMonth(today, index - range + 1);
    return { date, ...incomeTotals(records.filter((record) => record.date.startsWith(date.slice(0, 7)) && record.date <= today)) };
  });
  const peak = Math.max(...series.flatMap(({ Income, Expense }) => [Income, Expense]), 400);
  const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
  const step = Math.ceil(peak / 4 / magnitude) * magnitude;
  const ceiling = step * 4;

  return <section className="panel chart-panel">
    <div className="panel-heading">
      <div><h2>Cash flow</h2><p>Income and expenses over time</p></div>
      <label className="compact-select"><span className="sr-only">Cash flow period</span><select value={range} onChange={(event) => setRange(Number(event.target.value))}>
        <option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option>
      </select><ChevronDown size={13} aria-hidden="true" /></label>
    </div>
    <div className="chart-legend"><span><i />Income</span><span><i />Expenses</span></div>
    <div className="chart" role="img" aria-label={`Monthly cash flow. ${series.map((month) => `${dateLabel(month.date, { month: "long" })}: income ${money(month.Income, currency)}, expenses ${money(month.Expense, currency)}`).join(". ")}`}>
      <div className="chart-axes" aria-hidden="true">{[4, 3, 2, 1, 0].map((number) => <span key={number}>{money(number * step, currency, true)}</span>)}</div>
      <div className="chart-body" aria-hidden="true">
        <div className="chart-grid">{[4, 3, 2, 1, 0].map((line) => <span key={line} />)}</div>
        <div className="chart-columns">
          {series.map((month) => <div className="chart-column" key={month.date}>
            <div className="bar-pair">
              <div className="bar income" title={`Income ${money(month.Income, currency)}`} style={{ height: `${month.Income / ceiling * 100}%` }} />
              <div className="bar expense" title={`Expenses ${money(month.Expense, currency)}`} style={{ height: `${month.Expense / ceiling * 100}%` }} />
            </div>
            <span className="chart-month">{dateLabel(month.date, { month: range > 6 ? "narrow" : "short" })}</span>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

export function Stat({ icon: Icon, tone, label, value, detail, onClick }: {
  icon: typeof Crosshair; tone: string; label: string; value: string | number; detail: string; onClick?: () => void;
}) {
  const content = <>
    <div className="stat-top"><span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></span>
      {onClick && <ArrowUpRight className="stat-arrow" size={15} />}
    </div>
    <p className="stat-label">{label}</p>
    <div className="stat-number">{value}</div>
    <p className="stat-detail">{detail}</p>
  </>;
  return onClick ? <button onClick={onClick} className="panel stat stat-link">{content}</button> : <div className="panel stat">{content}</div>;
}

function Radar() {
  return <div className="radar" aria-hidden="true">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="orbit orbit-four" />
    <div className="radar-cross horizontal" /><div className="radar-cross vertical" />
    <div className="radar-sweep" /><div className="radar-center"><Compass size={51} strokeWidth={1} /></div>
    <i className="signal signal-one" /><i className="signal signal-two" /><i className="signal signal-three" />
    <span className="radar-north">N</span><span className="radar-east">E</span>
  </div>;
}

function TaskRow({ task, today, onToggle, onOpen, pending }: {
  task: RecordOf<"task">; today: string; onToggle: (task: RecordOf<"task">) => void; onOpen: OpenRecord; pending: boolean;
}) {
  return <li className={`task-row ${task.status === "Done" ? "task-done" : ""}`}>
    <button className="task-check" role="checkbox" aria-checked={task.status === "Done"} aria-label={task.title} disabled={pending} onClick={() => onToggle(task)}>
      {task.status === "Done" && <Check size={12} strokeWidth={2.6} />}
    </button>
    <button className="task-name" onClick={() => onOpen("task", task)}>
      <span>{task.title}</span>
      <small>{task.area === "Workspace" ? "Workspace" : `${task.area} OS`}{task.date !== today && <> <span aria-hidden="true">·</span> {dateLabel(task.date)}</>}</small>
    </button>
    <span className={`priority-tag ${task.priority.toLowerCase()}`}><i />{task.priority}</span>
  </li>;
}

type UpcomingItem = { date: string; title: string; text: string; icon: typeof CalendarDays; tone: string; record: WorkspaceRecord };
function Upcoming({ workspace, today, open }: { workspace: Workspace; today: string; open: OpenRecord }) {
  const events: UpcomingItem[] = [];
  for (const job of ofKind(workspace.records, "job")) {
    if (job.interview_date && !["Closed", "Accepted"].includes(job.status)) {
      events.push({ date: job.interview_date, title: `${job.company} interview`, text: job.title, icon: BriefcaseBusiness, tone: "lavender", record: job });
    }
  }
  for (const deal of ofKind(workspace.records, "deal")) {
    if (deal.date && deal.status !== "Lost") {
      events.push({ date: deal.date, title: `Follow up with ${deal.company}`, text: deal.title, icon: TrendingUp, tone: "amber", record: deal });
    }
  }
  for (const task of ofKind(workspace.records, "task")) {
    if (task.status === "Open" && task.date > today) {
      events.push({ date: task.date, title: task.title, text: task.area, icon: Crosshair, tone: "mint", record: task });
    }
  }
  const [showAll, setShowAll] = useState(false);
  const future = events.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return <section className="panel upcoming-panel">
    <div className="panel-heading">
      <div><h2>Coming up</h2><p>Deadlines, interviews, and follow-ups</p></div>
      {future.length > 3 && <button className="button button-light button-small" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : "View all"} <ArrowRight size={14} /></button>}
    </div>
    {future.length === 0 ? <p className="empty-inline">Your upcoming dates will appear here.</p> :
      <div className="event-grid">{future.slice(0, showAll ? future.length : 3).map(({ date, icon: Icon, record, text, title, tone }) =>
        <button className="event" key={record.id} onClick={() => open(record.kind, record)}>
          <span className={`metric-icon ${tone}`}><Icon size={17} /></span><span className="event-name"><strong>{title}</strong><small>{text}</small></span>
          <span className="event-date">{date === today ? "Today" : dateLabel(date)}</span>
        </button>)}</div>}
  </section>;
}

export function Dashboard({ workspace, today, open, navigate, toggleTask, pendingTask }: {
  workspace: Workspace; today: string; open: OpenRecord; navigate: (module: Module) => void;
  toggleTask: (task: RecordOf<"task">) => void; pendingTask: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const tasks = ofKind(workspace.records, "task").sort((a, b) =>
    Number(a.status === "Done") - Number(b.status === "Done") || priorityWeights[a.priority] - priorityWeights[b.priority] || a.date.localeCompare(b.date));
  const todaysTasks = tasks.filter((task) => task.date === today || (task.date < today && task.status === "Open"));
  const completed = todaysTasks.filter((task) => task.status === "Done").length;
  const outstanding = todaysTasks.length - completed;
  const jobs = ofKind(workspace.records, "job");
  const active = jobs.filter((job) => ["Applied", "Interview", "Offer"].includes(job.status)).length;
  const interviews = jobs.filter((job) => job.interview_date && job.interview_date >= today && !["Accepted", "Closed"].includes(job.status)).length;
  const deals = ofKind(workspace.records, "deal").filter((deal) => ["Lead", "Prospect", "Proposal"].includes(deal.status));
  const pipeline = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const transactions = ofKind(workspace.records, "transaction");
  const current = incomeTotals(transactions.filter((transaction) => transaction.date.startsWith(today.slice(0, 7)) && transaction.date <= today));
  const currency = workspace.currency;
  const visible = showAll ? tasks : todaysTasks;

  return <>
    <section className="briefing">
      <Radar />
      <div className="briefing-content">
        <div className="briefing-label"><span /> DAILY BRIEFING</div>
        <h2>{outstanding ? "A clear view of your day." : "You’re up to date."}</h2>
        <p>{outstanding ? <>You have <strong>{outstanding} {outstanding === 1 ? "priority" : "priorities"}</strong> to focus on today.</> : "Add a priority to plan your next move."}</p>
        <button onClick={() => outstanding ? document.getElementById("priority-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }) : open("task")} className="briefing-button">
          {outstanding ? "View priorities" : "Add a priority"} <ArrowRight size={15} />
        </button>
      </div>
      <span className="briefing-meta"><CalendarDays size={14} /> {dateLabel(today, { weekday: "long", month: "long", day: "numeric" })}</span>
    </section>

    <div className="stats-grid">
      <Stat icon={Crosshair} tone="mint" label="Due priorities" value={outstanding} detail={`${completed} completed today`} onClick={() => document.getElementById("priority-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })} />
      <Stat icon={BriefcaseBusiness} tone="lavender" label="Active applications" value={active} detail={`${interviews} upcoming ${interviews === 1 ? "interview" : "interviews"}`} onClick={() => navigate("career")} />
      <Stat icon={TrendingUp} tone="amber" label="Pipeline value" value={money(pipeline, currency)} detail={`${deals.length} open ${deals.length === 1 ? "opportunity" : "opportunities"}`} onClick={() => navigate("business")} />
      <Stat icon={Wallet} tone="blue" label="Income this month" value={money(current.Income, currency)} detail={`${money(current.Expense, currency)} in expenses`} onClick={() => navigate("finance")} />
    </div>

    <div className="dashboard-grid">
      <section id="priority-panel" className="panel priority-panel">
        <div className="panel-heading">
          <div><h2>{showAll ? "All priorities" : "Today’s priorities"}</h2><p>{showAll ? "Your complete priority list" : "Due today and overdue"}</p></div>
          <button className="button button-light button-small" onClick={() => open("task")}><Plus size={15} /> Add</button>
        </div>
        {visible.length > 0 ? <ul className="task-list">
          {visible.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={toggleTask} onOpen={open} pending={pendingTask !== null} />)}
        </ul> : <div className="empty-inline"><CircleCheck size={19} /> {showAll ? "You haven’t added any priorities yet." : "Nothing due today."}</div>}
        <div className="panel-footer">
          <span><CalendarRange size={14} /> {showAll ? `${tasks.length} total` : `${completed} of ${todaysTasks.length} complete`}</span>
          <button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? "Show today" : "All priorities"} <ArrowRight size={14} /></button>
        </div>
      </section>
      <CashFlow records={transactions} today={today} currency={currency} />
    </div>
    <Upcoming workspace={workspace} today={today} open={open} />
  </>;
}
