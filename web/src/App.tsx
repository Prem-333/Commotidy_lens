import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Command,
  Database,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { api, dateLabel, usePreferences } from './lib';
import type { Health, Normalized } from './types';
import { Brand, Empty, ErrorState, IntegrityNote } from './components/Common';
import { Button } from './components/ui/button';
import {
  Overview,
  Normalizer,
  RelativeValue,
  TermStructure,
  BacktestLab,
  LiquidityView,
  Explorer,
  SettingsView,
} from './views';
import { Landing } from './Landing';

const navigation = [
  {
    slug: 'overview',
    name: 'Overview',
    icon: LayoutDashboard,
    section: 'WORKSPACE',
    description: 'The market, in perspective.',
    caption: 'An evidence-led view of gold across MCX contracts.',
  },
  {
    slug: 'normalizer',
    name: 'Normalizer',
    icon: SlidersHorizontal,
    section: '',
    description: 'One gram. One standard.',
    caption: 'Follow every step from the quoted price to pure gold.',
  },
  {
    slug: 'relative-value',
    name: 'Relative Value',
    icon: ArrowLeftRight,
    section: '',
    description: 'Find the difference that matters.',
    caption: 'Separate statistical dislocations from trading noise.',
  },
  {
    slug: 'term-structure',
    name: 'Term Structure',
    icon: TrendingUp,
    section: '',
    description: 'A longer view of gold.',
    caption: 'Explore the curve, the carry, and what actually changed.',
  },
  {
    slug: 'backtest',
    name: 'Backtest Lab',
    icon: FlaskConical,
    section: 'RESEARCH',
    description: 'Put the hypothesis to work.',
    caption: 'Unseen test windows. Transparent costs. Honest outcomes.',
  },
  {
    slug: 'liquidity',
    name: 'Cost & Liquidity',
    icon: Activity,
    section: '',
    description: 'A price is only half the story.',
    caption: 'Understand the cost of getting in—and getting out.',
  },
  {
    slug: 'contracts',
    name: 'Contract Explorer',
    icon: BookOpen,
    section: '',
    description: 'Know what you’re comparing.',
    caption: 'Contract economics, delivery basis, and observed expiries.',
  },
  {
    slug: 'settings',
    name: 'Settings',
    icon: Settings2,
    section: 'PREFERENCES',
    description: 'Your research environment.',
    caption: 'Manage appearance, inspect provenance, and import data.',
  },
];

