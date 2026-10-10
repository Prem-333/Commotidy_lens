import json
import sys
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'api'))
from app.db import read_quotes
from app.analytics import normalize, pair_snapshot, pair_series, annualized_carry
from app.backtest import run_backtest
from app.models import BacktestParams
from app.config import SPECS

frame = normalize(read_quotes('sample'))
day = frame.date.max()
month = '2026-10'
snapshot = frame[(frame.date == day) & (frame.expiry.dt.strftime('%Y-%m') == month)].copy()
signals = pair_snapshot(frame, day, month, 30, 2, 'sample')
history = pair_series(frame, 'GOLDM', 'GOLDTEN', month, 30)
backtest = run_backtest(frame, BacktestParams(month=month, to_date=day.date()), 'sample')
curve = frame[(frame.date == day) & (frame.contract == 'GOLDM')].sort_values('expiry')
def clean(v):
    if isinstance(v, dict): return {k: clean(x) for k,x in v.items()}
    if isinstance(v, list): return [clean(x) for x in v]
    if isinstance(v, (pd.Timestamp,)): return v.strftime('%Y-%m-%d')
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,float)): return float(v) if np.isfinite(v) else None
    if isinstance(v, (np.bool_,)): return bool(v)
    return v
data = clean({
    'rows': len(frame), 'dates': int(frame.date.nunique()), 'start': frame.date.min(), 'end': day,
    'specs': {k: s.model_dump() for k,s in SPECS.items()},
    'snapshot': snapshot[['contract','expiry','settle','per_gram','pure','volume','oi','grade','notional']].to_dict('records'),
    'signals': signals,
    'spreads': history[['date','spread','mean','std','z']].to_dict('records'),
    'backtest': backtest,
    'curve': curve[['expiry','pure','volume','oi']].to_dict('records'),
    'carry': annualized_carry(curve.iloc[0].pure,curve.iloc[1].pure,(curve.iloc[1].expiry-curve.iloc[0].expiry).days),
})
path = ROOT / 'tmp/pdfs/report_metrics.json'
path.write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps({k:data[k] for k in ['rows','dates','start','end','carry']},indent=2))
print(json.dumps(backtest['metrics'],indent=2))
print('Equity points:',len(backtest['equity']),'windows:',len(backtest['windows']))
print('First and final equity:',backtest['equity'][0],backtest['equity'][-1])
print('Last assumption:',backtest['assumptions'][-1])
