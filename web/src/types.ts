export interface Health {
  status: string;
  source: 'sample' | 'imported';
  rows: number;
  dates: string[];
  last_bhavcopy_date: string | null;
  age_days: number | null;
  specs_verified: boolean;
  warning: string;
}
export interface Contract {
  symbol: string;
  name: string;
  lot_size_grams: number;
  quote_unit_grams: number;
  purity: number;
  location: string;
  verified: boolean;
  expiry_cycle: string;
  source: string;
}
export interface Quote {
  contract: string;
  expiry: string;
  settle: number;
  per_gram: number;
  pure: number;
  volume: number;
  oi: number;
  grade: string;
  notional: number;
  lot_size_grams: number;
  quote_unit_grams: number;
  purity: number;
  location: string;
}
export interface Normalized {
  source: string;
  date: string;
  month: string | null;
  months: string[];
  rows: Quote[];
}
export interface Signal {
  pair: string;
  a: string;
  b: string;
  spread_bps: number;
  z: number | null;
  percentile: number | null;
  score: number;
  grade: string;
  cost_bps: number;
  expected_bps: number;
  verdict: string;
  eligible: boolean;
  reasons: string[];
  interpolated: boolean;
}
export interface Signals {
  source: string;
  date: string;
  month: string | null;
  signals: Signal[];
}
export interface SpreadPoint {
  date: string;
  spread: number | null;
  mean: number | null;
  std: number | null;
  z: number | null;
  interpolated: boolean;
}
export interface Spreads {
  source: string;
  pair: string;
  month: string;
  points: SpreadPoint[];
}
export interface Curve {
  source: string;
  contract: string;
  date: string;
  points: { expiry: string; pure: number; volume: number; oi: number; grade: string }[];
  carry: number | null;
  expected_roll_down: number | null;
  curve_shift: number | null;
  actual_change: number | null;
  days_elapsed: number | null;
}
export interface Liquidity {
  source: string;
  contract: string;
  points: { date: string; volume: number; oi: number; grade: string; slippage_bps: number }[];
}
export interface Params {
  pair: string;
  month: string;
  lookback: number;
  test_window: number;
  entry_z: number;
  exit_z: number;
  max_holding: number;
  fees_bps_per_leg: number;
  include_costs: boolean;
  to_date?: string;
}
export interface Backtest {
  source: string;
  params: Params;
  metrics: {
    gross_bps: number;
    net_bps: number;
    sharpe: number | null;
    hit_rate: number | null;
    max_drawdown_bps: number;
    avg_holding_days: number | null;
    turnover_legs: number;
    trades: number;
    bootstrap_low_bps: number | null;
    bootstrap_high_bps: number | null;
  };
  equity: { date: string; gross: number; net: number; drawdown: number }[];
  trades: {
    signal_date: string;
    entry_date: string;
    exit_date: string;
    direction: string;
    gross_bps: number;
    cost_bps: number;
    net_bps: number;
    holding_days: number;
    reason: string;
  }[];
  windows: { train_start: string; train_end: string; test_start: string; test_end: string }[];
  monthly: Record<string, number>;
  warning: string;
  assumptions: string[];
}
