"""Walk-forward research replay. Signal at close t; modeled entry at open t+1.

This is an equal-notional, fractional-lot research model, not a fill simulator.
All execution costs and liquidity decisions use the preceding observed session.
"""
import numpy as np
import pandas as pd
from .analytics import pair_series, slippage_bps
from .models import BacktestParams
from .config import SPECS

def run_backtest(frame: pd.DataFrame, params: BacktestParams, source: str) -> dict:
    symbols = params.pair.split("/")
    if len(symbols) != 2 or any(s not in SPECS for s in symbols) or symbols[0] == symbols[1]:
        raise ValueError("Choose two distinct supported contracts")
    a, b = symbols
    if source == "imported" and not (SPECS[a].verified and SPECS[b].verified):
        raise ValueError("Verify contract specifications for the selected historical expiries before replaying imported data")
    if params.to_date:
        frame = frame[frame.date <= pd.Timestamp(params.to_date)]
    series = pair_series(frame, a, b, params.month, params.lookback)
    if series.empty or len(series) <= params.lookback + 1:
        raise ValueError("Insufficient matched observations for this month and training window")
    if series.interpolated.any():
        raise ValueError("Backtests require exact matched expiry dates; interpolated curves are research views only")
    if SPECS[a].location != SPECS[b].location:
        raise ValueError("Cross-location backtests are disabled: delivery basis is not modeled")
    trades, equity, windows = [], [], []
    position = None
    pending = None
    realized_gross = realized_net = peak = 0.0
    previous_mark = 0.0
    monthly = {}
    iso = lambda timestamp: timestamp.date().isoformat()
    model_mean = model_std = None
    for index, row in series.iterrows():
        if index < params.lookback:
            continue
        if (index - params.lookback) % params.test_window == 0:
            train = series.iloc[index - params.lookback:index]
            model_mean, model_std = float(train.spread.mean()), float(train.spread.std(ddof=1))
            windows.append({"train_start": iso(train.iloc[0].date), "train_end": iso(train.iloc[-1].date),
                            "test_start": iso(row.date), "test_end": iso(series.iloc[min(index + params.test_window - 1, len(series) - 1)].date)})
        if params.from_date and row.date < pd.Timestamp(params.from_date):
            continue
        previous = series.iloc[index - 1]
        cost_side = (2 * params.fees_bps_per_leg + slippage_bps(previous.volume_a, previous.oi_a) + slippage_bps(previous.volume_b, previous.oi_b)) if params.include_costs else 0
        can_fill = pd.notna(row.open_pure_a) and pd.notna(row.open_pure_b) and max(previous.grade_a, previous.grade_b) != "C"
        # Orders decided at the previous close are evaluated at this open only.
        if pending and can_fill:
            if pending["action"] == "enter" and position is None:
                position = {"a": row.open_pure_a, "b": row.open_pure_b, "direction": pending["direction"],
                            "entry": index, "date": row.date, "signal_date": pending["date"], "entry_cost": cost_side}
            elif pending["action"] == "exit" and position:
                gross = position["direction"] * ((row.open_pure_a / position["a"] - 1) - (row.open_pure_b / position["b"] - 1)) * 10_000
                costs = position["entry_cost"] + cost_side
                realized_gross += gross
                realized_net += gross - costs
                trades.append({"signal_date": iso(position["signal_date"]), "entry_date": iso(position["date"]), "exit_date": iso(row.date),
                               "direction": "Long A / short B" if position["direction"] == 1 else "Short A / long B",
                               "gross_bps": float(gross), "cost_bps": float(costs), "net_bps": float(gross - costs),
                               "holding_days": int(index - position["entry"]), "reason": pending["reason"]})
                position = None
            pending = None
        elif pending and pending["action"] == "enter":
            pending = None  # Unfilled entry expires; never backfill it with a settlement.
        mark_gross, mark_net = realized_gross, realized_net
        if position:
            unrealized = position["direction"] * ((row.pure_a / position["a"] - 1) - (row.pure_b / position["b"] - 1)) * 10_000
            mark_gross += unrealized
            mark_net += unrealized - position["entry_cost"]
        peak = max(peak, mark_net)
        equity.append({"date": iso(row.date), "gross": float(mark_gross), "net": float(mark_net), "drawdown": float(mark_net - peak)})
        month = row.date.strftime("%Y-%m")
        monthly[month] = monthly.get(month, 0) + mark_net - previous_mark
        previous_mark = mark_net
        z = (row.spread - model_mean) / model_std if model_std is not None and model_std > 1e-9 else None
        if position:
            held = index - position["entry"]
            if held >= params.max_holding or (z is not None and abs(z) <= params.exit_z):
                pending = {"action": "exit", "reason": "Maximum holding" if held >= params.max_holding else "Mean reversion"}
        elif z is not None and abs(z) > params.entry_z and max(row.grade_a, row.grade_b) != "C":
            expected = abs(row.spread - model_mean)
            estimated_roundtrip = (4 * params.fees_bps_per_leg + 2 * (slippage_bps(row.volume_a, row.oi_a) + slippage_bps(row.volume_b, row.oi_b))) if params.include_costs else 0
            if expected > estimated_roundtrip:
                pending = {"action": "enter", "direction": -1 if z > 0 else 1, "date": row.date}
    returns = np.diff([0] + [point["net"] for point in equity])
    sharpe = float(np.mean(returns) / np.std(returns, ddof=1) * np.sqrt(252)) if len(returns) > 1 and np.std(returns, ddof=1) > 1e-9 else None
    low = high = None
    if len(trades) >= 5 and len(returns) >= 20:
        # Moving-block bootstrap retains short serial dependence; fixed seed is reproducible.
        rng = np.random.default_rng(42)
        block = min(5, len(returns))
        samples = []
        for _ in range(500):
            starts = rng.integers(0, len(returns) - block + 1, int(np.ceil(len(returns) / block)))
            samples.append(np.concatenate([returns[start:start + block] for start in starts])[:len(returns)].sum())
        low, high = [float(v) for v in np.quantile(samples, [.025, .975])]
    final = equity[-1] if equity else {"gross": 0, "net": 0}
    metrics = {"gross_bps": final["gross"], "net_bps": final["net"], "sharpe": sharpe,
               "hit_rate": float(np.mean([t["net_bps"] > 0 for t in trades])) if trades else None,
               "max_drawdown_bps": min([p["drawdown"] for p in equity], default=0),
               "avg_holding_days": float(np.mean([t["holding_days"] for t in trades])) if trades else None,
               "turnover_legs": 4 * len(trades) + (2 if position else 0), "trades": len(trades),
               "bootstrap_low_bps": low, "bootstrap_high_bps": high}
    warning = "No demonstrated edge after modeled costs." if final["net"] <= 0 else "Positive simulated results are not evidence of an executable edge."
    return {"source": source, "params": params.model_dump(mode="json"), "metrics": metrics, "equity": equity, "trades": trades,
            "windows": windows, "monthly": monthly, "warning": warning,
            "assumptions": ["Sample data is synthetic; imported files are end-of-day observations.",
                            "Fixed expiry; rolling train window is frozen during each unseen test block. No parameter optimization.",
                            "Signals at close, modeled fills at the next available open plus adverse slippage booked as costs.",
                            "Previous-session volume and OI gate fills. Missing opens and thin entries are skipped; exits can be delayed.",
                            "Equal INR notional per leg; fractional lots. Bps denominator is one leg, not margin or total capital.",
                            "Fees aggregate brokerage, exchange charges, taxes and stamp duties; defaults require broker-specific calibration.",
                            "No margin, funding, delivery, bid/ask, queue position, or whole-lot hedging model.",
                            "95% moving-block bootstrap is conditional on this strategy and sample, not proof of out-of-sample profitability.",
                            f"Terminal open positions: {1 if position else 0}; marked at settlement, with entry costs only and no artificial last-day liquidation."]}
