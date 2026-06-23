# Operations runbook

This runbook is written for someone who has to run and support the repo without prior context.

## Local startup

Prereqs:

- Node and npm

Install deps:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Default local URLs:

- App: http://127.0.0.1:3102
- Health: http://127.0.0.1:3102/api/health

## Local verification

Quick checks:

```bash
curl.exe -sf http://127.0.0.1:3102/api/health
```

Validation gates:

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

`npm run sql:check` requires `SQL_GATE_DATABASE_URL` to point at a local or disposable Postgres database. Do not point it at production.

Browser test runner:

```bash
npm run test:browser
```

Browser smoke runner:

```bash
npm run test:browser:smoke
```

When you need to smoke a deployed demo, set `PLAYWRIGHT_BASE_URL` to the HTTPS URL and `PLAYWRIGHT_SKIP_WEBSERVER=1` before running the smoke suite.

## Deployment (Vercel)

This repo is intended to deploy as a public demo:

- No login.
- Fictional data only.
- Demo Mode enabled.
- Mock drafts only.
- No persisted PTO decisions.

Operator checklist:

1. Confirm `NEXT_PUBLIC_DEMO_MODE=true` in production.
2. Confirm the health endpoint reports `demoMode: true`.
3. Confirm the demo does not require private AI configuration.

## Rollback

Rollback is a deployment operation, not an app feature.

Use your deployment provider rollback and confirm:

- Root page loads without login.
- `GET /api/health` returns `200` and `demoMode: true`.

## GitHub Actions

CI runs on pull requests and pushes to the default branch. See:

- `.github/workflows/ci.yml`
- `.github/workflows/qa.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/droid-wiki-refresh.yml`

## Default branch assumption

This repo assumes the default branch is `master`. If the remote default branch changes, update branch filters in workflow YAML files.

## Secret handling

- `.env.example` is the contract for variable names.
- `.env.local` must stay untracked.
- Never paste secret values into issues, PRs, logs, docs, or screenshots.
