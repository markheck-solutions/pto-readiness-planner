---
name: qa-api
description: >
  Functional API QA for PTO Readiness Planner. Covers health, bootstrap, queue,
  detail, assessment, heatmap, coverage, evidence, manager drafts, invalid input,
  read-only posture, repo secret safety, and production public API smoke.
---

# QA API

Use this sub-skill for HTTP-visible behavior, App Router API route changes, seeded demo data contracts, manager draft safety, error handling, read-only posture, and public production API smoke. This is manual/functional API QA only; do not run unit tests, lint, typecheck, builds, or static scans from this skill.

## Testing Target

No Vercel preview deployments were detected.

### Local branch-code target

For PR, branch, and worktree code validation:

1. Start the app locally from the repository root with `npm run dev` if it is not already running.
2. Poll `http://127.0.0.1:3102/api/health` with `curl` until ready.
3. Verify the health response reports `service: pto-readiness-planner` and `demoMode: true`.
4. Use `http://127.0.0.1:3102` as the base URL for branch-code API testing.
5. Never fall back to production or another remote environment for branch-code testing.

If local startup or health verification cannot complete, report all affected local API flows as `:no_entry: BLOCKED` with what was tried and how to fix it.

### Production smoke target

Production API smoke uses the fixed public URL `https://pto-readiness-planner.vercel.app` only as an additional smoke target. It never replaces local branch-code QA and must stay read-only, demo-safe, and mock-only.

## Authentication and safety

No login, API key, or persona credential is required. Use `curl`/`curl.exe` and never print secret values. Do not read `.env.local`, dump process environments, or include token-like values in reports. For each response, record only method/path, status code, and a short sanitized note.

## Personas and negative checks

- `it-security-reviewer`: verifies no-auth read-only public APIs, controlled errors, mock-only draft posture, and no secret leakage.
- `operations-manager`: verifies queue, detail, assessment, heatmap, coverage, windows, evidence, and manager draft data are deterministic and explainable.
- `sdm-reviewer`: verifies API data supports manager-facing overview and queue claims.
- `keyboard-user`: not a primary API persona; include only when API data directly affects accessible safe-state or recovery behavior.

## Flow menu

These flows are a menu, not a mandatory checklist. Select only flows relevant to the diff, plus one adjacent integration or recovery check when needed.

### A1: Health, demo data, and bootstrap

Persona: `it-security-reviewer`

Use the selected base URL.

1. `GET /api/health`.
2. `GET /api/demo-data`.
3. `GET /api/bootstrap`.
4. Verify successful responses are JSON, identify public demo/mock posture, and contain no secret-like values.
5. Negative check: the health/bootstrap data must not expose database URLs, tokens, provider endpoints, or private local AI settings.

### A2: Queue, detail, assessment, heatmap, coverage, windows, and evidence

Persona: `operations-manager`

1. `GET /api/pto-requests?sort=risk&dir=desc`.
2. Select seeded request `REQ-1001` if present; otherwise use the first returned seeded request id and note it in evidence.
3. `GET /api/pto-requests/{requestId}`.
4. `GET /api/pto-requests/{requestId}/assessment`.
5. `GET /api/calendar-heatmap`.
6. `GET /api/coverage` or `GET /api/coverage?teamId=<seededTeamId>` when a team id is available.
7. `GET /api/critical-windows`.
8. `GET /api/evidence?requestId={requestId}` and, when evidence ids are returned, one `GET /api/evidence?ids=<comma-separated-safe-ids>` request.
9. Verify responses are deterministic, explainable, and internally consistent with the selected request/team/role context.
10. Negative check: unsupported methods on read-only endpoints must return controlled `405` responses.

### A3: Manager draft public mock

Persona: `operations-manager`

1. `POST /api/manager-draft` with JSON such as `{"requestId":"REQ-1001","action":"approve"}` when that seeded id exists.
2. Repeat with one different valid action when relevant: `approve_with_coverage_actions`, `ask_for_coverage`, or `defer`.
3. Verify the response is public mock output, changes with request/action context, and does not expose provider controls or private provider details.
4. Negative check: a body with extra fields such as `provider`, `apiKey`, or `baseUrl` must be rejected with controlled JSON.

### A4: Invalid input and read-only posture

Persona: `it-security-reviewer`

1. Request an invalid queue filter such as `GET /api/pto-requests?status=not-a-status`.
2. Request `GET /api/evidence?ids=,,,`.
3. Request a nonexistent detail id such as `GET /api/pto-requests/REQ-DOES-NOT-EXIST`.
4. Attempt an unsupported method on a read-only endpoint, such as `POST /api/pto-requests` or `POST /api/health`.
5. Attempt a manager draft with an invalid action such as `approve_now`.
6. Verify controlled `4xx` or `405` JSON, no stack traces, no unhandled HTML error pages, and no secret-like values.

### A5: GitHub secret names and repo safety

Persona: `it-security-reviewer`

Use this flow when the diff touches environment examples, safety scripts, workflows, QA config, or API surfaces that report integration posture.

1. Verify API responses and public config surfaces expose only safe posture/names, never secret values.
2. Do not read or print `.env.local`.
3. If reviewing repository files is necessary, inspect only tracked/public files such as `.env.example` and workflow YAML for secret names or placeholders; never include values in the QA report.
4. Verify public manager draft and bootstrap behavior remains mock-only by default.
5. Negative check: any hardcoded token-looking value, private provider endpoint, database URL, or secret value in a public response or tracked config is a failure.

### A6: Production API smoke

Persona: `it-security-reviewer`

1. Use `https://pto-readiness-planner.vercel.app`.
2. `GET /api/health` and verify public demo/mock posture.
3. Run one safe queue or detail request.
4. Optionally run one mock `POST /api/manager-draft` with a seeded request/action if the endpoint is relevant.
5. Verify production remains no-auth, read-only/demo-safe, mock-only, and free of secret/provider details.
6. Record clearly that this is production smoke only and not branch-code validation.

## Evidence rules

- Use `curl`/`curl.exe`; do not use browser automation for API-only checks.
- For each checked request, record method/path, status code, and a short sanitized response note.
- Capture enough response shape to prove the assertion, but redact or omit any secret-like values if encountered.
- Never include raw environment dumps, `.env.local`, tokens, database URLs, provider keys, or private local AI details.
- Save concise API evidence in `qa-results/report.md` under the collapsed evidence block.

## Known failure modes

1. **Wrong service on port 3102.** If `/api/health` does not report `pto-readiness-planner`, stop local API testing and report `:no_entry: BLOCKED` with the observed service.
2. **No preview deployment fallback.** Branch-code API QA must use the local dev server because no preview deployments were detected. Do not use production as a fallback.
3. **PowerShell curl alias.** On Windows PowerShell, use `curl.exe` when command-line flags must pass through exactly.
4. **Public draft provider safety.** Default QA must stay `AI_PROVIDER=mock`; client-side provider override fields should be rejected.
5. **Controlled JSON errors only.** HTML error pages, stack traces, or secret-like strings in invalid-input responses are failures.
6. **Production smoke is additional.** Passing production API smoke does not prove branch-code API changes; local branch-code checks are still required for app diffs.
