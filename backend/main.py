import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import JSON, Boolean, ForeignKey, String, create_engine, delete, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .demo import sample_records
from .models import JobInput, Payload, TransactionInput

data_path = Path(os.getenv("ATLAS_DATA_DIR", "data"))
database_url = os.getenv("ATLAS_DATABASE_URL")
if not database_url:
    data_path.mkdir(parents=True, exist_ok=True)
    database_url = f"sqlite:///{data_path.resolve() / 'atlas.sqlite3'}"

engine = create_engine(database_url, pool_pre_ping=True)


if engine.dialect.name == "sqlite":
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


class Record(Base):
    __tablename__ = "workspace_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(24), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    related_id: Mapped[str | None] = mapped_column(ForeignKey("workspace_records.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[str] = mapped_column(String(40))
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

    def as_dict(self):
        result = {**self.data, "id": self.id, "created_at": self.created_at, "demo": self.demo}
        if self.kind == "job":
            result["resume_id"] = self.related_id or ""
        if self.kind == "transaction":
            result["deal_id"] = self.related_id or ""
        return result


class WorkspaceSetting(Base):
    __tablename__ = "workspace_settings"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(String(40))


def new_record(payload: dict, demo: bool = False) -> Record:
    record = Record(
        id=str(uuid4()),
        kind=payload["kind"],
        created_at=datetime.now(timezone.utc).isoformat(),
        demo=demo,
    )
    set_payload(record, payload)
    return record


def set_payload(record: Record, payload: dict):
    data = dict(payload)
    record.related_id = (data.pop("resume_id", "") or data.pop("deal_id", "")) or None
    record.data = data


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        if not session.get(WorkspaceSetting, "currency"):
            currency = os.getenv("ATLAS_CURRENCY", "USD").upper()
            if not re.fullmatch(r"[A-Z]{3}", currency):
                raise ValueError("ATLAS_CURRENCY must be a three-letter ISO currency code.")
            session.add(WorkspaceSetting(key="currency", value=currency))
        if not session.get(WorkspaceSetting, "demo_initialized"):
            if os.getenv("ATLAS_DEMO_DATA") == "1":
                today = datetime.now(ZoneInfo(os.getenv("ATLAS_TIMEZONE", "Asia/Kolkata"))).date()
                deals = {}
                for item in sample_records(today):
                    if company := item.pop("deal_company", ""):
                        item["deal_id"] = deals[company]
                    record = new_record(item, demo=True)
                    session.add(record)
                    if record.kind == "deal":
                        deals[item["company"]] = record.id
                        session.flush()
            session.add(WorkspaceSetting(key="demo_initialized", value="1"))
    yield
    engine.dispose()


app = FastAPI(title="ATLAS API", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "api"])


@app.exception_handler(IntegrityError)
def conflicting_write(_: Request, __: IntegrityError):
    return JSONResponse({"detail": "A related record changed. Reload the workspace and try again."}, status_code=409)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/workspace")
def workspace():
    with Session(engine) as session:
        records = session.scalars(select(Record).order_by(Record.created_at.desc(), Record.id))
        return {
            "records": [record.as_dict() for record in records],
            "currency": session.get(WorkspaceSetting, "currency").value,
        }


def validate_relationship(session: Session, payload: Payload):
    if isinstance(payload, JobInput) and payload.resume_id:
        resume = session.get(Record, payload.resume_id)
        if not resume or resume.kind != "resume":
            raise HTTPException(422, "Choose an existing résumé version.")
    if isinstance(payload, TransactionInput) and payload.deal_id:
        deal = session.get(Record, payload.deal_id)
        if payload.status != "Income" or not deal or deal.kind != "deal":
            raise HTTPException(422, "Choose an existing opportunity for this income entry.")


@app.post("/records", status_code=201)
def create_record(payload: Payload):
    with Session(engine) as session, session.begin():
        validate_relationship(session, payload)
        record = new_record(payload.model_dump(mode="json"))
        session.add(record)
        result = record.as_dict()
    return result


@app.put("/records/{record_id}")
def update_record(record_id: str, payload: Payload):
    with Session(engine) as session, session.begin():
        record = session.get(Record, record_id, with_for_update=True)
        if not record:
            raise HTTPException(404, "This record no longer exists.")
        if record.kind != payload.kind:
            raise HTTPException(422, "The record type cannot change.")
        validate_relationship(session, payload)
        set_payload(record, payload.model_dump(mode="json"))
        record.demo = False
        result = record.as_dict()
    return result


@app.delete("/records/{record_id}", status_code=204)
def delete_record(record_id: str):
    with Session(engine) as session, session.begin():
        record = session.get(Record, record_id, with_for_update=True)
        if not record:
            raise HTTPException(404, "This record no longer exists.")
        session.delete(record)
    return Response(status_code=204)


@app.delete("/demo", status_code=204)
def delete_demo():
    with Session(engine) as session, session.begin():
        session.execute(delete(Record).where(Record.demo.is_(True)))
    return Response(status_code=204)
