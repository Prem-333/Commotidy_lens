import asyncio
import hmac
import logging
from contextlib import asynccontextmanager
from datetime import date as Date
from typing import Annotated
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool
from .config import SPECS, DATA_MODE, ADMIN_TOKEN
from .db import Base, engine, read_quotes
from .sample import seed_sample
from .analytics import normalize, select_month, pair_snapshot, pair_series, annualized_carry, slippage_bps
from .backtest import run_backtest
from .ingestion import ingest
from .models import (BacktestParams, ContractResponse, HealthResponse, NormalizedResponse, SignalsResponse,
                     SpreadResponse, TermResponse, LiquidityResponse, BacktestResponse, ImportResponse)

logger = logging.getLogger("commoditylens")
backtest_lock = asyncio.Semaphore(2)
import_lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if DATA_MODE == "sample":
        await run_in_threadpool(seed_sample)
    yield
    engine.dispose()

app = FastAPI(title="CommodityLens API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url="/api/redoc",
              description="Auditable MCX gold research. Sample data is synthetic. No investment advice or execution guarantees.")

@app.middleware("http")
async def headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.exception_handler(ValueError)
async def invalid_value(request: Request, error: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(error)})

def dataset() -> pd.DataFrame:
    return normalize(read_quotes(DATA_MODE))

def resolve_day(frame: pd.DataFrame, requested: Date | None) -> pd.Timestamp:
    if frame.empty:
        raise HTTPException(404, "No records available. Import a validated Bhavcopy file.")
    day = pd.Timestamp(requested) if requested else frame.date.max()
    if day not in set(frame.date):
        raise HTTPException(404, "No data for this date. Select an available trading date.")
    return day

def validate_symbol(symbol: str):
    if symbol not in SPECS:
        raise HTTPException(422, "Unsupported contract")

def clean(value):
    if isinstance(value, dict): return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list): return [clean(v) for v in value]
    if isinstance(value, (float, np.floating)): return float(value) if np.isfinite(value) else None
    if isinstance(value, (int, np.integer)): return int(value)
    if isinstance(value, pd.Timestamp): return value.date().isoformat()
    return value

@app.get("/api/health", response_model=HealthResponse)
def health():
    frame = read_quotes(DATA_MODE)
    dates = sorted(frame.date.dt.strftime("%Y-%m-%d").unique().tolist())
    last = dates[-1] if dates else None
    age = (pd.Timestamp.now(tz="Asia/Kolkata").date() - Date.fromisoformat(last)).days if last else None
    return {"status": "ready" if dates else "empty", "source": DATA_MODE, "rows": len(frame), "dates": dates,
            "last_bhavcopy_date": last, "age_days": age, "specs_verified": all(s.verified for s in SPECS.values()),
            "warning": "Synthetic fixtures, not market observations" if DATA_MODE == "sample" else "Imported EOD data; freshness, specs and source rights require operator verification"}

@app.get("/api/contracts", response_model=list[ContractResponse])
def contracts():
    return [{"symbol": symbol, **spec.model_dump()} for symbol, spec in SPECS.items()]

@app.get("/api/normalized", response_model=NormalizedResponse)
def normalized(date: Date | None = None, contracts: str | None = None, month: str | None = None):
    frame = dataset()
    day = resolve_day(frame, date)
    selected = select_month(frame, day, month)
    if month and selected is None:
        raise HTTPException(404, "No observations for this expiry month. Choose another date or clear the month filter.")
    today = frame[(frame.date == day) & (frame.expiry > day)]
    months = sorted(today.expiry.dt.strftime("%Y-%m").unique().tolist())
    today = today[today.expiry.dt.strftime("%Y-%m") == selected]
    today = today.assign(_order=today.contract.map({symbol: i for i, symbol in enumerate(SPECS)})).sort_values(["_order", "expiry"])
    if contracts:
        symbols = contracts.split(",")
        for symbol in symbols: validate_symbol(symbol)
        today = today[today.contract.isin(symbols)]
    rows = []
    for _, row in today.iterrows():
        item = row[["contract", "expiry", "settle", "per_gram", "pure", "volume", "oi", "grade", "notional"]].to_dict()
        item.update({key: getattr(SPECS[row.contract], key) for key in ("lot_size_grams", "quote_unit_grams", "purity", "location")})
        rows.append(clean(item))
    return {"source": DATA_MODE, "date": str(day.date()), "month": selected, "months": months, "rows": rows}

@app.get("/api/signals", response_model=SignalsResponse)
def signals(date: Date | None = None, month: str | None = None, window: int = Query(30, ge=10, le=120), threshold: float = Query(2, ge=.5, le=5)):
    frame = dataset()
    day = resolve_day(frame, date)
    selected = select_month(frame, day, month)
    return {"source": DATA_MODE, "date": str(day.date()), "month": selected,
            "signals": clean(pair_snapshot(frame, day, selected, window, threshold, DATA_MODE)) if selected else []}

