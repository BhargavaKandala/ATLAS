"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, BookOpen, BriefcaseBusiness, ChevronDown, ChevronRight, ChevronsUpDown, CircleAlert, CircleCheck,
  Compass, FileText, FolderKanban, HeartPulse, LayoutDashboard, LogOut, Menu, Plus, Search,
  Sparkles, Target, Trash2, TrendingUp, Wallet, X,
} from "lucide-react";
import { api, dateKey, kinds, type Kind, type Module, type Payload, type RecordOf, type Workspace, type WorkspaceRecord } from "@/lib/workspace";
import { Dashboard } from "./dashboard";
import { Business, Career, Finance } from "./modules";
import { EditRecord, Modal, SearchWorkspace } from "./dialogs";

const modules = {
  command: { title: "Command Centre", subtitle: "Your priorities, pipeline, and finances at a glance.", icon: LayoutDashboard, action: "Quick add" },
  career: { title: "Career OS", subtitle: "Track applications, interviews, and résumé versions.", icon: BriefcaseBusiness, action: "Add application", kind: "job" },
  business: { title: "Business OS", subtitle: "Manage opportunities, client relationships, and follow-ups.", icon: TrendingUp, action: "Add opportunity", kind: "deal" },
  finance: { title: "Finance OS", subtitle: "Stay on top of income, expenses, and savings.", icon: Wallet, action: "Add transaction", kind: "transaction" },
} satisfies Record<Module, { title: string; subtitle: string; icon: typeof Wallet; action: string; kind?: Kind }>;

const moduleKeys = Object.keys(modules) as Module[];
const future = [["Knowledge OS", BookOpen], ["Project OS", FolderKanban], ["Personal OS", HeartPulse], ["AI Command", Sparkles]] as const;
const quickAdd = [["task", Target], ["job", BriefcaseBusiness], ["deal", TrendingUp], ["transaction", Wallet], ["resume", FileText]] as const;
type Overlay = { mode: "search" } | { mode: "edit"; kind: Kind; record?: WorkspaceRecord } | { mode: "demo" };

const activeModule = () => moduleKeys.find((module) => module === window.location.hash.slice(1)) ?? "command";

