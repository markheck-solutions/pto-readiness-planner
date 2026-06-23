# Validation index

This index is a checklist for reviewers and future maintainers.

## Local base URL

- http://127.0.0.1:3102

## Core commands

Run from repo root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run safety
npm run sql:check
npm run quality:check
npm run readme:verify
npm run readiness-report
```

`npm run sql:check` requires `SQL_GATE_DATABASE_URL` to point at a local or disposable Postgres database. The gate extracts seed SQL, hashes SQL/sink/dependency metadata, bootstraps the schema, seeds the demo dataset, verifies table counts plus dataset fingerprint, and reruns the seed to prove idempotence.

Browser tests:

```bash
npm run test:browser
```

Browser smoke:

```bash
npm run test:browser:smoke
```

For deployed smoke, set `PLAYWRIGHT_BASE_URL` to the HTTPS URL and `PLAYWRIGHT_SKIP_WEBSERVER=1` before running the smoke suite.

## Evidence capture notes

When capturing validation evidence, record:

- Timestamp (ISO 8601)
- Base URL used
- Command run and exit code
- Output excerpt (redact any secrets)
- For browser checks: screenshot, console errors, and network failures if relevant

## What is expected to be true

- No login required for public review.
- Demo Mode defaults to safe behavior.
- Fictional data only.
- No persisted PTO decisions in public demo.
- No secret values in repo, logs, docs, or client assets.
