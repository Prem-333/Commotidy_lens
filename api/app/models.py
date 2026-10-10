from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class BacktestParams(StrictModel):
    pair: str = "GOLDM/GOLDTEN"
    month: str = Field(default="2026-10", pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    lookback: int = Field(default=30, ge=10, le=120)
    test_window: int = Field(default=10, ge=1, le=30)
    entry_z: float = Field(default=2, ge=.5, le=5)
    exit_z: float = Field(default=.5, ge=0, le=2)
    max_holding: int = Field(default=10, ge=1, le=60)
    fees_bps_per_leg: float = Field(default=1.5, ge=0, le=100)
    include_costs: bool = True
    from_date: date | None = None
    to_date: date | None = None
    @model_validator(mode="after")
    def thresholds(self):
        if self.exit_z >= self.entry_z:
            raise ValueError("Exit threshold must be below entry threshold")
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("from_date must not exceed to_date")
        return self

class ContractResponse(BaseModel):
    symbol: str
    name: str
    lot_size_grams: float
    quote_unit_grams: float
    purity: float
    location: str
    verified: bool
    expiry_cycle: str
    source: str

class HealthResponse(BaseModel):
    status: str
    source: Literal["sample", "imported"]
    rows: int
    dates: list[str]
    last_bhavcopy_date: str | None
    age_days: int | None
    specs_verified: bool
    warning: str

class NormalizedRow(BaseModel):
    contract: str
    expiry: str
    settle: float
    per_gram: float
    pure: float
    volume: int
    oi: int
    grade: str
    notional: float
    lot_size_grams: float
    quote_unit_grams: float
    purity: float
    location: str

class NormalizedResponse(BaseModel):
    source: str
    date: str
    month: str | None
    months: list[str]
    rows: list[NormalizedRow]

class Signal(BaseModel):
    pair: str
    a: str
    b: str
    spread_bps: float
    z: float | None
    percentile: float | None
    score: float
    grade: str
    cost_bps: float
    expected_bps: float
    verdict: str
    eligible: bool
    reasons: list[str]
    interpolated: bool

class SignalsResponse(BaseModel):
    source: str
    date: str
    month: str | None
    signals: list[Signal]

class SpreadPoint(BaseModel):
    date: str
    spread: float | None
    mean: float | None
    std: float | None
    z: float | None
    interpolated: bool

class SpreadResponse(BaseModel):
    source: str
    pair: str
    month: str
    points: list[SpreadPoint]

class CurvePoint(BaseModel):
    expiry: str
    pure: float
    volume: int
    oi: int
    grade: str

class TermResponse(BaseModel):
    source: str
    contract: str
    date: str
    points: list[CurvePoint]
    carry: float | None
    expected_roll_down: float | None
    curve_shift: float | None
    actual_change: float | None
    days_elapsed: int | None

class LiquidityPoint(BaseModel):
    date: str
    volume: int
    oi: int
    grade: str
    slippage_bps: float

class LiquidityResponse(BaseModel):
    source: str
    contract: str
    points: list[LiquidityPoint]

class EquityPoint(BaseModel):
    date: str
    gross: float
    net: float
    drawdown: float

class Trade(BaseModel):
    signal_date: str
    entry_date: str
    exit_date: str
    direction: str
    gross_bps: float
    cost_bps: float
    net_bps: float
    holding_days: int
    reason: str

class WalkWindow(BaseModel):
    train_start: str
    train_end: str
    test_start: str
    test_end: str

class BacktestMetrics(BaseModel):
    gross_bps: float
    net_bps: float
    sharpe: float | None
    hit_rate: float | None
    max_drawdown_bps: float
    avg_holding_days: float | None
    turnover_legs: int
    trades: int
    bootstrap_low_bps: float | None
    bootstrap_high_bps: float | None

class BacktestResponse(BaseModel):
    source: str
    params: BacktestParams
    metrics: BacktestMetrics
    equity: list[EquityPoint]
    trades: list[Trade]
    windows: list[WalkWindow]
    monthly: dict[str, float]
    warning: str
    assumptions: list[str]

class ImportResponse(BaseModel):
    rows: int
    duplicate: bool
    digest: str