export function Atlas({ account, initial }: { account: string | null; initial?: Workspace }) {
  const [module, setModule] = useState<Module>("command");
  const [workspace, setWorkspace] = useState<Workspace | undefined>(initial);
  const [today, setToday] = useState(() => dateKey());
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ text: string; error?: boolean }>();
  const [overlay, setOverlay] = useState<Overlay>();
  const [quick, setQuick] = useState(false);
  const [profile, setProfile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const quickMenu = useRef<HTMLDivElement>(null);
  const profileMenu = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError("");
      setWorkspace(await api<Workspace>("workspace"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load workspace.");
    }
  }, []);

  useEffect(() => {
    if (!initial) void refresh();
    const sync = () => setModule(activeModule());
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector("dialog[open]")) return;
        event.preventDefault();
        setOverlay({ mode: "search" });
      }
      if (event.key === "Escape") { setQuick(false); setProfile(false); setDrawer(false); }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!quickMenu.current?.contains(target)) setQuick(false);
      if (!profileMenu.current?.contains(target)) setProfile(false);
    };
    sync();
    const timer = window.setInterval(() => setToday(dateKey()), 30_000);
    window.addEventListener("hashchange", sync);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", outside);
    };
  }, [initial, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(next: Module) {
    setModule(next);
    window.location.hash = next === "command" ? "" : next;
    setDrawer(false);
    setQuick(false);
    window.scrollTo({ top: 0 });
  }

  function open(kind: Kind, record?: WorkspaceRecord) {
    setQuick(false);
    setOverlay({ mode: "edit", kind, record });
  }

  async function save(payload: Payload, id?: string, notify = true) {
    const saved = await api<WorkspaceRecord>(id ? `records/${id}` : "records", id ? "PUT" : "POST", payload);
    setWorkspace((current) => current && {
      ...current,
      records: id ? current.records.map((record) => record.id === id ? saved : record) : [saved, ...current.records],
    });
    if (notify) setToast({ text: id ? "Changes saved." : `${kinds[payload.kind].label} added.` });
  }

  async function toggleTask(task: RecordOf<"task">) {
    const { id, created_at, demo, ...payload } = task;
    setPendingTask(id);
    try {
      await save({ ...payload, status: task.status === "Done" ? "Open" : "Done" }, id, false);
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "Could not update the priority.", error: true });
    } finally {
      setPendingTask(null);
    }
  }

  function localRemove(removeRecord: (record: WorkspaceRecord) => boolean) {
    setWorkspace((current) => {
      if (!current) return current;
      const removed = new Set(current.records.filter(removeRecord).map((record) => record.id));
      const records = current.records.filter((record) => !removed.has(record.id)).map((record) => {
        if (record.kind === "job" && removed.has(record.resume_id)) return { ...record, resume_id: "" };
        if (record.kind === "transaction" && removed.has(record.deal_id)) return { ...record, deal_id: "" };
        return record;
      });
      return { ...current, records };
    });
  }

  async function remove(record: WorkspaceRecord) {
    await api(`records/${record.id}`, "DELETE");
    localRemove((item) => item.id === record.id);
    setToast({ text: "Record deleted." });
  }

  async function clearDemo() {
    setClearing(true);
    setClearError("");
    try {
      await api("demo", "DELETE");
      localRemove((record) => record.demo);
      setOverlay(undefined);
      setToast({ text: "Sample records removed." });
    } catch (error) {
      setClearError(error instanceof Error ? error.message : "Could not remove sample records.");
    } finally {
      setClearing(false);
    }
  }

  async function signOut() {
    const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    if (response?.ok) window.location.reload();
    else setToast({ text: "Could not sign out. Try again.", error: true });
  }

  const page = modules[module];
  const hasDemo = workspace?.records.some((record) => record.demo);
  const Panel = module === "career" ? Career : module === "business" ? Business : Finance;

  return <div className="atlas-shell">
    {drawer && <button className="drawer-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}
    <aside className={`sidebar ${drawer ? "drawer-open" : ""}`}>
      <button className="brand" onClick={() => navigate("command")} aria-label="ATLAS home">
        <span className="brand-mark"><Compass size={22} strokeWidth={1.85} /></span>
        <span className="brand-copy"><strong>ATLAS</strong><small>Personal Operating System</small></span>
      </button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-label">WORKSPACE</div>
        {moduleKeys.map((key) => {
          const { title, icon: Icon } = modules[key];
          return <a href={key === "command" ? "#" : `#${key}`} key={key} aria-current={key === module ? "page" : undefined} className={`nav-item ${key === module ? "active" : ""}`} onClick={(event) => { event.preventDefault(); navigate(key); }}>
            <Icon size={18} strokeWidth={1.75} /><span>{title}</span>{key === module && <span className="nav-indicator" />}
          </a>;
        })}
        <div className="nav-separator" />
        <div className="nav-label planned-label">PLANNED</div>
        {future.map(([name, Icon]) => <span className="nav-item future" key={name}><Icon size={18} strokeWidth={1.65} /><span>{name}</span></span>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-status"><i /> <span>Local-first storage</span></div>
        <div className="profile-menu-wrap" ref={profileMenu}>
          {profile && <div className="profile-popover">
            <p>{hasDemo ? "Sample data is loaded." : "Your private workspace"}</p>
            {hasDemo && <button onClick={() => { setProfile(false); setClearError(""); setOverlay({ mode: "demo" }); }}><Trash2 size={15} /> Remove sample records</button>}
            {account && <button onClick={signOut}><LogOut size={15} /> Sign out</button>}
          </div>}
          <button className="profile" onClick={() => setProfile(!profile)} aria-expanded={profile} aria-label="Workspace settings">
            <span className="avatar">{account?.trim().charAt(0).toUpperCase() || "A"}</span>
            <span><strong>{account || "Personal workspace"}</strong><small>{hasDemo ? "Sample data" : "Private workspace"}</small></span>
            <ChevronsUpDown size={15} className="profile-chevron" />
          </button>
        </div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setDrawer(!drawer)} aria-label="Open navigation"><Menu size={22} /></button>
          <span className="crumb-root">Workspace</span><ChevronRight className="crumb-separator" size={14} /><strong>{page.title}</strong></div>
        <button className="global-search" onClick={() => setOverlay({ mode: "search" })} aria-label="Search workspace"><Search size={17} /><span>Search workspace…</span><kbd>⌘ K</kbd></button>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div><h1>{page.title}</h1><p>{page.subtitle}</p></div>
          <div className="quick-wrap" ref={quickMenu}>
            <button className="button button-primary main-action" disabled={!workspace} aria-expanded={module === "command" ? quick : undefined} onClick={() => "kind" in page ? open(page.kind) : setQuick(!quick)}>
              <Plus size={18} strokeWidth={2.3} />{page.action}{module === "command" && <ChevronDown size={14} />}
            </button>
            {quick && <div className="quick-menu">{quickAdd.map(([kind, Icon]) => <button key={kind} onClick={() => open(kind)}><Icon size={16} />{kinds[kind].label}<ArrowUpRight size={13} className="quick-arrow" /></button>)}</div>}
          </div>
        </div>
        {loadError && <div className="error-banner" role="alert"><CircleAlert size={18} />{loadError}<button className="text-button" onClick={refresh}>Retry</button></div>}
        {workspace && (module === "command" ?
          <Dashboard workspace={workspace} today={today} open={open} navigate={navigate} toggleTask={toggleTask} pendingTask={pendingTask} /> :
          <Panel key={module} workspace={workspace} today={today} open={open} />)}
        {!workspace && !loadError && <div className="panel loading" role="status">Loading workspace…</div>}
      </main>
    </div>
    {overlay?.mode === "search" && <SearchWorkspace key="search" records={workspace?.records ?? []} close={() => setOverlay(undefined)} open={open} />}
    {overlay?.mode === "edit" && workspace && <EditRecord key={overlay.record?.id ?? overlay.kind} kind={overlay.kind} record={overlay.record} today={today} workspace={workspace} close={() => setOverlay(undefined)} save={save} remove={remove} />}
    {overlay?.mode === "demo" && <Modal title="Remove sample records" close={() => { if (!clearing) setOverlay(undefined); }}>
      <div className="dialog-body"><p>Delete the original sample priorities, applications, opportunities, and transactions? Records you added or edited will stay in your workspace.</p>
        {clearError && <p className="form-error" role="alert">{clearError}</p>}
        <div className="dialog-actions"><button className="button button-light" onClick={() => setOverlay(undefined)} disabled={clearing}>Cancel</button>
          <button className="button button-danger" onClick={clearDemo} disabled={clearing}>{clearing ? "Removing…" : "Remove sample records"}</button></div>
      </div>
    </Modal>}
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <CircleAlert size={18} /> : <CircleCheck size={18} />}<span>{toast.text}</span><button aria-label="Dismiss message" className="icon-button" onClick={() => setToast(undefined)}><X size={16} /></button></div>}
  </div>;
}
