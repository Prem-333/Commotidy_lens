# Methodology and model boundaries

## Units and normalization

Contract specs are validated Pydantic objects loaded from `api/contracts.yaml`, never constants inside calculations. Defaults carry `verified: false`. The formulas are:

```text
price_per_gram = settlement / quote_unit_grams
fine_gold_per_gram = price_per_gram / purity
notional_per_lot = settlement * lot_size_grams / quote_unit_grams
```

Lot size changes exposure, not the quotation divisor. Prices are INR. Volume from the UDiFF field is lots; OI is preserved in source units and must be independently verified. Product versions change over time: this release has one configuration per symbol, not an effective-dated spec database. Imported-data research must be restricted to a period for which those settings are valid.

## Expiry alignment

The default month is the earliest observed unexpired month shared by all configured symbols, otherwise the earliest observed month. Comparisons use an explicit selected month. More than one expiry for a symbol on a date within that month is rejected as ambiguous.

When exact expiry dates differ, both prices are evaluated at the earlier expiry date. Linear interpolation is permitted only between bracketing observed expiries; no extrapolation. Unbracketed comparisons are omitted. Interpolated rows are research observations only, not qualified signals, and the backtester rejects them. Cross-location Gold Petal comparisons remain visible, but cannot qualify as trades. Fixed-expiry backtests avoid undocumented rolling-price series and artificial roll profits.

## Relative value

```text
spread_bps = (fine_A / fine_B - 1) * 10,000
mean_t = mean(spread[t-window : t])
std_t = sample_std(spread[t-window : t])
z_t = (spread_t - mean_t) / std_t
score = clip(z_t / 3 * 100, -100, 100)
```

The current observation never enters its own trailing baseline. Missing/zero-variance baselines produce an unavailable score, not an infinite signal. Percentile uses SciPy's `percentileofscore(..., kind='mean')` on the preceding window. The reverse heatmap cell is the negative canonical-pair score; it is explicitly not a separate inverse-ratio fit.

Qualification requires `abs(z) > threshold`, liquidity grade A/B on both legs, expected reversion above modeled round-trip costs, compatible location, exact expiry and operator-verified specs for imported records. Expected reversion is the absolute distance from the prior-window mean, **not a probabilistic forecast**. Significant but disqualified rows show BLOCKED. Below-threshold rows show FAIR. “CHEAP”/“RICH” are relative to the historical relationship, not a fundamental valuation.

## Liquidity and costs

```text
A: volume >= 1000 and OI >= 3000
B: volume >= 100 and OI >= 500
C: otherwise
slippage_per_side_bps = min(50, 1 + 30/sqrt(max(volume,1)) + 50/sqrt(max(OI,1)))
roundtrip_pair_bps = 4 * fees_per_leg_per_side + 2*(slippage_A + slippage_B)
```

Fees default to 1.5 bps per leg per side and aggregate brokerage, transaction charges, taxes and stamp duty. This is an illustrative aggregate, not a verified tariff. The backtest exposes that fee value and a cost toggle; disabling costs is explicitly labeled. Order size does not affect this illustrative liquidity proxy. This release does not estimate market depth or capacity.

## Carry and roll decomposition

```text
carry = (far / near - 1) * 365 / days_between_expiries
expected_roll_down = previous_observed_carry * days_elapsed / 365
actual_change = current_near / previous_same_near - 1
curve_shift = actual_change - expected_roll_down
```

This follows the brief's positive carry convention. It is not a full economic decomposition into spot moves, financing, convenience yield or a negative carry-down along a stationary contango curve. Use the residual descriptively. Prior and current calculations must share the same two expiries; otherwise decomposition is absent.

## Walk-forward replay and timing

Each test block fits the preceding `lookback` observations. Its mean and standard deviation remain frozen for `test_window` observations. No parameters are optimized or selected on test results. A close-of-session signal creates an order for the next observed session's open. Entry direction is opposite the spread z-score. Decisions and slippage at that next open use only the previous session's volume/OI. Missing opens or prior-session thin liquidity cancel entry orders. Exit orders wait for an available, eligible open, which can extend the requested maximum holding period.

Positions hold one initial INR notional on each leg, using fractional quantities. Price P&L in bps of **one leg's initial notional** is:

```text
direction * ((A_t / A_entry - 1) - (B_t / B_entry - 1)) * 10000
```

Slippage is booked as a negative execution cost, separate from raw open prices. Entry costs are charged when incurred; exit costs at exit. Open positions are marked to settlement each day. Terminal open positions remain open and are disclosed; they have entry costs only and no assumed terminal liquidation. They are not counted as closed trades. This keeps replay history invariant to truncating future data.

Sharpe uses daily net changes and sqrt(252), with zero risk-free rate. Net/gross bps are not margin returns or leveraged account returns. Drawdown includes the initial zero peak. Hit rate and average holding use closed trades; holding is in observed sessions. Turnover is leg-transaction count, not normalized capital turnover.

Confidence intervals use 500 fixed-seed moving-block bootstraps of daily net changes, with five-observation blocks. They are withheld below five closed trades or 20 daily observations. They are conditional on the sample and selected strategy; they do not incorporate strategy selection bias or prove a future edge.

## Import integrity

Supported headers are explicitly mapped. Dates must be ISO YYYY-MM-DD or use a named month, such as 28-Oct-2026; ambiguous numeric day/month strings are rejected. Actual expiry takes precedence with original expiry retained. Option rows with recognized option types or positive strike are excluded. Unsupported symbols are excluded. Supported rows require valid dates, positive finite settlement, nonnegative integral bounded volume/OI, nonexpired dates and nonfuture observations. Missing opens are allowed; provided opens must be positive and finite. Conflicting duplicate keys reject the file; identical duplicates are collapsed.

Imports use a single transaction, source/date/symbol/expiry uniqueness and SHA-256 file digests. Repeat uploads of identical bytes return the previous result. Changed files may update previously imported values; this release stores import digests and filenames but does not preserve a revision history for every corrected row. Historical experiments are therefore not immutable snapshots. Add versioned datasets before claiming regulatory-grade auditability.

## Explicit exclusions

No order routing, broker authentication, financial advice, automatic MCX download feed, streaming quotes, bid/ask spread measurements, order-book queue, margin model, lot-constrained portfolio, financing, delivery operations, exchange holiday service or data-license grant. There is no commercial billing or multi-user permissions service. A default fee or specification is never a substitute for verification.
