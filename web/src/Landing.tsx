import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Layers3,
  Radio,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { api, colors, money, usePreferences } from './lib';
import type { Normalized } from './types';
import { Brand } from './components/Common';
import { Button } from './components/ui/button';

const pipeline = [
  'Bhavcopy',
  'Clean',
  'Identify',
  'Normalize',
  'Compare',
  'Signal',
  'Backtest',
  'Adjust costs',
  'Your dashboard',
];
export function Landing() {
  const { toggle } = usePreferences();
  const data = useQuery({
    queryKey: ['landing-normalized'],
    queryFn: ({ signal }) => api<Normalized>('/normalized', { signal }),
  });
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" aria-label="CommodityLens home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#method">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <div className="actions">
          <button className="icon-button" onClick={toggle} aria-label="Toggle theme">
            <Sun size={18} />
          </button>
          <Button asChild size="sm">
            <Link to="/app/overview">
              Open Dashboard
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-grid" />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="hero-copy"
          >
            <div className="hero-eyebrow">
              <span className="status-dot" /> A CLEARER LENS ON MCX GOLD <span>RESEARCH PLATFORM</span>
            </div>
            <h1>
              Gold has one price.
              <br />
              MCX has <span>four.</span>
            </h1>
            <p>
              Different sizes. Different purities. One normalized view.
              <br className="desktop-break" /> Find relative value that stands up to costs, liquidity,
              <br className="desktop-break" /> and a little healthy skepticism.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link to="/app/overview">
                  See the market clearly
                  <ArrowUpRight size={17} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <a href="#method">
                  Explore the methodology
                  <ArrowDown size={15} />
                </a>
              </Button>
            </div>
            <div className="hero-proof">
              <span>
                <CheckCircle2 size={13} /> No fabricated signals
              </span>
              <span>
                <CheckCircle2 size={13} /> Every calculation, auditable
              </span>
              <span>
                <CheckCircle2 size={13} /> Sample data clearly labeled
              </span>
            </div>
          </motion.div>
          <motion.div
            className="hero-preview"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="preview-top">
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
              <span>commoditylens / market overview</span>
              <span className="badge badge-gold">
                {data.data?.source === 'imported' ? 'Imported EOD' : 'Sample data'}
              </span>
            </div>
            <div className="preview-body">
              <div className="preview-sidebar">
                <span className="lens-mark">
                  <span />
                </span>
                <Layers3 />
                <SlidersHorizontal />
                <TrendingUp />
                <FlaskConical />
              </div>
              <div className="preview-content">
                <div className="preview-heading">
                  <div>
                    <span className="eyebrow">THE GOLD MARKET, NORMALIZED</span>
                    <h3>One standard. A clearer picture.</h3>
                  </div>
                  <span className="badge">INR / fine gram</span>
                </div>
                <div className="preview-quotes">
                  {data.data?.rows.length ? (
                    data.data.rows.map((q, i) => (
                      <div key={q.contract}>
                        <span>
                          <i style={{ background: colors[i] }} />
                          {q.contract}
                        </span>
                        <strong>{money(q.pure)}</strong>
                        <small>
                          {q.purity * 1000} purity · {q.lot_size_grams}g lot
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="preview-empty">
                      {data.isError
                        ? 'Connect the API to explore computed contract prices.'
                        : 'Loading normalized contract observations…'}
                    </div>
                  )}
                </div>
                <div className="preview-comparison">
                  <div className="preview-comparison-title">
                    <h4>The same gold. A common basis.</h4>
                    <p>
                      {data.data
                        ? `${data.data.date} · ${data.data.month} expiry · ${data.data.source} data`
                        : 'Transparent contract economics'}
                    </p>
                  </div>
                  {data.data?.rows.map((q, i) => {
                    const prices = data.data.rows.map((row) => row.pure);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    return (
                      <div className="preview-bar-row" key={q.contract}>
                        <span>{q.contract}</span>
                        <div>
                          <i
                            style={{
                              width: `${45 + (max > min ? ((q.pure - min) / (max - min)) * 50 : 25)}%`,
                              background: colors[i],
                            }}
                          />
                        </div>
                        <strong>{money(q.pure)}</strong>
                      </div>
                    );
                  })}
                  <div className="preview-axis-note">
                    Relative scale · normalized prices from the API · no illustrative market line
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-footer">
              <span>
                <ShieldCheck size={13} /> Evidence-backed by design
              </span>
              <Link to="/app/overview">
                Explore the workspace
                <ArrowRight size={13} />
              </Link>
            </div>
          </motion.div>
        </section>
        <div className="market-ticker">
          <div>
            {[0, 1].map((copy) => (
              <div className="ticker-group" key={copy} aria-hidden={copy === 1}>
                {data.data?.rows.map((q) => (
                  <span key={q.contract}>
                    <i />
                    {q.contract}
                    <strong>{money(q.pure)}</strong>
                    <small>/ fine g</small>
                    <span className="gold-text">{data.data?.source === 'sample' ? 'SAMPLE' : 'EOD'}</span>
                  </span>
                )) || (
                  <span>
                    GOLDM <Circle size={8} /> GOLDTEN <Circle size={8} /> GOLDGUINEA <Circle size={8} />{' '}
                    GOLDPETAL
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <section id="product" className="landing-section">
          <div className="section-intro">
            <span className="eyebrow">LESS NOISE. MORE PERSPECTIVE.</span>
            <h2>
              A research desk.
              <br />
              <span>Not another price screen.</span>
            </h2>
            <p>Go from a raw exchange file to a defensible conclusion—with the assumptions still attached.</p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: ScanLine,
                title: 'Different contracts. Same lens.',
                text: 'Size, quotation basis, purity. Strip away the unit differences and compare on a fine-gold-per-gram basis.',
                tag: 'AUDITABLE NORMALIZATION',
                className: 'feature-wide',
                to: 'normalizer',
              },
              {
                icon: Radio,
                title: 'Signals that earn your attention.',
                text: 'A statistical deviation is only the start. Costs, liquidity and delivery compatibility have the final say.',
                tag: 'RELATIVE VALUE',
                className: '',
                to: 'relative-value',
              },
              {
                icon: GitBranch,
                title: 'Read between the expiries.',
                text: 'Explore annualized carry, expected roll-down and the residual curve shift through time.',
                tag: 'TERM STRUCTURE',
                className: '',
                to: 'term-structure',
              },
              {
                icon: FlaskConical,
                title: 'The future stays unseen.',
                text: 'Walk-forward training windows. Next-session entries. Gross and net results, side by side.',
                tag: 'BACKTEST LAB',
                className: 'feature-wide',
                to: 'backtest',
              },
              {
                icon: Fingerprint,
                title: 'The details are the product.',
                text: 'Source separation, inspectable specs, thin-day flags and exportable evidence. A result you can interrogate.',
                tag: 'COSTS & PROVENANCE',
                className: 'feature-wide',
                to: 'liquidity',
              },
              {
                icon: Layers3,
                title: 'The whole desk, in focus.',
                text: 'A responsive workspace, keyboard navigation and shareable views. Move from the signal to its evidence in a click.',
                tag: 'TRADER DASHBOARD',
                className: '',
                to: 'overview',
              },
            ].map((feature) => (
              <Link
                className={`feature-card ${feature.className}`}
                to={`/app/${feature.to}`}
                key={feature.title}
              >
                <div className="feature-top">
                  <feature.icon size={25} />
                  <ArrowUpRight size={17} />
                </div>
                <span className="eyebrow">{feature.tag}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </Link>
            ))}
          </div>
        </section>
        <section id="method" className="method-section">
          <div className="landing-section">
            <div className="section-intro centered">
              <span className="eyebrow">FROM SOURCE TO SIGNAL</span>
              <h2>
                No black box.
                <br />
                <span>Just a better process.</span>
              </h2>
              <p>Nine deliberate steps. Every transformation is traceable.</p>
            </div>
            <div className="pipeline">
              {pipeline.map((step, i) => (
                <div className="pipeline-step" key={step} style={{ animationDelay: `${i * 0.45}s` }}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{step}</strong>
                  {i < pipeline.length - 1 && <ChevronRight size={13} />}
                </div>
              ))}
            </div>
            <div className="method-pledge">
              <ShieldCheck size={24} />
              <p>
                When nothing clears the bar, we say so.
                <br />
                <strong>“No meaningful dislocation. Markets are fairly priced.”</strong>
              </p>
            </div>
          </div>
        </section>
        <section className="landing-section comparison-section">
          <div className="section-intro">
            <span className="eyebrow">CONTEXT IS THE EDGE</span>
            <h2>
              Why not just
              <br />
              <span>a price dashboard?</span>
            </h2>
            <p>
              Seeing a difference is easy.
              <br />
              Understanding it takes a better lens.
            </p>
          </div>
          <div className="comparison-table">
            <div>
              <span>RESEARCH CAPABILITY</span>
              <span>Price screen</span>
              <strong>CommodityLens</strong>
            </div>
            {[
              ['Common purity & quotation basis', 'Varies'],
              ['Inspectable signal qualification', 'Varies'],
              ['Walk-forward research replay', 'Varies'],
              ['Costs beside gross results', 'Varies'],
              ['Quiet when evidence is weak', 'Varies'],
            ].map(([text, status]) => (
              <div key={text}>
                <span>{text}</span>
                <span>{status}</span>
                <strong>
                  <Check size={17} />
                </strong>
              </div>
            ))}
            <p>Conceptual comparison, not a claim about a specific competing product.</p>
          </div>
        </section>
        <section id="pricing" className="landing-section">
          <div className="section-intro centered">
            <span className="eyebrow">START WITH CLARITY</span>
            <h2>A lens for every research desk.</h2>
            <p>Planned offerings. Billing and paid subscriptions are not enabled.</p>
          </div>
          <div className="pricing-grid">
            {[
              {
                title: 'Explore',
                label: 'Free workspace',
                desc: 'For curiosity, evaluation and transparent research.',
                features: [
                  'All research views',
                  'Synthetic sample dataset',
                  'CSV & chart exports',
                  'Inspectable methodology',
                ],
                action: 'Explore the dashboard',
                highlight: false,
              },
              {
                title: 'Pro',
                label: 'Planned subscription',
                desc: 'For a repeatable, personal research workflow.',
                features: [
                  'Everything in Explore',
                  'Planned: saved experiments',
                  'Planned: mobile notifications',
                  'Planned: expanded history',
                ],
                action: 'See the product roadmap',
                highlight: true,
              },
              {
                title: 'Enterprise',
                label: 'Planned B2B offering',
                desc: 'For teams building on a common analytical foundation.',
                features: [
                  'Documented research API',
                  'Planned: team permissions',
                  'Planned: service guarantees',
                  'Planned: enterprise integrations',
                ],
                action: 'Explore API documentation',
                highlight: false,
              },
            ].map((plan, i) => (
              <div className={`pricing-card ${plan.highlight ? 'highlight' : ''}`} key={plan.title}>
                {plan.highlight && <span className="plan-ribbon">ON THE ROADMAP</span>}
                <span className="eyebrow">{plan.title}</span>
                <h3>{plan.label}</h3>
                <p>{plan.desc}</p>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.highlight ? 'default' : 'outline'} asChild>
                  {i === 0 ? (
                    <Link to="/app/overview">
                      {plan.action}
                      <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <a href={i === 1 ? '#roadmap' : '/api/docs'}>
                      {plan.action}
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </section>
        <section id="roadmap" className="landing-section roadmap-section">
          <div className="section-intro">
            <span className="eyebrow">THE VIEW GETS WIDER</span>
            <h2>Gold is the beginning.</h2>
            <p>Future work, clearly separated from what the platform does today.</p>
          </div>
          <div className="roadmap-grid">
            {[
              ['01', 'Mobile alerts', 'Opt-in notifications when a research threshold clears.'],
              ['02', 'ML anomaly research', 'Calibrated anomaly detection with out-of-sample validation.'],
              ['03', 'Enterprise integrations', 'Identity, team controls and reliable data connectors.'],
              ['04', 'Beyond gold', 'Other commodities and global markets, with market-specific economics.'],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <span className="badge">Planned</span>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <Sparkles size={25} />
          <span className="eyebrow">SEE THE GOLD MARKET CLEARLY.</span>
          <h2>
            Less guesswork.
            <br />
            <span>More perspective.</span>
          </h2>
          <Button asChild>
            <Link to="/app/overview">
              Open your research workspace
              <ArrowUpRight size={17} />
            </Link>
          </Button>
          <p>Clearly labeled sample data. No account required.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Brand />
          <p>One normalized view. Every assumption in the open.</p>
        </div>
        <p>
          CommodityLens is a research tool, not investment advice.
          <br />
          Synthetic data and simulated results do not establish an executable edge.
          <br />
          MCX is an independent exchange; no affiliation is implied.
        </p>
        <span>© 2026 CommodityLens</span>
      </footer>
    </div>
  );
}
