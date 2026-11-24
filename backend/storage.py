import os
from pathlib import Path

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

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


class AgentRun(Base):
    __tablename__ = "agent_runs"

    trace_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    agent: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[str] = mapped_column(String(40), index=True)
    duration_ms: Mapped[int] = mapped_column(Integer)
    steps: Mapped[list[dict]] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(40))
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
