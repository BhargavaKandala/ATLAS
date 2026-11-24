from datetime import date as Date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=140)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)]
Amount = Annotated[int, Field(ge=0, le=100_000_000_000)]


class RecordInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    date: Date | None = None
    notes: Notes = ""


class TaskInput(RecordInput):
    kind: Literal["task"]
    date: Date
    status: Literal["Open", "Done"] = "Open"
    priority: Literal["High", "Medium", "Low"] = "Medium"
    area: Literal["Workspace", "Career", "Business", "Finance"] = "Workspace"


class JobInput(RecordInput):
    kind: Literal["job"]
    company: Title
    status: Literal["Saved", "Applied", "Interview", "Offer", "Accepted", "Closed"] = "Saved"
    interview_date: Date | None = None
    resume_id: Annotated[str, StringConstraints(max_length=36)] = ""


class ResumeInput(RecordInput):
    kind: Literal["resume"]
    link: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class DealInput(RecordInput):
    kind: Literal["deal"]
    company: Title
    contact: ShortText = ""
    status: Literal["Lead", "Prospect", "Proposal", "Client", "Lost"] = "Lead"
    amount: Amount = 0


class TransactionInput(RecordInput):
    kind: Literal["transaction"]
    date: Date
    status: Literal["Income", "Expense", "Savings"] = "Expense"
    category: Title
    amount: Annotated[int, Field(gt=0, le=100_000_000_000)]
    deal_id: Annotated[str, StringConstraints(max_length=36)] = ""


Payload = Annotated[
    TaskInput | JobInput | ResumeInput | DealInput | TransactionInput,
    Field(discriminator="kind"),
]
