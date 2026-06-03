---
name: qa
description: >
  Run diff-aware manual and functional QA for PTO Readiness Planner. Loads the
  QA config, maps changed files to web/API app surfaces, routes only affected
  flows to qa-web and qa-api, captures evidence, and writes a concise QA report.
---

# QA Orchestrator

**SCOPE: This skill performs manual/functional QA only -- verifying that the application actually works by interacting with it as a real user would in a browser or via HTTP. Do NOT run or report lint, typecheck, unit tests, builds, readiness reports, CodeQL, dependency scans, or other static/CI checks.**

## Step 1: Load configuration

Read these files before deciding scope:

- `.factory/skills/qa/config.yaml`
- `.factory/skills/qa/REPORT-TEMPLATE.md`

If either file is missing or unreadable, report `:no_entry: BLOCKED` and stop. Do not infer credentials or secret values from the environment.

## Step 2: Determine the target

Use `default_target: both` as `local_branch_plus_production_smoke` for app-code changes:

1. Run local branch-code flows first against `http://127.0.0.1:3102`.
2. Run production smoke second against `https://pto-readiness-planner.vercel.app` as an additional fixed-target public smoke.
3. Keep every target read-only, demo-safe, mock-only, and free of real employee/company/customer data.
4. Never print `.env.local`, tokens, provider keys, database URLs, or secret values.

If the caller explicitly requests only `local`, do not run production smoke. If the caller explicitly requests only `production_smoke`, run the production smoke subset and do not claim branch-code coverage.

If no app code changed, report `:grey_question: INCONCLUSIVE - No app code changed, so functional QA is not required for this diff.` unless production smoke was explicitly requested.

## Step 3: Analyze git diff

Determine changed files with `git diff --name-only` (and include staged changes if relevant to the current worktree). Map changed paths to app definitions in `config.yaml`:

- `web` uses the `qa-web` skill and `agent-browser`.
- `api` uses the `qa-api` skill and `curl`.

Files outside configured app `path_patterns` -- for example `.factory/skills/**`, `.github/**`, docs, metadata, and workflow-only changes -- do not trigger app flows by themselves.

When shared paths match both apps, route to both skills but still choose the smallest relevant flow set.

## Step 4: Local branch-code preflight

No Vercel preview deployments were detected for this repository. For PR, branch, and worktree code QA:

1. Start the app locally from the repo root with `npm run dev`.
2. Poll `http://127.0.0.1:3102/api/health` until it responds.
3. Verify the health response identifies `service` as `pto-readiness-planner` and `demoMode` as `true`.
4. If port `3102` responds with another service, report `:no_entry: BLOCKED` with the observed health summary and remediation: stop the conflicting service or change the QA target.
5. Never fall back to production, staging, or any remote URL for branch-code testing. Remote targets run different code and cannot validate the diff.

## Step 5: Route to sub-skills

Load only the sub-skill for each affected app:

- Web-affecting changes: `.factory/skills/qa-web/SKILL.md`
- API-affecting changes: `.factory/skills/qa-api/SKILL.md`

For each affected app, pick flows from that sub-skill's menu that directly cover the diff, plus at most one adjacent integration or recovery flow that proves the change still works in context.

Do not run unrelated flows. Do not run automated test suites. If no existing flow covers the changed behavior, perform one ad-hoc manual/functional check that directly exercises the changed behavior and record it as a test case.

For the default `both` target on app-code changes, complete local branch-code relevant flows before production smoke. Production smoke is additional confidence only and must never replace the local result.

## Step 6: Evidence capture

Write the final report to `qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Evidence rules:

- Prefer concise text evidence that can render inline in a PR comment.
- For browser checks, capture `agent-browser` accessibility snapshots after meaningful state changes and save screenshots to `qa-results/<run-id>/` when visual proof is useful.
- For API checks, record the request method/path, status code, and a short sanitized response note.
- Do not embed broken image links; reference screenshot filenames as downloadable artifacts.
- Do not include setup/preflight steps as test rows. Test rows must verify user-facing behavior, API behavior, a negative check, or production smoke.
- Never include secrets, tokens, database URLs, private provider endpoints, or raw environment dumps.

## Step 7: Result and report rules

Use exactly these result values:

- `:white_check_mark: PASS`
- `:x: FAIL`
- `:no_entry: BLOCKED`
- `:warning: FLAKY`
- `:grey_question: INCONCLUSIVE`

Keep the report short: the table, optional `### Action Required`, optional `### Suggested Skill Updates`, and one collapsed evidence block.

**Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it.** Continue to other relevant flows when safe.

## Step 8: Failure learning

`config.yaml` sets `failure_learning: auto_commit`. When a `BLOCKED` or `FAIL` result reveals a new reusable testing-environment pattern that is not already covered by a sub-skill's Known Failure Modes:

1. Add a `### Suggested Skill Updates` section to the report with the file, section, issue, and exact markdown to add.
2. Write `qa-results/skill-updates.json` with structured edits in this format:

```json
[
  {
    "file": ".factory/skills/qa-web/SKILL.md",
    "section": "Known Failure Modes",
    "action": "append",
    "content": "6. **New environment pattern.** Describe the durable testing-environment behavior and how future QA should handle it."
  }
]
```

Only write learning entries for environment/workflow knowledge that will help future QA runs. Do not suggest updates for expected product failures, bad selectors, or normal diff-driven UI copy changes.

Because the existing `.github/workflows/qa.yml` is intentionally not regenerated by this install, automatic committing requires a separate workflow update that knows how to consume `qa-results/skill-updates.json`.
