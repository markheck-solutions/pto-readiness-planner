---
name: qa-api
description: >
  Functional API QA for the Team Coverage and PTO Readiness Planner. Covers
  health, bootstrap, queue, detail, assessment, evidence, manager draft,
  read-only posture, controlled errors, and no-secret leakage.
---

# QA API

Use this sub-skill only when API, seed data, safety, draft, or readiness surfaces changed.

## Target

Default local target: `http://127.0.0.1:3102`

Optional production smoke target: use only when the caller provides an HTTPS base URL.

Never use production to validate unverified branch code.

## Evidence rules

- Use `curl` or equivalent HTTP requests
- Record status code and a short sanitized response summary
- Never print secrets, database URLs, or private provider details

## Flow menu

Run only the flows relevant to the diff.

### A1: Health, demo data, and bootstrap

Persona: `it-security-reviewer`

1. Request `GET /api/health`
2. Request `GET /api/demo-data`
3. Request `GET /api/bootstrap`
4. Verify demo mode, metadata, and no secret leakage

### A2: Queue, detail, assessment, heatmap, coverage, windows, and evidence

Persona: `operations-manager`

1. Request `GET /api/pto-requests`
2. Use a seeded request such as `REQ-1001`
3. Request detail, assessment, evidence, heatmap, coverage, and critical windows
4. Verify the responses are deterministic and explainable

### A3: Draft endpoint

Persona: `operations-manager`

1. Request `POST /api/manager-draft`
2. Verify mock response metadata in public demo mode
3. Verify the draft changes with request and action context
4. Verify no provider details or secrets are exposed

### A4: Invalid input and read-only posture

Persona: `it-security-reviewer`

1. Request an invalid queue filter
2. Request `GET /api/evidence?ids=,,,`
3. Attempt a client override field on `POST /api/manager-draft`
4. Attempt an unsupported method on a read-only endpoint
5. Verify controlled 4xx or 405 responses

### A5: Production smoke when provided

Persona: `it-security-reviewer`

1. Run `GET /api/health`
2. Run one safe queue or detail request
3. Optionally run one demo draft request
4. Verify demo-safe behavior and no secret leakage

## Known failure modes

1. If `/api/health` does not report `pto-readiness-planner`, stop and report BLOCKED.
2. Draft requests must stay mock-only in public demo mode. Treat any client-side provider override as a failure if it succeeds.
3. Error responses must be controlled JSON. Treat stack traces or secret-like strings as failures.
