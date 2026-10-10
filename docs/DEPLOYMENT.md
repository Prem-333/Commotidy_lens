# Deployment runbook

## Release boundary

The repository is a deployable **single-workspace research application**. It does not include multi-user authentication, paid subscriptions, order execution, a streaming feed or a background MCX scraper. The FastAPI service is intended to be reachable only through the provided web proxy/private network. API reads are not user-authenticated; imports require an operator bearer token.

This machine had no Docker executable. The Compose stack and PostgreSQL dialect must pass staging/CI execution before a production-ready claim. No cloud resources were created and no site was published.

## Launch

1. Provision a supported Docker host with approximately 3 GB RAM or more and persistent disk. Review resource limits against actual history sizes and concurrent users.
2. Copy the repository and run `python scripts/init_env.py`. Never commit `.env`. Restrict its filesystem ACL to the operator. Rotate any secret if its confidentiality is uncertain.
3. Run `docker compose config --quiet` to validate interpolation without printing secrets. Use a URL-safe database password; the generator uses hex.
4. Run `docker compose up --build --wait --wait-timeout 240`.
5. Verify `http://127.0.0.1:8080/healthz`, `/api/health`, `/api/docs`, the landing page and dashboard. Confirm that every sample view says Sample data.
6. Place a trusted TLS proxy in front of loopback port 8080. Configure HTTPS, certificate renewal, HSTS at the HTTPS terminator, request limits and identity if the workspace is private. Do not expose PostgreSQL or FastAPI directly.
7. Pin Python, Node, Nginx and PostgreSQL container image digests at release time; archive the exact lockfiles and release source SHA.

The Nginx proxy limits normal API traffic and expensive operations separately. Its per-IP limits use the immediate peer address. Behind another proxy, configure a trusted real-IP policy deliberately; do not trust arbitrary forwarded headers. Application semaphore limits are per worker; deployment uses one worker. Scaling workers requires a shared queue/limiter and coordinated schema/data initialization.

## Real-data activation

Use Settings to import authorized CSV data with the operator token. In sample mode this writes to the separate imported partition and does not alter the visible sample dataset. Edit `.env` to `DATA_MODE=imported`, then run `docker compose up -d --force-recreate api`. Empty imported storage displays an explicit empty state.

Check the source date, row counts, actual expiry mapping, futures/option filtering, volume units and OI meaning. Validate `contracts.yaml` against all relevant official contract versions. Set each applicable `verified` flag only after verification and rebuild the API. The application blocks imported signals and backtests until the relevant specs are verified. Normalized research views remain inspectable with pending-spec warnings.

Changing source mode is an operational action, not an automatic response to a file appearing. Never mix synthetic and real observations. Store the original authorized files externally with their provenance and digests. A corrected file can update imported rows, so preserve input versions if repeatability matters.

## State and migrations

PostgreSQL uses the named `postgres_data` volume. Do not use `docker compose down -v` unless you intend to delete this database. The initial schema is created idempotently using SQLAlchemy `create_all`; this does not perform schema upgrades. There are currently two tables: `quotes` and `imports`. Introduce a reviewed migration before changing deployed schema. Do not expect a new image to alter existing table definitions.

Sample initialization is deterministic and occurs only when no sample rows exist. Delete/reseed sample records only with a reviewed maintenance procedure if the fixture generator changes. Imported and sample rows have separate unique keys.

## Backup and restore

Use `pg_dump -Fc` within the DB container and encrypt the resulting archive at rest. Avoid terminal redirection that corrupts binary output in older PowerShell; write the dump to a temporary file inside the container, then use `docker compose cp` to retrieve it. Do not store archives in a public web directory.

Restore a backup into a separate staging database first with `pg_restore`, then verify row counts, dates, uniqueness and selected research results. Schedule backups and monitor their completion using infrastructure tooling; no backup scheduler is bundled. Document recovery point and recovery time objectives for the actual service.

## Monitoring

- `/healthz` confirms static web availability; `/api/health` confirms a database read and reports source/freshness.
- HTTP health is not exchange data freshness. Alert separately on missing expected EOD files, stale data and import rejections.
- Watch error rates, CPU/memory, PostgreSQL disk growth and slow queries. The current analytics layer loads the selected source into memory; capacity-test against the intended history size before increasing retention.
- Import failures are logged without bearer tokens or uploaded file contents. Nginx logs are size-bounded by Compose.
- Public paid/team deployment needs identity, tenant isolation and appropriate audit retention before acceptance.

## Rollback

Retain the prior application image tags/digests and lockfiles. Roll back to the prior images if the schema remains compatible. Future schema changes must ship explicit forward/rollback procedures and a backup. For this initial release, schema creation is additive only. Test rollback and restore in staging before a production release.

## Validation commands

```sh
docker compose config --quiet
docker compose up --build --wait --wait-timeout 240
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

Run browser tests against the actual HTTPS deployment as an additional acceptance step. The local production-preview tests exercise built assets and the app CSP; they do not establish that Nginx, PostgreSQL, TLS or cloud routing work in the target environment.
