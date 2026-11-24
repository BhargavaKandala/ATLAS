export type Kind = "task" | "job" | "resume" | "deal" | "transaction";
export type Module = "command" | "career" | "business" | "finance" | "ai";

type Common = { title: string; date: string | null; notes: string };
export type Task = Common & { kind: "task"; date: string; status: "Open" | "Done"; area: "Workspace" | "Career" | "Business" | "Finance"; priority: "High" | "Medium" | "Low" };
export type Job = Common & { kind: "job"; company: string; status: "Saved" | "Applied" | "Interview" | "Offer" | "Accepted" | "Closed"; interview_date: string | null; resume_id: string };
export type Resume = Common & { kind: "resume"; link: string };
export type Deal = Common & { kind: "deal"; company: string; contact: string; status: "Lead" | "Prospect" | "Proposal" | "Client" | "Lost"; amount: number };
export type Transaction = Common & { kind: "transaction"; date: string; status: "Income" | "Expense" | "Savings"; category: string; amount: number; deal_id: string };
export type Payload = Task | Job | Resume | Deal | Transaction;
export type WorkspaceRecord = Payload & { id: string; created_at: string; demo: boolean };
export type RecordOf<T extends Kind> = Extract<WorkspaceRecord, { kind: T }>;
export type Workspace = { records: WorkspaceRecord[]; currency: string };

export const kinds: Record<Kind, { label: string; plural: string; module: Module }> = {
  task: { label: "Priority", plural: "Priorities", module: "command" },
  job: { label: "Application", plural: "Applications", module: "career" },
  resume: { label: "Résumé version", plural: "Résumé versions", module: "career" },
  deal: { label: "Opportunity", plural: "Opportunities", module: "business" },
  transaction: { label: "Transaction", plural: "Transactions", module: "finance" },
};

export const jobStatuses = ["Saved", "Applied", "Interview", "Offer", "Accepted", "Closed"] as const;
export const dealStatuses = ["Lead", "Prospect", "Proposal", "Client", "Lost"] as const;
export const transactionStatuses = ["Income", "Expense", "Savings"] as const;
export const priorityWeights = { High: 0, Medium: 1, Low: 2 };
export const workspaceTimeZone = "Asia/Kolkata";

export function ofKind<T extends Kind>(records: WorkspaceRecord[], kind: T): RecordOf<T>[] {
  return records.filter((record): record is RecordOf<T> => record.kind === kind);
}

export function dateKey(date = new Date()) {
  const fields = new Intl.DateTimeFormat("en", { timeZone: workspaceTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => fields.find((item) => item.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function asDate(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

export function dateLabel(key: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return asDate(key).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

export function offsetMonth(key: string, amount: number) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 10);
}

export function money(amount: number, currency: string, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : amount % 100 === 0 ? 0 : 2,
    minimumFractionDigits: !compact && amount % 100 !== 0 ? 2 : 0,
  }).format(amount / 100);
}

export function incomeTotals(records: Transaction[]) {
  const totals = { Income: 0, Expense: 0, Savings: 0 };
  for (const record of records) totals[record.status] += record.amount;
  return totals;
}

export function recordText(record: WorkspaceRecord) {
  switch (record.kind) {
    case "job":
    case "deal":
      return record.company;
    case "task":
      return record.area;
    case "transaction":
      return record.category;
    case "resume":
      return "Career";
  }
}

export async function api<T>(route: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(`/api/atlas/${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.[0]?.msg ?? "The workspace could not save this change.");
  }
  return data as T;
}

export function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
