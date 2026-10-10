"""Prices in INR per fine gram; spreads and costs in basis points of one leg."""
from itertools import combinations
import numpy as np
import pandas as pd
from scipy.stats import percentileofscore
from .config import SPECS

def normalize(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["per_gram"] = [price / SPECS[symbol].quote_unit_grams for symbol, price in zip(out.contract, out.settle)]
    out["pure"] = [price / SPECS[symbol].purity for symbol, price in zip(out.contract, out.per_gram)]
    out["open_pure"] = [price / SPECS[symbol].quote_unit_grams / SPECS[symbol].purity if pd.notna(price) else np.nan for symbol, price in zip(out.contract, out.open)]
    out["notional"] = [price * SPECS[symbol].lot_size_grams / SPECS[symbol].quote_unit_grams for symbol, price in zip(out.contract, out.settle)]
    out["grade"] = [liquidity_grade(v, o) for v, o in zip(out.volume, out.oi)]
    return out

def liquidity_grade(volume: float, oi: float) -> str:
    return "A" if volume >= 1000 and oi >= 3000 else "B" if volume >= 100 and oi >= 500 else "C"

def slippage_bps(volume: float, oi: float) -> float:
    return float(min(50, 1 + 30 / np.sqrt(max(1, volume)) + 50 / np.sqrt(max(1, oi))))

def rolling_statistics(series: pd.Series, window: int) -> pd.DataFrame:
    # Shift BEFORE rolling: today's price never contributes to its own baseline.
    historical = series.shift(1)
    mean = historical.rolling(window, min_periods=window).mean()
    std = historical.rolling(window, min_periods=window).std(ddof=1)
    z = ((series - mean) / std.where(std > 1e-9)).replace([np.inf, -np.inf], np.nan)
    percentile = pd.Series(np.nan, index=series.index)
    for index in range(window, len(series)):
        history = series.iloc[index - window:index]
        if history.notna().all() and pd.notna(series.iloc[index]):
            percentile.iloc[index] = percentileofscore(history, series.iloc[index], kind="mean")
    return pd.DataFrame({"mean": mean, "std": std, "z": z, "percentile": percentile})

def annualized_carry(near: float, far: float, days: int) -> float:
    if near <= 0 or far <= 0 or days <= 0:
        raise ValueError("Positive prices and increasing expiries are required.")
    return (far / near - 1) * 365 / days

def constant_maturity(curve: pd.DataFrame, target: pd.Timestamp) -> dict | None:
    """Interpolation is explicit and never extrapolates beyond observed expiries."""
    curve = curve.sort_values("expiry")
    exact = curve[curve.expiry == target]
    if not exact.empty:
        row = exact.iloc[0]
        return {"pure": float(row.pure), "interpolated": False, "expiries": [row.expiry.date().isoformat()]}
    left, right = curve[curve.expiry < target], curve[curve.expiry > target]
    if left.empty or right.empty:
        return None
    lo, hi = left.iloc[-1], right.iloc[0]
    weight = (target - lo.expiry).days / (hi.expiry - lo.expiry).days
    return {"pure": float(lo.pure + weight * (hi.pure - lo.pure)), "interpolated": True,
            "expiries": [lo.expiry.date().isoformat(), hi.expiry.date().isoformat()]}

def select_month(frame: pd.DataFrame, day: pd.Timestamp, month: str | None = None) -> str | None:
    today = frame[(frame.date == day) & (frame.expiry > day)]
    months = sorted(today.expiry.dt.strftime("%Y-%m").unique())
    if month:
        return month if month in months else None
    for candidate in months:
        if today[today.expiry.dt.strftime("%Y-%m") == candidate].contract.nunique() == len(SPECS):
            return candidate
    return months[0] if months else None

def pair_series(frame: pd.DataFrame, a: str, b: str, month: str, window: int = 30) -> pd.DataFrame:
    chosen = frame[frame.expiry.dt.strftime("%Y-%m") == month]
    # Reject ambiguous multiple expiries within a symbol/month instead of silently merging.
    if chosen.groupby(["date", "contract"]).size().max() > 1:
        raise ValueError("Multiple expiries in one contract month; exact-expiry selection is required.")
    left, right = chosen[chosen.contract == a], chosen[chosen.contract == b]
    merged = left.merge(right, on="date", suffixes=("_a", "_b")).sort_values("date").reset_index(drop=True)
    if merged.empty:
        return merged
    merged["interpolated"] = merged.expiry_a != merged.expiry_b
    # Use the earlier delivery date as a common target and interpolate only within brackets.
    for index, row in merged[merged.interpolated].iterrows():
        target = min(row.expiry_a, row.expiry_b)
        for symbol, suffix in ((a, "a"), (b, "b")):
            curve = frame[(frame.date == row.date) & (frame.contract == symbol)]
            estimate = constant_maturity(curve, target)
            merged.at[index, f"pure_{suffix}"] = estimate["pure"] if estimate else np.nan
    merged["spread"] = (merged.pure_a / merged.pure_b - 1) * 10_000
    return pd.concat([merged, rolling_statistics(merged.spread, window)], axis=1)

def pair_snapshot(frame: pd.DataFrame, day: pd.Timestamp, month: str, window: int, threshold: float, source: str) -> list[dict]:
    result = []
    for a, b in combinations(SPECS, 2):
        history = pair_series(frame[frame.date <= day], a, b, month, window)
        if history.empty or history.iloc[-1].date != day:
            continue
        row = history.iloc[-1]
        if pd.isna(row.spread):
            continue
        z = float(row.z) if pd.notna(row.z) else None
        expected = abs(float(row.spread - row["mean"])) if pd.notna(row["mean"]) else 0
        cost = 4 * 1.5 + 2 * (slippage_bps(row.volume_a, row.oi_a) + slippage_bps(row.volume_b, row.oi_b))
        grade = max(row.grade_a, row.grade_b)
        reasons = []
        if z is None: reasons.append("Insufficient trailing observations")
        elif abs(z) <= threshold: reasons.append("Below z-score threshold")
        if grade == "C": reasons.append("Thin liquidity")
        if expected <= cost: reasons.append("Expected reversion does not cover modeled costs")
        if row.interpolated: reasons.append("Interpolated maturity: research only")
        if SPECS[a].location != SPECS[b].location: reasons.append("Different delivery locations")
        if source == "imported" and not (SPECS[a].verified and SPECS[b].verified): reasons.append("Contract specifications require operator verification")
        result.append({"pair": f"{a}/{b}", "a": a, "b": b, "spread_bps": float(row.spread), "z": z,
                       "percentile": float(row.percentile) if pd.notna(row.percentile) else None,
                       "score": float(np.clip(z / 3 * 100, -100, 100)) if z is not None else 0,
                       "grade": grade, "cost_bps": cost, "expected_bps": expected,
                       "verdict": ("RICH" if z > 0 else "CHEAP") if not reasons else ("BLOCKED" if z is not None and abs(z) > threshold else "FAIR"),
                       "eligible": not reasons, "reasons": reasons, "interpolated": bool(row.interpolated)})
    return sorted(result, key=lambda item: abs(item["score"]), reverse=True)
