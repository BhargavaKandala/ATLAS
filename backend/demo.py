import calendar
from datetime import date, timedelta


def sample_records(today: date):
    def offset(days):
        return (today + timedelta(days=days)).isoformat()

    def month(offset, day):
        index = today.year * 12 + today.month - 1 + offset
        year, zero_month = divmod(index, 12)
        number = zero_month + 1
        return date(year, number, min(day, calendar.monthrange(year, number)[1])).isoformat()

    for title, area, priority, days, status in [
        ("Prepare for product interview", "Career", "High", 0, "Open"),
        ("Send proposal to Studio North", "Business", "High", 0, "Open"),
        ("Review November expenses", "Finance", "Medium", 0, "Open"),
        ("Update application tracker", "Career", "Low", 0, "Done"),
        ("Review Q4 budget", "Finance", "Medium", 5, "Open"),
        ("Outline December priorities", "Workspace", "Low", 7, "Open"),
    ]:
        if title == "Review November expenses":
            title = f"Review {today:%B} expenses"
        if title == "Outline December priorities":
            title = f"Outline {date.fromisoformat(month(1, 1)):%B} priorities"
        yield dict(kind="task", title=title, area=area, priority=priority, date=offset(days), status=status, notes="")

    for title, company, status, days in [
        ("Senior Product Designer", "Linear", "Interview", 2),
        ("Design Lead", "Layers", "Interview", 4),
        ("Product Designer", "Forma", "Interview", 8),
        ("Senior UX Designer", "Mercury", "Applied", None),
        ("Design Engineer", "Arcade", "Applied", None),
        ("Product Design Lead", "Instrument", "Applied", None),
        ("Experience Designer", "Goodlight", "Applied", None),
        ("Senior Designer", "Index", "Offer", None),
    ]:
        yield dict(kind="job", title=title, company=company, status=status, date=offset(-8), interview_date=offset(days) if days is not None else None, resume_id="", notes="")

    yield dict(kind="resume", title="Product Design · v3", date=offset(-6), link="", notes="Portfolio and recent product work.")
    yield dict(kind="resume", title="Design Leadership · v2", date=offset(-13), link="", notes="Team development and design strategy.")

    for title, company, status, amount, days in [
        ("Brand and website refresh", "Studio North", "Proposal", 12500, 0),
        ("Product discovery sprint", "Fieldwork", "Prospect", 8000, 6),
        ("Dashboard consultation", "Madeby", "Lead", 4000, 10),
        ("Quarterly design retainer", "Evergreen", "Client", 6000, 12),
    ]:
        yield dict(kind="deal", title=title, company=company, status=status, amount=amount * 100, date=offset(days), contact="", notes="")

    for index, (income, expense) in enumerate([(4950, 2800), (5600, 3220), (5230, 2920), (6420, 3410), (5820, 3260), (6840, 3120)], start=-5):
        income_record = dict(kind="transaction", title="Client payments", date=month(index, min(2, today.day)), status="Income", category="Client work", amount=income * 100, notes="")
        if index == 0:
            income_record.update(title="Evergreen retainer payment", deal_company="Evergreen")
        yield income_record
        yield dict(kind="transaction", title="Monthly expenses", date=month(index, min(3, today.day)), status="Expense", category="Living expenses", amount=expense * 100, notes="")

    yield dict(kind="transaction", title="Reserve transfer", date=month(0, min(4, today.day)), status="Savings", category="Emergency fund", amount=125000, notes="")
