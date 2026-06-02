---
name: qa
description: >
  Run diff-aware functional QA for Team Coverage and PTO Readiness Planner.
  Route changed behavior to qa-web and qa-api, capture concise evidence, and
  write a short QA report.
---

# QA Orchestrator

Use this skill for functional QA only. Verify real browser and HTTP behavior. Do not use this skill to report lint, typecheck, unit tests, builds, readiness-report output, or static scans.

## Step 1: Load configuration

Read these files first:

- `.factory/skills/qa/config.yaml`
- `.factory/skills/qa/REPORT-TEMPLATE.md`

If the config is missing, report `:no_entry: BLOCKED` and stop.

## Step 2: Determine the target

Use the configured local target by default:

- Local branch code: `http://127.0.0.1:3102`
- Production smoke: run only when the caller provides an HTTPS base URL

Rules:

1. Test local branch code first.
2. Never replace local branch testing with production smoke.
3. Keep all QA read-only.
4. Do not print `.env.local` or secret values.

## Step 3: Analyze the diff

Use `git diff --name-only` to determine scope. Map changed files to the `web` and `api` path patterns from `.factory/skills/qa/config.yaml`.

If no app code changed and the diff only touches repo metadata, docs, workflows, or QA skills, report:

`:grey_question: INCONCLUSIVE - No app code changed, so functional QA is not required for this diff.`

If production smoke is explicitly requested, you may still run the smoke subset even when no app code changed.

## Step 4: Route to sub-skills

- Use `.factory/skills/qa-web/SKILL.md` for browser flows
- Use `.factory/skills/qa-api/SKILL.md` for API flows

Run only the flows that are relevant to the diff, plus one nearby integration or recovery check.

## Step 5: Local server rules

When local testing is required:

1. Start the app with `npm run dev`.
2. Poll `http://127.0.0.1:3102/api/health`.
3. Verify `service` is `pto-readiness-planner`.
4. Verify `demoMode` is `true`.
5. If port 3102 responds with the wrong service, report `:no_entry: BLOCKED`.

## Step 6: Evidence rules

- Save the report to `qa-results/report.md`
- Use concise text evidence first
- For browser checks, capture accessibility snapshots and screenshots when helpful
- For API checks, record the request, status code, and a short sanitized response note
- Never include secrets, tokens, database URLs, or private provider details

## Step 7: Report

Use `.factory/skills/qa/REPORT-TEMPLATE.md`.

Keep the report short:

- Start with `## QA Report`
- Use one row per tested flow
- Use only these result values: `:white_check_mark: PASS`, `:x: FAIL`, `:no_entry: BLOCKED`, `:warning: FLAKY`, `:grey_question: INCONCLUSIVE`
- Add `### Action Required` only when the reviewer must do something

## Known failure modes

1. Port 3102 can only be used for this app. If `/api/health` returns a different service, stop and report BLOCKED.
2. Public smoke must remain no-login, demo-safe, and mock-only. If a route asks for auth, fail the relevant flow.
3. Browser-only simulated decisions should never require a write API call. Treat any decision mutation request as a failure.
