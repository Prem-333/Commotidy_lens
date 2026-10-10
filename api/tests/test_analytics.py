import numpy as np
import pandas as pd
import pytest
from app.analytics import normalize, rolling_statistics, annualized_carry, constant_maturity, pair_snapshot, pair_series, slippage_bps
from app.config import SPECS
from app.backtest import run_backtest
from app.models import BacktestParams

def test_normalization_uses_quote_unit_not_lot():
    frame = pd.DataFrame([{"contract": "GOLDM", "settle": 99500, "open": 99500, "volume": 1000, "oi": 3000}])
    actual = normalize(frame).iloc[0]
    assert actual.pure == pytest.approx(10000)
    assert actual.notional == 995000

@pytest.mark.parametrize("symbol", list(SPECS))
def test_normalization_equal_fine_gold(symbol):
    spec = SPECS[symbol]
    frame = pd.DataFrame([{"contract": symbol, "settle": 9000 * spec.quote_unit_grams * spec.purity, "open": np.nan, "volume": 20, "oi": 40}])
    assert normalize(frame).iloc[0].pure == pytest.approx(9000)

def test_prior_window_only():
    values = pd.Series([1., 2., 3., 4., 100.])
    result = rolling_statistics(values, 4)
    assert result.iloc[-1]["mean"] == pytest.approx(2.5)
    assert result.iloc[-1].z == pytest.approx((100 - 2.5) / np.std([1, 2, 3, 4], ddof=1))
    assert result.iloc[-1].percentile == 100
    assert result.iloc[:4].z.isna().all()

def test_zero_variance_does_not_create_a_signal():
    assert rolling_statistics(pd.Series([5.] * 40), 10).z.isna().all()

def test_carry_and_invalid_spacing():
    assert annualized_carry(100, 101, 30) == pytest.approx(.01 * 365 / 30)
    with pytest.raises(ValueError): annualized_carry(100, 101, 0)

def test_interpolate_no_extrapolation():
    curve = pd.DataFrame({"expiry": pd.to_datetime(["2026-10-01", "2026-10-31"]), "pure": [100., 130.]})
    assert constant_maturity(curve, pd.Timestamp("2026-10-16"))["pure"] == 115
    assert constant_maturity(curve, pd.Timestamp("2026-10-16"))["interpolated"]
    assert constant_maturity(curve, pd.Timestamp("2026-09-30")) is None

def test_slippage_penalizes_thin_markets():
    assert slippage_bps(10, 20) > slippage_bps(1000, 5000)

def test_imported_signals_require_verified_specs(sample):
    result = pair_snapshot(sample, pd.Timestamp("2026-10-09"), "2026-10", 30, .5, "imported")
    assert result
    assert not any(item["eligible"] for item in result)
    assert all("Contract specifications require operator verification" in item["reasons"] for item in result)

def test_unverified_imported_backtest_is_blocked(sample):
    with pytest.raises(ValueError, match="Verify contract specifications"):
        run_backtest(sample, BacktestParams(), "imported")

def test_disqualified_deviation_is_not_labeled_fair(sample):
    frame = sample.copy()
    day = pd.Timestamp("2026-10-09")
    frame.loc[(frame.date == day) & (frame.contract == "GOLDPETAL"), "pure"] *= 1.02
    result = pair_snapshot(frame, day, "2026-10", 30, 2, "sample")
    affected = [item for item in result if "GOLDPETAL" in item["pair"]]
    assert affected
    assert all(item["verdict"] == "BLOCKED" for item in affected)
    assert all(not item["eligible"] for item in affected)

def test_cross_location_never_passes(sample):
    result = pair_snapshot(sample, pd.Timestamp("2026-10-09"), "2026-10", 30, .5, "sample")
    assert all(not item["eligible"] for item in result if "GOLDPETAL" in item["pair"])

def test_future_prices_cannot_rewrite_history(sample):
    cutoff = pd.Timestamp("2026-09-15")
    altered = sample.copy()
    altered.loc[altered.date > cutoff, ["pure", "open_pure"]] *= 20
    baseline = run_backtest(sample, BacktestParams(entry_z=1.2, exit_z=.4), "sample")
    changed = run_backtest(altered, BacktestParams(entry_z=1.2, exit_z=.4), "sample")
    before = lambda result: [point for point in result["equity"] if point["date"] <= str(cutoff.date())]
    assert before(baseline) == before(changed)
    truncated = run_backtest(sample[sample.date <= cutoff], BacktestParams(entry_z=1.2, exit_z=.4), "sample")
    assert before(baseline) == truncated["equity"]

def test_next_session_entries_and_train_test_separation(sample):
    result = run_backtest(sample, BacktestParams(entry_z=1.2, exit_z=.4), "sample")
    assert result["trades"], "Fixture should exercise actual entries and exits"
    for trade in result["trades"]:
        assert trade["signal_date"] < trade["entry_date"] <= trade["exit_date"]
        assert trade["net_bps"] == pytest.approx(trade["gross_bps"] - trade["cost_bps"])
    for window in result["windows"]:
        assert window["train_end"] < window["test_start"]
    assert all(point["net"] <= point["gross"] + 1e-9 for point in result["equity"])

def test_missing_opens_prevent_fills(sample):
    frame = sample.copy()
    frame["open_pure"] = np.nan
    result = run_backtest(frame, BacktestParams(entry_z=.5, exit_z=.1), "sample")
    assert result["metrics"]["trades"] == 0
    assert result["metrics"]["net_bps"] == 0

def test_thin_days_prevent_entries(sample):
    frame = sample.copy()
    frame["grade"] = "C"
    result = run_backtest(frame, BacktestParams(entry_z=.5, exit_z=.1), "sample")
    assert result["metrics"]["trades"] == 0

def test_zero_cost_experiment(sample):
    result = run_backtest(sample, BacktestParams(include_costs=False, entry_z=1.2, exit_z=.4), "sample")
    assert result["metrics"]["gross_bps"] == result["metrics"]["net_bps"]

def test_same_date_price_uses_prior_statistics(sample):
    pair = pair_series(sample, "GOLDM", "GOLDTEN", "2026-10", 30)
    changed = sample.copy()
    changed.loc[(changed.date == pair.iloc[-1].date) & (changed.contract == "GOLDM"), "pure"] *= 2
    other = pair_series(changed, "GOLDM", "GOLDTEN", "2026-10", 30)
    assert pair.iloc[-1]["mean"] == other.iloc[-1]["mean"]
    assert pair.iloc[-1]["std"] == other.iloc[-1]["std"]
