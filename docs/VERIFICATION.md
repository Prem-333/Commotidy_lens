# Verification record

Date: 10 October 2026. Host: Windows, Python 3.14.6, Node.js 24.19.0.

| Check | Result |
| --- | --- |
| Python financial invariants, replay, ingestion and API tests | 37 passed |
| TypeScript + optimized Vite build | Passed |
| Browser/automated-accessibility suite against built assets with CSP | 9 passed |
| Dark/light automated WCAG A/AA scans | No detected violations on five key views per theme |
| Frontend production dependency audit | Zero reported vulnerabilities |
| Python installed dependency consistency | Passed |
| Desktop, mobile and light-theme screenshots | Rendered and visually inspected |
| Docker Compose / Nginx / PostgreSQL execution | **Not run: Docker unavailable on this host** |
| Authorized actual MCX-file acceptance | **Not run: no representative authorized file provided** |
| Public hosting / TLS / backup restore | **Not deployed or verified** |

The nine browser checks include two accessibility scenarios (five views per theme), landing/dashboard, analytical views, backtest and CSV, palette/theme/PNG, mobile overflow, API error recovery and empty imported-data state. The production-preview server serves the built artifacts with the same main application CSP as the Nginx configuration. It does not substitute for running Nginx or PostgreSQL.

No-look-ahead tests mutate future prices and truncate the dataset, then assert that earlier strategy equity stays identical. Other tests cover zero-variance z-scores, exact quote/purity math, carry, interpolation without extrapolation, missing opens, liquidity, signal/execution date ordering, costs and imported-spec verification gates.

Known non-failing tooling warnings: Starlette's test-client adapter warns that its httpx integration is deprecated; the application API and tests pass. Vite warns that the lazily loaded Plotly Cartesian chunk exceeds 500 KB (approximately 1.51 MB raw / 504 KB gzip). The full Plotly build was replaced by the Cartesian build, reducing its compressed size from approximately 1.47 MB. It is not loaded by the landing page until an analytical chart is mounted.

The final source is packaged by `scripts/package_release.py`. The archive includes source, lockfiles, tests, docs and built web assets, and excludes secrets, databases, virtual environments, dependency directories and local screenshots. The adjacent SHA-256 file verifies archive integrity.

Automated testing is evidence of the checked behavior, not a guarantee of correctness, security, accessibility conformance, market profitability or production availability. Remaining release gates are in [ACCEPTANCE.md](ACCEPTANCE.md).
