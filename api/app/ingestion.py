"""Strict, transactional CSV ingestion with tolerant *names*, never guessed units."""
import hashlib
import io
import re
import pandas as pd
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import SPECS
from .db import engine, ImportLog, upsert_quotes

ALIASES = {
    "date": ["TradDt", "Date", "TradeDate", "BizDt"],
    "contract": ["TckrSymb", "Symbol", "Commodity"],
    "expiry": ["FininstrmActlXpryDt", "Expiry", "ExpiryDate", "XpryDt"],
    "original_expiry": ["XpryDt", "Expiry", "ExpiryDate"],
    "settle": ["SttlmPric", "SettlePrice", "SettlementPrice", "Settlement"],
    "open": ["OpnPric", "Open", "OpenPrice"],
    "volume": ["TtlTradgVol", "Volume", "Contracts", "NoOfContracts"],
    "oi": ["OpnIntrst", "OpenInterest", "OI"],
}

def parse_csv(content: bytes) -> pd.DataFrame:
    try:
        raw = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig", dtype=str)
    except (ValueError, UnicodeError, pd.errors.ParserError) as exc:
        raise ValueError("Upload a UTF-8 CSV, not a ZIP, HTML page, or Excel workbook.") from exc
    if len(raw) > 100_000:
        raise ValueError("CSV exceeds 100,000 rows; split the file by day.")
    key = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
    names = {key(column): column for column in raw.columns}
    out = pd.DataFrame(index=raw.index)
    for column, aliases in ALIASES.items():
        matches = [names[key(a)] for a in aliases if key(a) in names]
        if not matches and column not in {"open", "original_expiry"}:
            raise ValueError(f"Missing {column}. Accepted headers: {', '.join(aliases)}")
        out[column] = raw[matches].replace(r"^\s*$", np.nan, regex=True).bfill(axis=1).iloc[:, 0] if matches else None
    out["contract"] = out.contract.str.strip().str.upper()
    mask = out.contract.isin(SPECS)
    # An explicit option type or positive strike excludes an options row.
    for header in ("opntp", "optntp", "optiontype"):
        if header in names:
            mask &= ~raw[names[header]].fillna("").str.strip().str.upper().isin(["CE", "PE", "CALL", "PUT"])
    for header in ("strkpric", "strikeprice"):
        if header in names:
            mask &= pd.to_numeric(raw[names[header]], errors="coerce").fillna(0) <= 0
    for header in ("instrument", "instrumenttype"):
        if header in names:
            mask &= raw[names[header]].fillna("").str.upper().str.startswith("FUT")
    out = out[mask].copy()
    if out.empty:
        raise ValueError("No supported gold futures found in this file.")
    for column in ("date", "expiry", "original_expiry"):
        value = out[column].astype("string").str.strip()
        # Numeric day/month order is ambiguous across legacy exports; fail closed.
        allowed = value.str.fullmatch(r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}[- /]?[A-Za-z]{3,9}[- /]?\d{4})").fillna(False)
        if (value.notna() & ~allowed).any():
            raise ValueError(f"Ambiguous or unsupported {column} format. Use YYYY-MM-DD or a named month (28-Oct-2026).")
        out[column] = pd.to_datetime(value, errors="coerce", dayfirst=False, format="mixed")
    out["original_expiry"] = out.original_expiry.fillna(out.expiry)
    for column in ("settle", "open", "volume", "oi"):
        out[column] = pd.to_numeric(out[column].astype(str).str.replace(",", "", regex=False), errors="coerce")
    invalid = (out[["date", "expiry", "settle", "volume", "oi"]].isna().any(axis=1)
               | (out.settle <= 0) | (out.volume < 0) | (out.oi < 0)
               | (out.expiry < out.date) | (out.date > pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize())
               | ~np.isfinite(out[["settle", "volume", "oi"]]).all(axis=1)
               | (out.volume % 1 != 0) | (out.oi % 1 != 0)
               | (out.volume > 2_000_000_000) | (out.oi > 2_000_000_000)
               | (out.open.notna() & ((out.open <= 0) | ~np.isfinite(out.open))))
    if invalid.any():
        lines = (out.index[invalid] + 2).tolist()[:12]
        raise ValueError(f"Invalid data on CSV lines {lines}. Entire import rejected; nothing was written.")
    keys = ["date", "contract", "expiry"]
    duplicates = out[out.duplicated(keys, keep=False)]
    if not duplicates.empty and duplicates.groupby(keys).nunique().max().max() > 1:
        raise ValueError("Conflicting duplicate futures rows; check instrument and expiry mapping.")
    return out.drop_duplicates(keys).reset_index(drop=True)

def ingest(content: bytes, filename: str) -> dict:
    digest = hashlib.sha256(content).hexdigest()
    with Session(engine) as session:
        existing = session.scalar(select(ImportLog).where(ImportLog.digest == digest))
        if existing:
            return {"rows": existing.rows, "duplicate": True, "digest": digest}
        frame = parse_csv(content)
        rows = []
        for row in frame.to_dict("records"):
            for column in ("date", "expiry", "original_expiry"):
                row[column] = row[column].date()
            row["open"] = None if pd.isna(row["open"]) else float(row["open"])
            row["volume"], row["oi"] = int(row["volume"]), int(row["oi"])
            rows.append({**row, "source": "imported"})
        upsert_quotes(session, rows)
        session.add(ImportLog(digest=digest, filename=filename[:256], rows=len(rows)))
        session.commit()
    return {"rows": len(rows), "duplicate": False, "digest": digest}
