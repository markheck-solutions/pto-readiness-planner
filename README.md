# Team Coverage and PTO Readiness Planner

Portfolio app that helps a manager review PTO requests through coverage risk, role requirements, overlapping requests, critical delivery windows, and fairness context. This is decision support, not an HR workflow.

**Live demo:** <https://pto-readiness-planner.vercel.app>

## Demo posture and safety

- No login.
- Fictional data only.
- Public demo uses mock drafts only.
- Approve, defer, and ask for coverage actions are browser-only simulation. They reset on refresh.
- Do not add real employee, company, customer, schedule, HR, medical, compensation, performance, or confidential staffing data.

## Quick start (local)

1. Install deps:

```bash
npm ci
```

2. Create `.env.local` from `.env.example` if you need local overrides. Do not commit `.env.local`.

3. Start the dev server:

```bash
npm run dev
```

4. Open:

- App: http://127.0.0.1:3102
- Health: http://127.0.0.1:3102/api/health

## Validation and readiness gates

Run these from the repo root:

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
npm run test:browser
npm run test:browser:smoke
```

`npm run sql:check` requires `SQL_GATE_DATABASE_URL` to point at a local or disposable Postgres database. CI provides a disposable Postgres service for this gate.

The smoke suite can target a deployed demo by setting `PLAYWRIGHT_BASE_URL` to the HTTPS URL and `PLAYWRIGHT_SKIP_WEBSERVER=1` before running `npm run test:browser:smoke`.

## Repo maturity surfaces (external review)

These files exist to help reviewers and future operators:

- Operations runbook: `docs/runbooks/operations.md`
- Validation index: `docs/validation/INDEX.md`
- CI workflow: `.github/workflows/ci.yml`
- QA workflow: `.github/workflows/qa.yml`
- CodeQL workflow: `.github/workflows/codeql.yml`
- Wiki refresh workflow: `.github/workflows/droid-wiki-refresh.yml`
- Dependency updates: `.github/dependabot.yml`
- PR template: `.github/pull_request_template.md`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- Ownership: `.github/CODEOWNERS`
- QA skill surfaces: `.factory/skills/qa/`, `.factory/skills/qa-web/`, `.factory/skills/qa-api/`

## Default branch assumptions

This repo assumes the default branch is `master`. If the remote default branch changes, update branch filters in workflow YAML files.

## Secrets and demo safety

- `.env.example` is the source of truth for variable names.
- `.env.local` must remain untracked.
- Never print secret values in logs, docs, or issue text.
- Public demo mode must remain mock-only and safe by default.
