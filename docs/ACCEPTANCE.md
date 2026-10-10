# Release acceptance

## Verified locally

- Python calculation, replay, ingestion and API test suite.
- TypeScript checking and optimized Vite production build.
- Browser flows: landing/dashboard, all analytical views, walk-forward replay, trade CSV, chart PNG, command palette, URL filters, theme persistence, service-error recovery and mobile page overflow.
- Automated WCAG A/AA checks on landing, overview, relative value, backtest controls and Settings in both themes.
- Manual visual inspection of desktop, light-theme and mobile screenshots.
- JavaScript dependency audit and Python dependency consistency check.

Exact final counts and commands are recorded in `VERIFICATION.md`. A passing unit test does not establish profitable market behavior.

## Required before a real-data production release

1. Execute the Compose stack on Docker with PostgreSQL, including import/update/idempotency tests and representative concurrent backtests.
2. Verify the chosen cloud/host deployment, TLS, hostname, appropriate identity/access, proxy trust and monitoring.
3. Import representative **authorized actual MCX files**. Confirm dates, symbol identification, option exclusion, actual vs original expiry, volume/OI units, correction policy and data-use rights.
4. Verify contract specs for each historical expiry. The defaults are current reference values, not an effective-dated historical contract database.
5. Calibrate fees, taxes and slippage assumptions. Define what research claims are permitted given fractional lots, absent market depth and missing margin/delivery models.
6. Exercise encrypted backup/restore, outage recovery and rollback. Define and test capacity/latency budgets.
7. Perform manual keyboard/screen-reader review across remaining views and exports. Automated scans cover common failures, not full WCAG conformance.

## Product roadmap, not shipped functionality

Mobile alert delivery; trained ML anomaly models; subscriptions/payment processing; accounts/team roles; enterprise connectors; other commodities and global exchanges. Their roadmap labels remain visible. Do not advertise them as active services.

## Interpretation

Ready to evaluate and stage is not the same as verified for live trading or a public paid launch. The UI and analytics work locally; environment- and market-specific acceptance still needs evidence. No "zero mistakes" guarantee is made.