export interface ViewProps {
  date: string;
  month: string;
  pair: string;
  contract: string;
  health?: Health;
  normalized?: Normalized;
  setFilter: (key: string, value: string) => void;
}

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [palette, setPalette] = useState(false);
  const [command, setCommand] = useState('');
  const [mobile, setMobile] = useState(false);
  const { theme, toggle } = usePreferences();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api<Health>('/health', { signal }),
    refetchInterval: 60000,
  });
  const date = search.get('date') || health.data?.last_bhavcopy_date || '';
  const monthParam = search.get('month') || '';
  const normalized = useQuery({
    queryKey: ['normalized', date, monthParam],
    queryFn: ({ signal }) =>
      api<Normalized>(`/normalized?date=${date}${monthParam ? `&month=${monthParam}` : ''}`, { signal }),
    enabled: !!date,
  });
  const month = monthParam || normalized.data?.month || '';
  const pair = search.get('pair') || 'GOLDM/GOLDTEN';
  const contract = search.get('contract') || 'GOLDM';
  function setFilter(key: string, value: string) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === 'date') next.delete('month');
      return next;
    });
  }
  const page = navigation.find((item) => location.pathname.endsWith(item.slug)) || navigation[0];
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setPalette((open) => !open);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    setMobile(false);
    document.title = `${page.name} · CommodityLens`;
  }, [page.name]);
  const props: ViewProps = {
    date,
    month,
    pair,
    contract,
    health: health.data,
    normalized: normalized.data,
    setFilter,
  };
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {mobile && (
        <button className="sidebar-overlay" onClick={() => setMobile(false)} aria-label="Close navigation" />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <Link to="/" className="brand-link" aria-label="CommodityLens home">
          <Brand />
        </Link>
        <div className="workspace-picker">
          <span className="workspace-avatar">C</span>
          <span>
            Gold intelligence<small>Research workspace</small>
          </span>
          <ChevronRight size={15} />
        </div>
        <nav aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <div key={item.slug}>
              {item.section && <div className="nav-label">{item.section}</div>}
              <NavLink
                to={`/app/${item.slug}?${search.toString()}`}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={17} />
                {item.name}
                {item.slug === 'overview' && <span className="nav-dot" />}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <ShieldCheck size={18} />
            <strong>Built on evidence.</strong>
            <p>
              Transparent math.
              <br />
              No manufactured signals.
            </p>
          </div>
          <Link to="/" className="nav-item">
            <ArrowUpRight size={17} />
            About CommodityLens
          </Link>
          <div className="profile">
            <span className="profile-avatar">CL</span>
            <span>
              Research session<small>Local workspace</small>
            </span>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page.name}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="command-trigger"
              onClick={() => setPalette(true)}
              aria-label="Open command palette"
            >
              <Search size={15} />
              <span>Quick search</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className={`badge ${health.data?.source === 'sample' ? 'badge-gold' : 'badge-blue'}`}>
              <Database size={11} />
              {health.data?.source === 'sample' ? 'Sample data' : health.data ? 'Imported EOD' : 'Connecting'}
            </span>
            <button
              className="icon-button"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main id="main" className="dashboard-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> MCX GOLD INTELLIGENCE
              </div>
              <h1>{page.description}</h1>
              <p>{page.caption}</p>
            </div>
            <div className="date-control">
              <label htmlFor="trade-date">OBSERVATION DATE</label>
              <select
                id="trade-date"
                value={date}
                onChange={(e) => setFilter('date', e.target.value)}
                disabled={!health.data?.dates.length}
              >
                {!date && <option value="">No data</option>}
                {health.data?.dates
                  .slice()
                  .reverse()
                  .map((day) => (
                    <option key={day} value={day}>
                      {dateLabel(day)}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="context-bar">
            <span>
              <span
                className={`status-dot ${health.data?.source !== 'sample' && (health.data?.age_days ?? 99) > 3 ? 'stale' : ''}`}
              />
              {health.data?.source === 'sample' ? 'Synthetic research dataset' : 'End-of-day observations'}
              <span className="muted"> · {health.data?.rows.toLocaleString() ?? '—'} records</span>
            </span>
            <label>
              Expiry month{' '}
              <select
                aria-label="Expiry month"
                value={month}
                onChange={(e) => setFilter('month', e.target.value)}
              >
                <option value="" disabled>
                  Select month
                </option>
                {normalized.data?.months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {health.isError ? (
            <ErrorState error={health.error} retry={() => health.refetch()} />
          ) : health.data?.status === 'empty' && page.slug !== 'settings' ? (
            <Empty
              text="No observations have been loaded"
              detail="Open Settings to import an authorized Bhavcopy CSV. This workspace never falls back to synthetic prices."
            />
          ) : normalized.isError && page.slug !== 'settings' ? (
            <ErrorState error={normalized.error} retry={() => normalized.refetch()} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={page.slug}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Routes>
                  <Route path="overview" element={<Overview {...props} />} />
                  <Route path="normalizer" element={<Normalizer {...props} />} />
                  <Route path="relative-value" element={<RelativeValue {...props} />} />
                  <Route path="term-structure" element={<TermStructure {...props} />} />
                  <Route path="backtest" element={<BacktestLab {...props} />} />
                  <Route path="liquidity" element={<LiquidityView {...props} />} />
                  <Route path="contracts" element={<Explorer {...props} />} />
                  <Route path="settings" element={<SettingsView {...props} />} />
                  <Route path="*" element={<Overview {...props} />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          )}
          <IntegrityNote />
          <footer className="dashboard-footer">
            <span>
              CommodityLens <span className="muted">/ Research with perspective.</span>
            </span>
            <span>INR · Asia/Kolkata · EOD</span>
          </footer>
        </main>
      </div>
      <Dialog.Root open={palette} onOpenChange={setPalette}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-dialog">
            <Dialog.Title className="sr-only">Navigate your workspace</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search dashboard views and press a result to navigate.
            </Dialog.Description>
            <div className="command-input">
              <Search size={19} />
              <input
                autoFocus
                placeholder="Where would you like to go?"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                aria-label="Search pages"
              />
              <Dialog.Close asChild>
                <button className="icon-button" aria-label="Close command palette">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className="command-results">
              {navigation
                .filter((item) =>
                  `${item.name} ${item.caption}`.toLowerCase().includes(command.toLowerCase()),
                )
                .map((item) => (
                  <button
                    key={item.slug}
                    onClick={() => {
                      navigate(`/app/${item.slug}?${search}`);
                      setPalette(false);
                      setCommand('');
                    }}
                  >
                    <item.icon size={18} />
                    <span>
                      {item.name}
                      <small>{item.caption}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
            </div>
            <div className="command-footer">
              <Command size={12} /> Jump to any part of your research{' '}
              <span>
                <Check size={12} /> Select
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
export function App() {
  const { theme } = usePreferences();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#F8F7F3' : '#07090D');
  }, [theme]);
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<Dashboard />} />
        <Route
          path="*"
          element={
            <div className="fatal">
              <h1>Page not found</h1>
              <Button asChild>
                <Link to="/app/overview">Open dashboard</Link>
              </Button>
            </div>
          }
        />
      </Routes>
      <Toaster theme={theme} position="bottom-right" richColors />
    </MotionConfig>
  );
}