@app.get("/api/spreads", response_model=SpreadResponse)
def spreads(pair: str = "GOLDM/GOLDTEN", from_date: Annotated[Date | None, Query(alias="from")] = None,
            to: Date | None = None, month: str | None = None, window: int = Query(30, ge=10, le=120)):
    symbols = pair.split("/")
    if len(symbols) != 2 or symbols[0] == symbols[1]: raise HTTPException(422, "Choose two distinct contracts")
    for symbol in symbols: validate_symbol(symbol)
    if from_date and to and from_date > to: raise HTTPException(422, "from must not exceed to")
    frame = dataset()
    day = resolve_day(frame, to)
    selected = select_month(frame, day, month)
    if not selected: raise HTTPException(404, "No matching expiry month")
    history = pair_series(frame[frame.date <= day], *symbols, selected, window)
    if from_date and not history.empty: history = history[history.date >= pd.Timestamp(from_date)]
    points = clean(history[["date", "spread", "mean", "std", "z", "interpolated"]].to_dict("records")) if not history.empty else []
    return {"source": DATA_MODE, "pair": pair, "month": selected, "points": points}

@app.get("/api/term-structure", response_model=TermResponse)
def term_structure(contract: str = "GOLDM", date: Date | None = None):
    validate_symbol(contract)
    frame = dataset()
    day = resolve_day(frame, date)
    curve = frame[(frame.date == day) & (frame.contract == contract) & (frame.expiry > day)].sort_values("expiry")
    carry = actual = roll = shift = elapsed = None
    if len(curve) > 1:
        near, far = curve.iloc[0], curve.iloc[1]
        carry = annualized_carry(near.pure, far.pure, (far.expiry - near.expiry).days)
        prior = frame[(frame.date < day) & (frame.contract == contract) & (frame.expiry.isin([near.expiry, far.expiry]))]
        if not prior.empty:
            prior = prior[prior.date == prior.date.max()].sort_values("expiry")
            if len(prior) == 2:
                elapsed = (day - prior.iloc[0].date).days
                previous_carry = annualized_carry(prior.iloc[0].pure, prior.iloc[1].pure, (far.expiry - near.expiry).days)
                roll = previous_carry * elapsed / 365
                actual = near.pure / prior.iloc[0].pure - 1
                shift = actual - roll
    return clean({"source": DATA_MODE, "contract": contract, "date": str(day.date()),
                  "points": curve[["expiry", "pure", "volume", "oi", "grade"]].to_dict("records"),
                  "carry": carry, "expected_roll_down": roll, "curve_shift": shift, "actual_change": actual, "days_elapsed": elapsed})

@app.get("/api/liquidity", response_model=LiquidityResponse)
def liquidity(contract: str = "GOLDM", date: Date | None = None, month: str | None = None):
    validate_symbol(contract)
    frame = dataset()
    day = resolve_day(frame, date)
    chosen = frame[(frame.date <= day) & (frame.contract == contract)]
    if month: chosen = chosen[chosen.expiry.dt.strftime("%Y-%m") == month]
    daily = chosen.groupby("date", as_index=False)[["volume", "oi"]].sum().tail(120)
    from .analytics import liquidity_grade
    daily["grade"] = [liquidity_grade(v, o) for v, o in zip(daily.volume, daily.oi)]
    daily["slippage_bps"] = [slippage_bps(v, o) for v, o in zip(daily.volume, daily.oi)]
    return {"source": DATA_MODE, "contract": contract, "points": clean(daily.to_dict("records"))}

@app.post("/api/backtest", response_model=BacktestResponse)
async def backtest(params: BacktestParams):
    if backtest_lock.locked(): raise HTTPException(429, "Backtest workers busy; try again shortly")
    async with backtest_lock:
        return await run_in_threadpool(lambda: run_backtest(dataset(), params, DATA_MODE))

@app.post("/api/ingest", response_model=ImportResponse)
async def upload(file: Annotated[UploadFile, File()], authorization: Annotated[str | None, Header()] = None):
    if not ADMIN_TOKEN: raise HTTPException(503, "Imports disabled until INGEST_TOKEN is configured")
    if not authorization or not hmac.compare_digest(authorization.encode(), f"Bearer {ADMIN_TOKEN}".encode()):
        raise HTTPException(401, "A valid operator token is required", headers={"WWW-Authenticate": "Bearer"})
    content = await file.read(10 * 1024 * 1024 + 1)
    await file.close()
    if len(content) > 10 * 1024 * 1024: raise HTTPException(413, "Maximum upload size is 10 MB")
    try:
        async with import_lock:
            return await run_in_threadpool(ingest, content, file.filename or "bhavcopy.csv")
    except IntegrityError:
        raise HTTPException(409, "Concurrent import detected. Retry the same file safely.")
    except ValueError as error:
        logger.warning("Bhavcopy import rejected: %s", error)
        raise
