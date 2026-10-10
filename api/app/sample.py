"""Deterministic synthetic fixtures, never a market feed or reported performance."""
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import engine, Quote, upsert_quotes
from .config import SPECS

def seed_sample() -> None:
    with Session(engine) as session:
        if session.scalar(select(Quote.id).where(Quote.source == "sample").limit(1)):
            return
        rng = np.random.default_rng(81026)
        days = pd.bdate_range("2025-03-03", "2026-10-09")
        expiries = pd.date_range("2025-03-01", "2027-05-01", freq="MS") + pd.Timedelta(days=27)
        fair = 8000.0
        deviations = np.zeros(len(SPECS))
        rows = []
        for day in days:
            previous = fair
            fair *= np.exp(0.00025 + rng.normal(0, 0.005))
            deviations = deviations * 0.86 + rng.normal(0, 0.00065, len(SPECS))
            for expiry in expiries:
                tenor = (expiry - day).days
                if tenor < 3 or tenor > 240:
                    continue
                for j, (symbol, spec) in enumerate(SPECS.items()):
                    pure = fair * (1 + 0.065 * tenor / 365) * (1 + deviations[j])
                    opening = previous * (1 + 0.065 * tenor / 365) * (1 + deviations[j] * 0.65 + rng.normal(0, 0.0003))
                    activity = [18000, 1400, 350, 800][j] * np.exp(-tenor / 160)
                    rows.append({"source": "sample", "date": day.date(), "contract": symbol,
                                 "expiry": expiry.date(), "original_expiry": expiry.date(),
                                 "settle": round(pure * spec.quote_unit_grams * spec.purity, 2),
                                 "open": round(opening * spec.quote_unit_grams * spec.purity, 2),
                                 "volume": int(activity * rng.uniform(.3, 1.7)), "oi": int(activity * rng.uniform(2, 6))})
        upsert_quotes(session, rows)
        session.commit()
