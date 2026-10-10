from datetime import date, datetime, timezone
import pandas as pd
from sqlalchemy import create_engine, String, Date, DateTime, Float, Integer, UniqueConstraint, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session
from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})

class Base(DeclarativeBase):
    pass

class Quote(Base):
    __tablename__ = "quotes"
    __table_args__ = (UniqueConstraint("source", "date", "contract", "expiry", name="uq_quote"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(16), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    contract: Mapped[str] = mapped_column(String(24), index=True)
    expiry: Mapped[date] = mapped_column(Date)
    original_expiry: Mapped[date] = mapped_column(Date)
    settle: Mapped[float] = mapped_column(Float)
    open: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume: Mapped[int] = mapped_column(Integer)
    oi: Mapped[int] = mapped_column(Integer)

class ImportLog(Base):
    __tablename__ = "imports"
    id: Mapped[int] = mapped_column(primary_key=True)
    digest: Mapped[str] = mapped_column(String(64), unique=True)
    filename: Mapped[str] = mapped_column(String(256))
    loaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    rows: Mapped[int] = mapped_column(Integer)

def read_quotes(source: str) -> pd.DataFrame:
    with engine.connect() as connection:
        frame = pd.read_sql(select(Quote.__table__).where(Quote.source == source), connection)
    for column in ("date", "expiry", "original_expiry"):
        frame[column] = pd.to_datetime(frame[column])
    return frame.sort_values(["date", "contract", "expiry"]).reset_index(drop=True)

def upsert_quotes(session: Session, rows: list[dict]) -> None:
    if not rows:
        return
    if engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    # Bound each statement below SQLite's parameter ceiling.
    for offset in range(0, len(rows), 300):
        statement = insert(Quote).values(rows[offset:offset + 300])
        statement = statement.on_conflict_do_update(
            index_elements=["source", "date", "contract", "expiry"],
            set_={key: getattr(statement.excluded, key) for key in ("settle", "open", "volume", "oi", "original_expiry")},
        )
        session.execute(statement)
