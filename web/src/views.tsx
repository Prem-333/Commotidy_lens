import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Download,
  FlaskConical,
  Info,
  Play,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Data } from 'plotly.js';
import type { ViewProps } from './App';
import type { Backtest, Contract, Curve, Liquidity, Params, Signal, Signals, Spreads } from './types';
import { api, colors, csv, dateLabel, money, number, symbols, usePreferences } from './lib';
import { Empty, ErrorState, Kpi, Loading, Method, Panel } from './components/Common';
import { Chart } from './components/Chart';
import { Button } from './components/ui/button';

function useSignals(props: ViewProps) {
  return useQuery({
    queryKey: ['signals', props.date, props.month],
    queryFn: ({ signal }) => api<Signals>(`/signals?date=${props.date}&month=${props.month}`, { signal }),
    enabled: !!props.date && !!props.month,
  });
}
function useCurve(props: ViewProps) {
  return useQuery({
    queryKey: ['curve', props.contract, props.date],
    queryFn: ({ signal }) =>
      api<Curve>(`/term-structure?contract=${props.contract}&date=${props.date}`, { signal }),
    enabled: !!props.date,
  });
}
function useSpreads(props: ViewProps) {
  return useQuery({
    queryKey: ['spreads', props.pair, props.month, props.date],
    queryFn: ({ signal }) =>
      api<Spreads>(`/spreads?pair=${encodeURIComponent(props.pair)}&month=${props.month}&to=${props.date}`, {
        signal,
      }),
    enabled: !!props.month && !!props.date,
  });
}
function ContractSelect({ contract, setFilter }: ViewProps) {
  return (
    <label className="inline-control">
      Contract
      <select aria-label="Contract" value={contract} onChange={(e) => setFilter('contract', e.target.value)}>
        {symbols.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}
function PairSelect({ pair, setFilter }: ViewProps) {
  return (
    <label className="inline-control">
      Compare
      <select aria-label="Contract pair" value={pair} onChange={(e) => setFilter('pair', e.target.value)}>
        {symbols.flatMap((a, i) =>
          symbols.slice(i + 1).map((b) => (
            <option key={`${a}/${b}`} value={`${a}/${b}`}>
              {a} / {b}
            </option>
          )),
        )}
      </select>
    </label>
  );
}
function SignalTable({ items }: { items: Signal[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>CONTRACT PAIR</th>
            <th title="Price ratio minus one, in basis points">SPREAD</th>
            <th title="Deviation from the preceding 30 observations">Z-SCORE</th>
            <th>PERCENTILE</th>
            <th>LIQUIDITY</th>
            <th>VERDICT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.pair}>
              <td>
                <strong>{item.a}</strong>
                <span className="muted"> / {item.b}</span>
                {item.interpolated && <small>Interpolated maturity</small>}
              </td>
              <td className="mono">
                {number(item.spread_bps)} <span className="muted">bps</span>
              </td>
              <td
                className={`mono ${item.z != null && item.z < 0 ? 'green-text' : item.z != null && item.z > 0 ? 'rose-text' : ''}`}
              >
                {number(item.z)}
              </td>
              <td className="mono">{number(item.percentile, 1)}%</td>
              <td>
                <span className={`grade grade-${item.grade}`}>{item.grade}</span>
              </td>
              <td>
                <span
                  title={item.reasons.join(' · ') || 'All research filters passed'}
                  className={`badge verdict-${item.verdict.toLowerCase()}`}
                >
                  {item.verdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <Empty
          text="No comparable contract pairs"
          detail="Select a month with observations for at least two contracts."
        />
      )}
    </div>
  );
}
function SpreadChart({ result, compact = false }: { result?: Spreads; compact?: boolean }) {
  if (!result?.points.length)
    return (
      <Panel title="Normalized spread">
        <Empty
          text="No spread observations"
          detail="Choose a pair and an expiry month with shared history."
        />
      </Panel>
    );
  const points = result.points;
  const x = points.map((p) => p.date);
  const band = (multiple: number) =>
    points.map((p) => (p.mean == null || p.std == null ? null : p.mean + multiple * p.std));
  const traces: Data[] = [
    {
      x,
      y: band(2),
      type: 'scatter',
      mode: 'lines',
      name: '+2σ',
      line: { color: '#bfa76833', width: 1 },
      hoverinfo: 'skip',
    },
    {
      x,
      y: band(-2),
      type: 'scatter',
      mode: 'lines',
      name: '−2σ',
      fill: 'tonexty',
      fillcolor: '#d2b76b0a',
      line: { color: '#bfa76833', width: 1 },
      hoverinfo: 'skip',
    },
    ...(!compact
      ? [
          {
            x,
            y: band(1),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: '+1σ',
            line: { color: '#bfa76845', width: 1, dash: 'dot' as const },
            hoverinfo: 'skip' as const,
          },
          {
            x,
            y: band(-1),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: '−1σ',
            line: { color: '#bfa76845', width: 1, dash: 'dot' as const },
            hoverinfo: 'skip' as const,
          },
        ]
      : []),
    {
      x,
      y: points.map((p) => p.mean),
      type: 'scatter',
      mode: 'lines',
      name: 'Trailing mean',
      line: { color: '#748094', width: 1, dash: 'dot' },
    },
    {
      x,
      y: points.map((p) => p.spread),
      type: 'scatter',
      mode: 'lines',
      name: 'Spread (bps)',
      line: { color: '#e6c66d', width: 2 },
      fill: 'none',
    },
    {
      x: points.filter((p) => p.z != null && Math.abs(p.z) > 2).map((p) => p.date),
      y: points.filter((p) => p.z != null && Math.abs(p.z) > 2).map((p) => p.spread),
      type: 'scatter',
      mode: 'markers',
      name: '|z| > 2 (statistical only)',
      marker: { color: '#ed9a9e', size: 5 },
    },
  ];
  return (
    <Chart
      title="Normalized spread"
      subtitle={`${result.pair.replace('/', ' / ')} · ${result.month} · basis points · ${result.source} data`}
      data={traces}
      height={compact ? 288 : 380}
      layout={{
        xaxis: { gridcolor: '#80808012', rangeslider: { visible: !compact, thickness: 0.13 } },
        yaxis: { gridcolor: '#80808018', zerolinecolor: '#80808035', ticksuffix: ' bp' },
      }}
      exportRows={points.map((p) => ({
        source: result.source,
        pair: result.pair,
        month: result.month,
        ...p,
      }))}
    />
  );
}

export function Overview(props: ViewProps) {
  const signals = useSignals(props);
  const spread = useSpreads(props);
  const curve = useCurve(props);
  if (signals.isError) return <ErrorState error={signals.error} retry={() => signals.refetch()} />;
  if (!props.normalized || signals.isPending) return <Loading />;
  const items = signals.data.signals;
  const active = items.filter((s) => s.eligible);
  const widest = items.reduce(
    (best, s) => (Math.abs(s.spread_bps) > Math.abs(best?.spread_bps ?? 0) ? s : best),
    items[0],
  );
  const liquid = props.normalized.rows.reduce(
    (best, q) => (q.volume > (best?.volume ?? -1) ? q : best),
    props.normalized.rows[0],
  );
  return (
    <>
      <div className="kpi-strip">
        <Kpi
          label="ACTIVE SIGNALS"
          value={active.length.toString().padStart(2, '0')}
          detail="Cleared cost & liquidity filters"
          tone="gold-text"
          tip="A signal needs |z| > 2, liquidity grade A/B, compatible delivery basis and reversion larger than costs."
        />
        <Kpi
          label="WIDEST DISLOCATION"
          value={
            <>
              {number(Math.abs(widest?.spread_bps ?? 0), 1)}
              <em>bps</em>
            </>
          }
          detail={widest?.pair.replace('/', ' / ') || 'No matched observations'}
          tip="Largest absolute normalized price spread across the selected expiry month."
        />
        <Kpi
          label="MOST LIQUID"
          value={liquid?.contract || '—'}
          detail={`${number(liquid?.volume, 0)} lots traded`}
          tip="Highest daily futures volume among the displayed contracts. Volumes are lots, not grams."
        />
        <Kpi
          label="CURVE SHAPE"
          value={curve.data?.carry == null ? '—' : curve.data.carry > 0 ? 'Contango' : 'Backwardation'}
          detail={`${number(curve.data?.carry == null ? null : curve.data.carry * 100)}% annualized carry · ${props.contract}`}
          tip="Carry between the nearest two observed expiries, scaled by calendar-day spacing."
        />
        <Kpi
          label="DATA HEALTH"
          value={
            props.health?.source === 'sample'
              ? 'Sample'
              : props.health?.specs_verified
                ? 'Verified specs'
                : 'Review specs'
          }
          detail={
            props.health?.source === 'sample'
              ? 'Clearly labeled · reproducible'
              : `${props.health?.age_days ?? '—'} days since latest data`
          }
          tone="green-text"
          tip="Imported EOD records do not imply live data. Contract verification and data freshness are distinct."
        />
      </div>
      <div className="section-heading">
        <div>
          <h2>
            Contract snapshot <span className="badge">{props.month}</span>
          </h2>
          <p>Different contracts. A common pure-gold basis.</p>
        </div>
        <Link className="text-link" to={`/app/normalizer?date=${props.date}&month=${props.month}`}>
          Explore normalization
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="contract-cards">
        {props.normalized.rows.map((q, index) => (
          <div className="contract-card" key={q.contract}>
            <div className="contract-card-top">
              <span
                className="contract-symbol"
                style={{ '--contract-color': colors[index % 4] } as React.CSSProperties}
              >
                <i />
                {q.contract}
              </span>
              <span className={`grade grade-${q.grade}`} title={`Liquidity grade ${q.grade}`}>
                {q.grade}
              </span>
            </div>
            <div className="contract-price">
              {money(q.pure)}
              <small>/ fine g</small>
            </div>
            <div className="contract-raw">
              Quoted {money(q.settle)} <span>/ {q.quote_unit_grams}g</span>
            </div>
            <div className="contract-card-bottom">
              <span>
                {q.lot_size_grams}g lot · {q.purity * 1000} purity
              </span>
              <span>{q.location}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <div>
          {spread.isError ? (
            <ErrorState error={spread.error} />
          ) : (
            <SpreadChart result={spread.data} compact />
          )}
        </div>
        <Panel
          title="Signal radar"
          subtitle="Conviction earns its place."
          action={<span className="badge badge-gold">{active.length} qualified</span>}
        >
          {active.length ? (
            active.map((item) => (
              <div className="radar-card" key={item.pair}>
                <div>
                  <span className={`badge verdict-${item.verdict.toLowerCase()}`}>{item.verdict}</span>
                  <span className="mono">{number(item.z)}σ</span>
                </div>
                <h4>
                  {item.a}
                  <span> / {item.b}</span>
                </h4>
                <div className="gauge">
                  <i style={{ left: `${(item.score + 100) / 2}%` }} />
                </div>
                <div className="gauge-labels">
                  <span>CHEAP</span>
                  <strong>{number(item.score, 0)}</strong>
                  <span>RICH</span>
                </div>
                <p>
                  Expected {number(item.expected_bps, 1)} bp · modeled cost {number(item.cost_bps, 1)} bp
                </p>
              </div>
            ))
          ) : items.some((item) => item.verdict === 'BLOCKED') ? (
            <Empty
              text="No pair clears every filter."
              detail="A deviation exists, but costs, liquidity or comparability block a qualified signal."
            />
          ) : (
            <Empty />
          )}
          <div className="panel-footnote">
            <ShieldCheck size={14} />
            Statistical interest is not execution certainty.
          </div>
        </Panel>
      </div>
      <Panel
        title="Relative value monitor"
        subtitle="All pairs, including those that do not qualify."
        action={
          <Link className="text-link" to={`/app/relative-value?date=${props.date}&month=${props.month}`}>
            View analysis
            <ArrowRight size={14} />
          </Link>
        }
      >
        <SignalTable items={items} />
      </Panel>
      <Method>
        <p>
          All cards use the selected date and expiry month. Price per fine gram = settlement ÷ quotation grams
          ÷ purity. Z-scores use only the preceding 30 observations. A qualified signal also requires
          compatible delivery location, exact maturity, sufficient liquidity and expected reversion above
          estimated round-trip costs.
        </p>
        <p>
          Sample signals are hypothetical. Imported signals remain disabled until specifications have been
          verified by the operator. Missing or unbracketed maturities are omitted, never extrapolated.
        </p>
      </Method>
    </>
  );
}

export function Normalizer(props: ViewProps) {
  if (!props.normalized) return <Loading />;
  const rows = props.normalized.rows;
  return (
    <>
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <strong>Every transformation, in the open.</strong>
          <p>
            Lot size defines exposure. Quotation size defines the price divisor. They are not interchangeable.
          </p>
        </div>
      </div>
      <div className="normalizer-grid">
        {rows.map((q, i) => (
          <Panel
            key={q.contract}
            title={q.contract}
            subtitle={`${q.lot_size_grams}g trading lot · ${q.location}`}
            action={<span className="contract-dot" style={{ background: colors[i % 4] }} />}
          >
            <div className="normalizer-steps">
              <div>
                <span>01</span>
                <p>
                  Exchange settlement<small>INR per quotation unit</small>
                </p>
                <strong>{money(q.settle)}</strong>
              </div>
              <div>
                <span>02</span>
                <p>
                  Quotation basis<small>{q.quote_unit_grams}g · divide the quote</small>
                </p>
                <strong>÷ {number(q.quote_unit_grams, 0)}</strong>
              </div>
              <div>
                <span>03</span>
                <p>
                  Gold per gram<small>Before purity adjustment</small>
                </p>
                <strong>{money(q.per_gram)}</strong>
              </div>
              <div>
                <span>04</span>
                <p>
                  Purity adjustment<small>{q.purity * 1000} fineness</small>
                </p>
                <strong>÷ {q.purity}</strong>
              </div>
              <div className="normalized-result">
                <span>
                  <CheckCircle2 size={18} />
                </span>
                <p>
                  Pure gold<small>INR per fine gram</small>
                </p>
                <strong>{money(q.pure)}</strong>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <Chart
        title="A comparable basis"
        subtitle={`INR per fine gram · ${props.month} · ${props.health?.source} data`}
        data={[
          {
            x: rows.map((q) => q.contract),
            y: rows.map((q) => q.pure),
            type: 'bar',
            marker: { color: colors },
            width: 0.45,
          },
        ]}
        exportRows={rows.map((q) => ({ source: props.health?.source, date: props.date, ...q }))}
      />
      <Method>
        <p>
          Per-gram price = settlement / quote_unit_grams. Fine-gold price = per-gram price / purity_fraction.
          Contract defaults live in contracts.yaml and require official specification verification. Exposure
          per lot = settlement × lot_size_grams / quote_unit_grams.
        </p>
        <p>
          Purity normalization does not remove delivery location, duties, delivery options, or exact expiry
          differences. Gold Petal’s Mumbai delivery basis differs from Ahmedabad contracts. Compare its prices
          as research context, not a risk-free arbitrage.
        </p>
      </Method>
    </>
  );
}

export function RelativeValue(props: ViewProps) {
  const signals = useSignals(props);
  const spread = useSpreads(props);
  if (signals.isError || spread.isError) return <ErrorState error={(signals.error || spread.error)!} />;
  if (!signals.data || !spread.data) return <Loading />;
  const matrix = symbols.map((a) =>
    symbols.map((b) => {
      if (a === b) return 0;
      const direct = signals.data.signals.find((s) => s.a === a && s.b === b);
      const inverse = signals.data.signals.find((s) => s.a === b && s.b === a);
      return direct?.z ?? (inverse?.z != null ? -inverse.z : null);
    }),
  );
  return (
    <>
      <div className="view-toolbar">
        <PairSelect {...props} />
        <span className="muted">30 observations · prior-data baseline · ±1σ / ±2σ bands</span>
      </div>
      <SpreadChart result={spread.data} />
      <div className="two-columns">
        <Chart
          title="Pairwise deviation"
          subtitle="Z-score · reverse cells show the negative canonical-pair z-score"
          height={330}
          data={[
            {
              type: 'heatmap',
              x: symbols,
              y: symbols,
              z: matrix,
              zmin: -3,
              zmax: 3,
              colorscale: [
                [0, '#217663'],
                [0.5, '#18202d'],
                [1, '#a75160'],
              ],
              showscale: true,
              xgap: 5,
              ygap: 5,
              text: matrix.map((row) => row.map((v) => number(v))) as unknown as string[],
              texttemplate: '%{text}',
              textfont: { color: '#ffffff', size: 14 },
              hovertemplate: '%{y} / %{x}<br>z: %{z:.2f}<extra></extra>',
            },
          ]}
          layout={{ margin: { l: 102, r: 45, t: 20, b: 60 }, yaxis: { autorange: 'reversed' } }}
          exportRows={signals.data.signals.map((s) => ({
            source: signals.data.source,
            date: props.date,
            ...s,
            reasons: s.reasons.join('; '),
          }))}
        />
        <Panel title="The qualification hurdle" subtitle="A deviation must survive all four checks.">
          <div className="hurdle-list">
            {[
              ['01', 'Statistical significance', '|z| > 2 against a prior-data baseline.'],
              ['02', 'Room after costs', 'Expected reversion exceeds fees and slippage.'],
              ['03', 'Enough liquidity', 'At least 100 lots and 500 reported OI units per leg.'],
              ['04', 'Comparable delivery', 'Compatible location, exact expiry, verified specifications.'],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="All contract pairs" subtitle="Hover over a verdict to inspect the reasons behind it.">
        <SignalTable items={signals.data.signals} />
      </Panel>
      <Method>
        <p>
          Spread = (fine-gold price A / fine-gold price B − 1) × 10,000. Z = (current spread − prior-window
          mean) / prior-window sample standard deviation. Percentile ranks today against the prior window.
          Score = clip(z / 3 × 100, −100, +100); negative means cheap versus the historical relationship.
        </p>
        <p>
          For mismatched expiry dates within a month, prices are interpolated to a common date only when
          bracketed by observed expiries. These observations are flagged and excluded from trade signals.
          Chart markers indicate statistical excursions only; they do not imply all signal filters passed.
          Heatmap reverse cells are signed canonical scores, not separately fitted inverse-ratio series.
        </p>
      </Method>
    </>
  );
}

export function TermStructure(props: ViewProps) {
  const curve = useCurve(props);
  if (curve.isError) return <ErrorState error={curve.error} />;
  if (!curve.data) return <Loading />;
  const result = curve.data;
  const dates = props.health?.dates || [];
  return (
    <>
      <div className="view-toolbar">
        <ContractSelect {...props} />
        <span className="badge">{result.points.length} observed expiries</span>
      </div>
      <div className="kpi-strip four">
        <Kpi
          label="ANNUALIZED CARRY"
          value={`${number(result.carry == null ? null : result.carry * 100)}%`}
          detail="Nearest two expiries"
          tip="(F_far/F_near − 1) × 365 / days between expiries."
        />
        <Kpi
          label="ACTUAL CHANGE"
          value={`${number(result.actual_change == null ? null : result.actual_change * 10000)} bp`}
          detail="Same near expiry vs prior observation"
          tip="Relative near-contract price change between adjacent observation dates."
        />
        <Kpi
          label="EXPECTED ROLL-DOWN"
          value={`${number(result.expected_roll_down == null ? null : result.expected_roll_down * 10000)} bp`}
          detail={`${result.days_elapsed ?? '—'} calendar days elapsed`}
          tip="Previous observed carry × elapsed days / 365, using the brief's positive carry convention."
        />
        <Kpi
          label="RESIDUAL CURVE SHIFT"
          value={`${number(result.curve_shift == null ? null : result.curve_shift * 10000)} bp`}
          detail="Actual change less expected roll"
          tip="Model residual, not a causal attribution of the price move."
        />
      </div>
      <Chart
        title={`${props.contract} forward curve`}
        subtitle={`INR per fine gram · ${dateLabel(props.date)} · ${result.source} data`}
        height={370}
        data={[
          {
            x: result.points.map((p) => p.expiry),
            y: result.points.map((p) => p.pure),
            mode: 'lines+markers',
            type: 'scatter',
            line: { color: '#e6c66d', width: 3 },
            marker: { size: 8, color: '#e6c66d' },
            name: 'Fine-gold price',
          },
        ]}
        exportRows={result.points.map((p) => ({
          source: result.source,
          date: result.date,
          contract: result.contract,
          ...p,
        }))}
      />
      <div className="timeline-control">
        <label htmlFor="history-slider">
          EXPLORE THE CURVE THROUGH TIME <strong>{dateLabel(props.date)}</strong>
        </label>
        <input
          id="history-slider"
          type="range"
          min={0}
          max={Math.max(0, dates.length - 1)}
          value={Math.max(0, dates.indexOf(props.date))}
          onChange={(e) => props.setFilter('date', dates[Number(e.target.value)])}
        />
        <div>
          <span>{dates[0]}</span>
          <span>{dates.at(-1)}</span>
        </div>
      </div>
      <Panel title="Expiry ladder">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EXPIRY</th>
                <th>FINE GOLD / GRAM</th>
                <th>VOLUME · LOTS</th>
                <th>OPEN INTEREST</th>
                <th>LIQUIDITY</th>
              </tr>
            </thead>
            <tbody>
              {result.points.map((p) => (
                <tr key={p.expiry}>
                  <td>{dateLabel(p.expiry)}</td>
                  <td className="mono">{money(p.pure)}</td>
                  <td className="mono">{number(p.volume, 0)}</td>
                  <td className="mono">{number(p.oi, 0)}</td>
                  <td>
                    <span className={`grade grade-${p.grade}`}>{p.grade}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Method>
        <p>
          Annualized carry = (far / near − 1) × 365 / expiry-day spacing. Expected roll-down = previous carry
          × elapsed calendar days / 365. Residual shift = actual near-contract relative price change −
          expected roll-down. This follows the requested positive-carry convention; it is an accounting
          decomposition, not a full economic roll-return model.
        </p>
        <p>
          Decomposition uses identical expiries across the current and previous observations. When either leg
          is missing, the decomposition is unavailable. Listed expiries and curves come exclusively from the
          selected dataset.
        </p>
      </Method>
    </>
  );
}

export function BacktestLab(props: ViewProps) {
  const [search] = useSearchParams();
  const numeric = (key: string, fallback: number) => {
    const v = Number(search.get(key));
    return search.has(key) && Number.isFinite(v) ? v : fallback;
  };
  const params: Params = {
    pair: props.pair,
    month: props.month,
    lookback: numeric('lookback', 30),
    test_window: numeric('test_window', 10),
    entry_z: numeric('entry_z', 2),
    exit_z: numeric('exit_z', 0.5),
    max_holding: numeric('max_holding', 10),
    fees_bps_per_leg: numeric('fees', 1.5),
    include_costs: search.get('costs') !== 'off',
    to_date: props.date || undefined,
  };
  const run = useMutation({
    mutationFn: (parameters: Params) =>
      api<Backtest>('/backtest', { method: 'POST', body: JSON.stringify(parameters) }),
    onSuccess: () => toast.success('Walk-forward replay completed'),
    onError: (e: Error) => toast.error(e.message),
  });
  const result = run.data;
  const changed = !!result && JSON.stringify(params) !== JSON.stringify(run.variables);
  return (
    <>
      <div className="backtest-controls panel">
        <div className="controls-title">
          <FlaskConical size={19} />
          <div>
            <h3>Define your experiment</h3>
            <p>Every test runs on unseen observations.</p>
          </div>
        </div>
        <div className="control-grid">
          <PairSelect {...props} />
          {[
            { key: 'lookback', label: 'Training window', value: params.lookback, min: 10, max: 120, step: 1 },
            { key: 'test_window', label: 'Test window', value: params.test_window, min: 1, max: 30, step: 1 },
            { key: 'entry_z', label: 'Entry z-score', value: params.entry_z, min: 0.5, max: 5, step: 0.1 },
            { key: 'exit_z', label: 'Exit z-score', value: params.exit_z, min: 0, max: 2, step: 0.1 },
            {
              key: 'max_holding',
              label: 'Max holding sessions',
              value: params.max_holding,
              min: 1,
              max: 60,
              step: 1,
            },
            {
              key: 'fees',
              label: 'Fees · bp / leg / side',
              value: params.fees_bps_per_leg,
              min: 0,
              max: 100,
              step: 0.1,
            },
          ].map((control) => (
            <label key={control.key}>
              {control.label}
              <input
                type="number"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                onChange={(e) => props.setFilter(control.key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="controls-bottom">
          <label className="check-label">
            <input
              type="checkbox"
              checked={params.include_costs}
              onChange={(e) => props.setFilter('costs', e.target.checked ? 'on' : 'off')}
            />{' '}
            Include fees, taxes & liquidity-based slippage
          </label>
          <Button onClick={() => run.mutate(params)} disabled={run.isPending || !props.month}>
            <Play size={14} />
            {run.isPending ? 'Replaying sessions…' : 'Run walk-forward test'}
          </Button>
        </div>
      </div>
      {!params.include_costs && (
        <div className="notice warning">
          <Info size={18} />
          <p>Cost-free experiment. Net equals gross; this run cannot establish an edge after costs.</p>
        </div>
      )}
      {run.isError && <ErrorState error={run.error} />}
      {run.isPending && <Loading />}
      {changed && (
        <div className="notice warning">
          Parameters changed. Results below belong to the previous run; run again to update.
        </div>
      )}
      {result && !run.isPending ? (
        <>
          <div className="notice">
            <ShieldCheck size={19} />
            <div>
              <strong>{result.warning}</strong>
              <p>
                {result.source === 'sample'
                  ? 'Synthetic sample · hypothetical research results'
                  : 'Imported EOD · simulated fills'}{' '}
                · basis points of one-leg notional · {result.params.pair}
              </p>
            </div>
          </div>
          <div className="kpi-strip">
            <Kpi
              label="NET P&L"
              value={`${number(result.metrics.net_bps)} bp`}
              detail={`Gross ${number(result.metrics.gross_bps)} bp`}
              tone={result.metrics.net_bps >= 0 ? 'green-text' : 'rose-text'}
              tip="Realized and settlement-marked P&L less incurred modeled costs, relative to one leg's notional."
            />
            <Kpi
              label="SHARPE"
              value={number(result.metrics.sharpe)}
              detail="Daily returns · √252 annualization"
              tip="Sample mean daily strategy change divided by sample standard deviation, annualized; no risk-free adjustment."
            />
            <Kpi
              label="HIT RATE"
              value={`${number(result.metrics.hit_rate == null ? null : result.metrics.hit_rate * 100, 1)}%`}
              detail={`${result.metrics.trades} closed trades`}
              tip="Fraction of closed trades with positive net P&L."
            />
            <Kpi
              label="MAX DRAWDOWN"
              value={`${number(result.metrics.max_drawdown_bps)} bp`}
              detail="Daily mark-to-market"
              tone="rose-text"
              tip="Largest decline from the running peak, including zero as the initial peak."
            />
            <Kpi
              label="AVG HOLDING"
              value={`${number(result.metrics.avg_holding_days, 1)} d`}
              detail={`${result.metrics.turnover_legs} leg transactions`}
              tip="Mean closed-trade holding period in observed sessions. Turnover is count of leg transactions, not capital turnover."
            />
          </div>
          <Chart
            title="Gross promise. Net reality."
            subtitle={`Cumulative P&L · one-leg notional bps · ${result.source} data`}
            height={340}
            data={[
              {
                x: result.equity.map((p) => p.date),
                y: result.equity.map((p) => p.gross),
                type: 'scatter',
                mode: 'lines',
                name: 'Gross',
                line: { color: '#728099', dash: 'dot', width: 2 },
              },
              {
                x: result.equity.map((p) => p.date),
                y: result.equity.map((p) => p.net),
                type: 'scatter',
                mode: 'lines',
                name: 'Net of costs',
                line: { color: '#e6c66d', width: 2.5 },
              },
            ]}
            layout={{ showlegend: true, legend: { orientation: 'h', x: 0, y: 1.15 } }}
            exportRows={result.equity.map((p) => ({ source: result.source, pair: result.params.pair, ...p }))}
          />
          <div className="two-columns">
            <Chart
              title="Drawdown"
              subtitle="Basis points below the running net peak"
              height={250}
              data={[
                {
                  x: result.equity.map((p) => p.date),
                  y: result.equity.map((p) => p.drawdown),
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tozeroy',
                  fillcolor: '#f28b9a18',
                  line: { color: '#ed8997', width: 1.5 },
                },
              ]}
              exportRows={result.equity.map((p) => ({ date: p.date, drawdown_bps: p.drawdown }))}
            />
            <Panel title="Monthly net changes" subtitle="Basis points of one-leg notional">
              <div className="monthly-grid">
                {Object.entries(result.monthly).map(([month, value]) => (
                  <div key={month} className={value >= 0 ? 'positive' : 'negative'}>
                    <span>{month}</span>
                    <strong>
                      {number(value)}
                      <small> bp</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="bootstrap">
                <span>95% block-bootstrap interval</span>
                <strong>
                  {number(result.metrics.bootstrap_low_bps)} to {number(result.metrics.bootstrap_high_bps)} bp
                </strong>
                <p>
                  {result.metrics.bootstrap_low_bps == null
                    ? 'At least 5 closed trades and 20 daily observations are needed.'
                    : 'Conditional on this strategy and dataset. Not a profitability guarantee.'}
                </p>
              </div>
            </Panel>
          </div>
          <Panel
            title="Walk-forward windows"
            subtitle="Training observations precede every frozen test block."
          >
            <div className="walk-forward">
              {result.windows.map((w, i) => (
                <div key={w.test_start}>
                  <span>Fold {String(i + 1).padStart(2, '0')}</span>
                  <span className="train-window">
                    Train {w.train_start} → {w.train_end}
                  </span>
                  <ArrowRight size={13} />
                  <span className="test-window">
                    Unseen {w.test_start} → {w.test_end}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Trade ledger"
            subtitle="Orders fill after the signal session; modeled slippage is charged as an explicit cost."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  csv(
                    'commoditylens-trades',
                    result.trades.map((t) => ({ source: result.source, pair: result.params.pair, ...t })),
                  )
                }
              >
                <Download size={14} />
                CSV
              </Button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SIGNAL</th>
                    <th>ENTRY</th>
                    <th>EXIT</th>
                    <th>DIRECTION</th>
                    <th>GROSS BP</th>
                    <th>COST BP</th>
                    <th>NET BP</th>
                    <th>EXIT REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i}>
                      <td>{t.signal_date}</td>
                      <td>{t.entry_date}</td>
                      <td>{t.exit_date}</td>
                      <td>{t.direction}</td>
                      <td className="mono">{number(t.gross_bps)}</td>
                      <td className="mono">{number(t.cost_bps)}</td>
                      <td className={`mono ${t.net_bps >= 0 ? 'green-text' : 'rose-text'}`}>
                        {number(t.net_bps)}
                      </td>
                      <td>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!result.trades.length && (
                <Empty
                  text="No closed trades in this experiment"
                  detail="No qualifying entries, or a position remains open at the end of the sample."
                />
              )}
            </div>
          </Panel>
          <Method>
            {result.assumptions.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </Method>
        </>
      ) : (
        !run.isPending && (
          <>
            <Panel title="Your next hypothesis starts here">
              <Empty
                text="Make the market prove it."
                detail="Choose a comparable pair and run the experiment. No results are prefilled."
              />
            </Panel>
            <Method>
              <p>
                The model fits a trailing training window, freezes its mean and standard deviation, and
                replays the next unseen block. Orders use the next observed open; missing prices and thin
                liquidity can prevent fills. Costs are explicit, configurable assumptions. Statistical results
                are research evidence, not trade recommendations.
              </p>
            </Method>
          </>
        )
      )}
    </>
  );
}

export function LiquidityView(props: ViewProps) {
  const query = useQuery({
    queryKey: ['liquidity', props.contract, props.month, props.date],
    queryFn: ({ signal }) =>
      api<Liquidity>(`/liquidity?contract=${props.contract}&month=${props.month}&date=${props.date}`, {
        signal,
      }),
    enabled: !!props.date && !!props.month,
  });
  if (query.isError) return <ErrorState error={query.error} />;
  if (!query.data) return <Loading />;
  const points = query.data.points;
  const latest = points.at(-1);
  const thin = points.filter((p) => p.grade === 'C');
  return (
    <>
      <div className="view-toolbar">
        <ContractSelect {...props} />
        <span className="muted">Selected expiry month · up to 120 observations</span>
      </div>
      <div className="kpi-strip four">
        <Kpi
          label="DAILY VOLUME"
          value={number(latest?.volume, 0)}
          detail="Contracts traded · lots"
          tip="Reported traded quantity in lots; it is not physical grams or rupee turnover."
        />
        <Kpi
          label="OPEN INTEREST"
          value={number(latest?.oi, 0)}
          detail="Reported source units"
          tip="Source OI units require operator validation against the file specification."
        />
        <Kpi
          label="ESTIMATED SLIPPAGE"
          value={`${number(latest?.slippage_bps)} bp`}
          detail="Per leg · per side"
          tip="min(50, 1 + 30 / sqrt(volume) + 50 / sqrt(OI)). An illustrative impact assumption, not a measured bid/ask spread."
        />
        <Kpi
          label="THIN OBSERVATIONS"
          value={thin.length}
          detail={`${points.length} sessions evaluated`}
          tone="gold-text"
          tip="Volume below 100 lots or reported OI below 500 units."
        />
      </div>
      <Chart
        title="Participation over time"
        subtitle={`${props.contract} · volume in lots · ${query.data.source} data`}
        data={[
          {
            x: points.map((p) => p.date),
            y: points.map((p) => p.volume),
            type: 'bar',
            marker: { color: points.map((p) => (p.grade === 'C' ? '#ed8997' : '#c9a24b')) },
            name: 'Volume',
          },
        ]}
        exportRows={points.map((p) => ({
          source: query.data.source,
          contract: props.contract,
          month: props.month,
          ...p,
        }))}
      />
      <Chart
        title="Open interest"
        subtitle="Reported source units · not a substitute for order-book depth"
        height={250}
        data={[
          {
            x: points.map((p) => p.date),
            y: points.map((p) => p.oi),
            type: 'scatter',
            mode: 'lines',
            line: { color: '#83b9ed', width: 2 },
            fill: 'tozeroy',
            fillcolor: '#83b9ed0b',
          },
        ]}
        exportRows={points.map((p) => ({ source: query.data.source, contract: props.contract, ...p }))}
      />
      <div className="notice warning">
        <Info size={20} />
        <div>
          <strong>Settlement price is not an execution price.</strong>
          <p>
            Settlement anchors the daily comparison. An actual fill depends on spreads, depth, order size and
            timing. Backtests use next-session opens plus a modeled cost; they do not certify that a trade was
            available.
          </p>
        </div>
      </div>
      <Panel title="Thin-day flags" subtitle="Sessions that would fail the research liquidity filter.">
        {thin.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>VOLUME</th>
                  <th>OPEN INTEREST</th>
                  <th>MODELED SLIPPAGE</th>
                </tr>
              </thead>
              <tbody>
                {thin.map((p) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{number(p.volume, 0)}</td>
                    <td>{number(p.oi, 0)}</td>
                    <td>{number(p.slippage_bps)} bp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text="No thin observations in this window"
            detail="Passing an end-of-day filter does not guarantee intraday execution."
          />
        )}
      </Panel>
      <Method>
        <p>
          Grade A: volume ≥ 1,000 and OI ≥ 3,000. Grade B: volume ≥ 100 and OI ≥ 500. Grade C: all other
          observations. Slippage per side = min(50, 1 + 30/√max(volume,1) + 50/√max(OI,1)) bps.
        </p>
        <p>
          Signal cost = four fee charges of 1.5 bp plus two slippage charges per contract. Backtest fee
          assumptions are separately configurable and aggregate brokerage, exchange charges, taxes and stamp
          duties. They must be calibrated to an actual broker and trade type.
        </p>
      </Method>
    </>
  );
}

export function Explorer(props: ViewProps) {
  const specs = useQuery({
    queryKey: ['contracts'],
    queryFn: ({ signal }) => api<Contract[]>('/contracts', { signal }),
  });
  const curve = useCurve(props);
  if (specs.isError || curve.isError) return <ErrorState error={(specs.error || curve.error)!} />;
  if (!specs.data || !curve.data) return <Loading />;
  const selected = specs.data.find((s) => s.symbol === props.contract);
  return (
    <>
      <div className="view-toolbar">
        <ContractSelect {...props} />
        <span className="badge badge-gold">Verify official specifications before real-data use</span>
      </div>
      <div className="contract-spec-grid">
        {specs.data.map((spec, index) => (
          <Panel
            key={spec.symbol}
            title={spec.name}
            subtitle={spec.symbol}
            action={<span className="contract-dot" style={{ background: colors[index] }} />}
          >
            <dl className="spec-list">
              <div>
                <dt>Trading lot</dt>
                <dd>{spec.lot_size_grams} grams</dd>
              </div>
              <div>
                <dt>Quotation unit</dt>
                <dd>₹ per {spec.quote_unit_grams}g</dd>
              </div>
              <div>
                <dt>Purity</dt>
                <dd>{spec.purity * 1000} fineness</dd>
              </div>
              <div>
                <dt>Delivery basis</dt>
                <dd>{spec.location}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd className={spec.verified ? 'green-text' : 'gold-text'}>
                  {spec.verified ? 'Operator verified' : 'Pending'}
                </dd>
              </div>
            </dl>
            <a className="spec-link" href={spec.source} target="_blank" rel="noreferrer">
              Official MCX specification
              <ArrowUpRight size={14} />
            </a>
          </Panel>
        ))}
      </div>
      <Panel
        title={`${selected?.name} · contract lifecycle`}
        subtitle="Conceptual phases; listing, peak and roll dates are not inferred from synthetic fixtures."
      >
        <div className="lifecycle">
          {[
            ['Listing', 'Contract becomes available'],
            ['Liquidity builds', 'Participation concentrates'],
            ['Roll period', 'Exposure migrates forward'],
            ['Expiry', 'Delivery obligations apply'],
          ].map(([label, caption], i) => (
            <div key={label}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <strong>{label}</strong>
              <p>{caption}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Observed expiries" subtitle={`${props.contract} · available on ${props.date}`}>
        <div className="expiry-cards">
          {curve.data.points.map((p) => (
            <div key={p.expiry}>
              <span>{dateLabel(p.expiry)}</span>
              <strong>
                {money(p.pure)} <small>/ fine g</small>
              </strong>
              <p>
                {number(p.volume, 0)} lots · grade {p.grade}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Method>
        <p>
          Specification defaults are stored outside the analytics logic in contracts.yaml. Current official
          sources were consulted during development; the operator must verify applicability to every
          historical expiry before enabling real-data signals. A single specification version does not model
          historical contract changes.
        </p>
        <p>
          Active expiries are observations in the selected dataset, not a claim about the current MCX listing
          calendar. Conceptual lifecycle phases are educational. Contract-specific launch calendars and
          tender/delivery periods must be checked with MCX.
        </p>
      </Method>
    </>
  );
}

export function SettingsView(props: ViewProps) {
  const { theme, toggle } = usePreferences();
  const [token, setToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const client = useQueryClient();
  const importer = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a CSV file');
      const body = new FormData();
      body.append('file', file);
      return api<{ rows: number; duplicate: boolean }>('/ingest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
    },
    onSuccess: (result) => {
      toast.success(result.duplicate ? 'This file was already imported' : `${result.rows} records imported`);
      setToken('');
      client.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <div className="two-columns">
        <Panel title="Appearance" subtitle="A workspace that works with your day.">
          <div className="settings-body">
            <div className="setting-row">
              <div>
                <strong>Color theme</strong>
                <p>Saved on this device.</p>
              </div>
              <Button variant="outline" onClick={toggle}>
                {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </Button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Keyboard navigation</strong>
                <p>Jump to any page with Ctrl / Cmd + K.</p>
              </div>
              <kbd>⌘ K</kbd>
            </div>
            <div className="setting-row">
              <div>
                <strong>Shareable research</strong>
                <p>Dates, pairs, expiry and backtest parameters travel with the URL.</p>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast.success('View link copied'))
                    .catch(() => toast.error('Copy the URL from your address bar'))
                }
              >
                Copy URL
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Data provenance" subtitle="Know the source of every number.">
          <dl className="spec-list">
            <div>
              <dt>Source mode</dt>
              <dd>{props.health?.source === 'sample' ? 'Synthetic sample' : 'Imported EOD'}</dd>
            </div>
            <div>
              <dt>Latest observation</dt>
              <dd>{props.health?.last_bhavcopy_date || '—'}</dd>
            </div>
            <div>
              <dt>Rows</dt>
              <dd>{number(props.health?.rows, 0)}</dd>
            </div>
            <div>
              <dt>Specifications</dt>
              <dd>{props.health?.specs_verified ? 'Operator verified' : 'Awaiting verification'}</dd>
            </div>
            <div>
              <dt>Price currency</dt>
              <dd>INR</dd>
            </div>
          </dl>
          <div className="panel-footnote">
            <Database size={14} />
            {props.health?.warning}
          </div>
        </Panel>
      </div>
      <Panel
        title="Import a Bhavcopy CSV"
        subtitle="Operator access · atomic validation · repeat-safe imports"
      >
        <form
          className="import-form"
          onSubmit={(e) => {
            e.preventDefault();
            importer.mutate();
          }}
        >
          <div className="notice">
            <Info size={18} />
            <p>
              Download an authorized end-of-day CSV from{' '}
              <a href="https://www.mcxindia.com/market-data/bhavcopy" target="_blank" rel="noreferrer">
                MCX Bhavcopy
              </a>
              . UDiFF and supported legacy headers are mapped explicitly. All supported rows must validate
              before anything is written.
            </p>
          </div>
          <label>
            Bhavcopy file
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Operator token
            <input
              type="password"
              value={token}
              required
              autoComplete="off"
              placeholder="Configured by your deployment operator"
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <p className="muted">
            Maximum 10 MB. Token is kept only in this page’s memory. Imported records never merge with sample
            records.
          </p>
          <Button type="submit" disabled={!file || !token || importer.isPending}>
            <Upload size={15} />
            {importer.isPending ? 'Validating file…' : 'Validate & import'}
          </Button>
          {importer.isError && (
            <div role="alert" className="rose-text">
              {importer.error.message}
            </div>
          )}
          {importer.isSuccess && (
            <div className="notice">
              <CheckCircle2 size={18} />
              <p>
                Import saved.{' '}
                {props.health?.source === 'sample'
                  ? 'The operator must set DATA_MODE=imported and restart the API to replace the sample view.'
                  : 'Imported-data views have been refreshed.'}
              </p>
            </div>
          )}
        </form>
      </Panel>
      <Method>
        <p>
          Accepted aliases cover UDiFF settlement, actual/original expiry, traded lots and open interest.
          Close prices are never substituted for settlement. Exact duplicate records are deduplicated;
          conflicting duplicates reject the whole file. SHA-256 digests make repeated imports idempotent.
        </p>
        <p>
          Source switching is an explicit server setting. This prevents a failed download or partial import
          from silently mixing real observations with invented data. Automatic public-download ingestion and
          exchange data redistribution rights are not assumed.
        </p>
      </Method>
    </>
  );
}
