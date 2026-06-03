---
name: qa-web
description: >
  Functional browser QA for the PTO Readiness Planner web experience. Covers
  overview, queue filtering, heatmap detail evidence, browser-only decisions,
  manager drafts, accessibility, safe states, and production public smoke.
---

# QA Web

Use this sub-skill for browser-visible behavior, App Router pages, route state, UI copy, accessibility, and manager decision-support flows. This is manual/functional QA only; do not run Playwright, unit tests, lint, typecheck, or builds from this skill.

## Testing Target

No Vercel preview deployments were detected.

### Local branch-code target

For PR, branch, and worktree code validation:

1. Start the app locally from the repository root with `npm run dev`.
2. Poll `http://127.0.0.1:3102/api/health` until ready.
3. Verify the health response reports `service: pto-readiness-planner` and `demoMode: true`.
4. Use `http://127.0.0.1:3102` as the base URL for branch-code browser testing.
5. Never fall back to production or another remote environment for branch-code testing.

If local startup or health verification cannot complete, report all affected local web flows as `:no_entry: BLOCKED` with what was tried and how to fix it.

### Production smoke target

Production smoke uses the fixed public URL `https://pto-readiness-planner.vercel.app` only as an additional smoke target. It never replaces local branch-code QA and must stay read-only, demo-safe, and mock-only.

## Authentication

No login is required. Do not create accounts, request credentials, read `.env.local`, or print secret values. If any target asks for authentication, fail the relevant public-demo flow unless the caller explicitly changed the target contract.

## Personas and negative checks

- `sdm-reviewer`: verifies first-visit value, manager context, and queue clarity. Negative checks: no credentials required, no real/private staff data, no persistent HR decision.
- `operations-manager`: verifies triage, heatmap, evidence, browser-only decisions, and manager drafts. Negative checks: simulated actions do not persist to the server and evidence does not leak between request contexts.
- `it-security-reviewer`: verifies public demo posture, mock-only drafts, no provider controls, and no secret leakage. Negative checks: no stack traces, tokens, database URLs, or private provider details.
- `keyboard-user`: verifies keyboard reachability and focus recovery. Negative checks: no keyboard traps in filters, drawers, draft panels, or safe-state previews.

## Flow menu

These flows are a menu, not a mandatory checklist. Select only flows relevant to the diff, plus one adjacent integration or recovery check when needed.

### W1: Overview and queue first visit

Persona: `sdm-reviewer`

1. Open `/`.
2. Verify the first viewport communicates PTO coverage readiness, Demo Mode/public demo posture, manager next actions, and no login requirement.
3. Navigate to `/requests` from visible navigation or a first-visit action.
4. Verify the queue shows request dates, team, role, risk/coverage band, recommendation, and reason text.
5. Negative check: confirm no real employee/company/customer/confidential data is displayed.

### W2: Queue filters and reset

Persona: `operations-manager`

1. Open `/requests`.
2. Apply at least one meaningful filter and one sort or direction change.
3. Verify active filter/sort state is visible in the page or URL.
4. Exercise a no-match, invalid, or narrow-range state if relevant to the diff.
5. Use reset/recovery controls and verify the baseline queue returns.
6. Negative check: invalid or empty states must not show stack traces or stale request details.

### W3: Heatmap, detail, and evidence

Persona: `operations-manager`

1. Open `/heatmap`.
2. Select a week or visible coverage segment and verify the coverage matrix updates.
3. Navigate from the heatmap or queue into a request detail page.
4. Open evidence from a recommendation reason.
5. Verify evidence items match the selected request, team/role context, and recommendation rationale.
6. Negative check: close the evidence surface before switching request context and verify stale evidence is not retained.

### W4: Browser-only simulation and manager drafts

Persona: `operations-manager`

1. Open a seeded request detail page from the queue or heatmap.
2. Trigger one demo action: Approve, Defer, or Ask for coverage.
3. Verify the state is labeled as browser-only/demo simulation.
4. Generate the matching manager draft and verify it reflects the selected request and action.
5. Refresh the page and verify simulated state resets.
6. Negative check: no persistent write UI, provider selector, provider key, saved decision copy, or non-mock provider details appear.

### W5: Accessibility and safe state previews

Persona: `keyboard-user`

1. Use keyboard navigation through the overview, queue, and one detail/evidence path.
2. Open and close the evidence drawer or panel with keyboard input and verify focus returns to a sensible trigger or nearby control.
3. Exercise one safe-state preview route relevant to the diff, such as `/?state=error`, `/heatmap?state=loading`, or `/requests?state=empty`.
4. Verify accessible names, visible headings, and recovery controls are present.
5. Negative check: safe states must not reveal stack traces, stale live data, secrets, or private integration details.

### W6: Production smoke

Persona: `it-security-reviewer`

1. Open `https://pto-readiness-planner.vercel.app`.
2. Verify no login is required and Demo Mode/public mock posture is visible.
3. Open the queue or one detail path.
4. If relevant, generate one mock manager draft.
5. Verify the production demo remains read-only, mock-only, and free of secret/provider details.
6. Record clearly that this is production smoke only and not branch-code validation.

## Evidence rules

Use `agent-browser` for all browser interactions.

- Capture accessibility snapshots after meaningful state changes and include trimmed text in `qa-results/report.md`.
- Save screenshots to `qa-results/<run-id>/` when visual evidence helps prove a visible claim; reference filenames rather than embedding image URLs.
- Capture the URL, persona, selected flow, and key assertion for each test row.
- Prefer stable visible text and accessible names over brittle selectors.
- Close browser sessions after the run.
- Never include credentials, tokens, `.env.local`, private provider endpoints, or raw environment dumps in evidence.

## Known failure modes

1. **Wrong service on port 3102.** If `/api/health` does not report `pto-readiness-planner`, stop local web testing and report `:no_entry: BLOCKED` with the observed service.
2. **No preview deployment fallback.** Branch-code web QA must use the local dev server because no preview deployments were detected. Do not use production as a fallback.
3. **Browser-only decisions reset.** Approve, Defer, and Ask for coverage are simulation states. A refresh should reset them; persistence is a failure.
4. **Evidence drawers are stateful.** Close the evidence surface before switching request context to avoid confusing stale UI with a product failure.
5. **Production cold starts or transient Vercel latency.** Retry one safe navigation or health-backed page load before marking production smoke `:warning: FLAKY` or `:no_entry: BLOCKED`.
6. **Safe-state previews must stay sanitized.** Any stack trace, secret-like value, private provider label, or real-data wording in safe states is a failure.
