import os
import re
from collections import Counter
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..storage import Record, WorkspaceSetting, engine
from .contracts import Agent

PRIORITY = {"High": 0, "Medium": 1, "Low": 2}
OPEN_DEAL_STAGES = {"Lead", "Prospect", "Proposal"}


def read_workspace(agent: Agent, prompt: str) -> str:
    now = datetime.now(ZoneInfo(os.getenv("ATLAS_TIMEZONE", "Asia/Kolkata"))).date()
    today = now.isoformat()
    next_week = (now + timedelta(days=7)).isoformat()
    with Session(engine) as session:
        setting = session.get(WorkspaceSetting, "currency")
        currency = setting.value if setting else "USD"
        query = select(Record.data).order_by(Record.created_at.desc(), Record.id)
        if agent == "loki":
            query = query.where(Record.kind.in_(("task", "job", "deal")))
        records = session.scalars(query).all()

    tasks = sorted(
        (item for item in records if item["kind"] == "task" and item["status"] == "Open"),
        key=lambda task: (task["date"] > today, PRIORITY[task["priority"]], task["date"]),
    )
    jobs = [item for item in records if item["kind"] == "job"]
    deals = [item for item in records if item["kind"] == "deal" and item["status"] != "Lost"]
    upcoming = [
        (job["interview_date"], f"{job['company']} interview")
        for job in jobs
        if job["status"] not in ("Accepted", "Closed")
        and job.get("interview_date") and today <= job["interview_date"] <= next_week
    ]
    upcoming.extend((deal["date"], f"Follow up with {deal['company']}") for deal in deals if deal.get("date") and today <= deal["date"] <= next_week)
    due = [task for task in tasks if task["date"] <= today]

    def money(amount):
        sign = "-" if amount < 0 else ""
        major, minor = divmod(abs(amount), 100)
        return f"{currency} {sign}{major:,}.{minor:02d}"

    if agent == "jarvis":
        lines = [f"Daily brief · {today}", f"Open priorities due today or earlier: {len(due)}."]
        lines.extend(f"• {task['title']} ({task['priority']}, due {task['date']})" for task in due[:5])
        lines.extend(["", "Next 7 days"])
        lines.extend([f"• {day} · {title}" for day, title in sorted(upcoming)[:5]] or ["No interviews or follow-ups are scheduled."])
        lines.extend(["", f"Start with {due[0]['title']}." if due else "Add a dated priority to plan your next move."])
        return "\n".join(lines)

    if agent == "zeus":
        open_deals = [deal for deal in deals if deal["status"] in OPEN_DEAL_STAGES]
        pipeline = sum(deal["amount"] for deal in open_deals)
        totals = Counter()
        for item in records:
            if item["kind"] == "transaction" and item["date"][:7] == today[:7] and item["date"] <= today:
                totals[item["status"]] += item["amount"]
        job_count = sum(job["status"] in ("Applied", "Interview", "Offer") for job in jobs)
        lines = [
            f"Decision brief · {today}",
            f"• Due priorities: {len(due)}. Interviews or follow-ups in the next 7 days: {len(upcoming)}.",
            f"• Pipeline: {money(pipeline)} across {len(open_deals)} open opportunities.",
            f"• Career: {job_count} active applications.",
            f"• Month-to-date net cash flow: {money(totals['Income'] - totals['Expense'])}.",
            "",
            f"Protect time for {due[0]['title']} first." if due else "Reserve time for the highest-impact opportunity this week.",
            "Compare the next actions by deadline, expected value, and the cost of delaying each one.",
        ]
        return "\n".join(lines)

    terms = set(re.findall(r"\w{3,}", prompt.lower())) - {"the", "and", "for", "into", "with", "from", "this", "what"}

    if agent == "loki":
        targets = tasks + [job for job in jobs if job["status"] not in ("Accepted", "Closed")] + deals

        def match(item):
            return len(terms.intersection(re.findall(r"\w{3,}", f"{item['title']} {item.get('company', '')}".lower())))

        target = max(targets, key=match, default=None)
        subject = target["title"] if target and match(target) else (due[0]["title"] if due else "your next recurring task")
        return "\n".join([
            f"Checklist for {subject}",
            "",
            "1. Write the desired outcome and due date in one sentence.",
            "2. Gather the relevant inputs and note anything you are waiting for.",
            "3. Draft the output using a template you can reuse next time.",
            "4. Review the output against the outcome, fix gaps, and mark it complete in ATLAS.",
        ])

    notes = [item for item in records if item.get("notes") and item["kind"] != "transaction"]

    def relevance(item):
        return len(terms.intersection(re.findall(r"\w{3,}", f"{item['title']} {item['notes']}".lower())))

    related = [item for item in sorted(notes, key=relevance, reverse=True) if relevance(item)][:4]
    lines = ["Learning brief", ""]
    if related:
        lines.extend(f"• {item['title']}: {' '.join(item['notes'].split())[:240]}" for item in related)
    else:
        lines.append("No saved notes matched this request. Start by writing down the question you want to answer.")
    lines.extend(["", "Practice", "Explain the idea in your own words, work one concrete example, then try to recreate it tomorrow without your notes."])
    return "\n".join(lines)
