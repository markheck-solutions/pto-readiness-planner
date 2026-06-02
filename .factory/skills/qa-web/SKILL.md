---
name: qa-web
description: >
  Functional browser QA for the Team Coverage and PTO Readiness Planner web
  experience. Covers overview, queue, heatmap, detail, evidence, simulated
  decisions, manager drafts, accessibility, and safe recovery flows.
---

# QA Web

Use this sub-skill only when browser behavior, route state, or visual decision-support flows changed.

## Target

Default local target: `http://127.0.0.1:3102`

Optional production smoke target: use only when the caller provides an HTTPS base URL.

Never use production to validate unverified branch code.

## Evidence rules

- Use `agent-browser`
- Capture accessibility snapshots after meaningful state changes
- Save screenshots when they prove a visible claim
- Close browser sessions after the run

## Flow menu

Run only the flows relevant to the diff.

### W1: Overview and queue first visit

Persona: `sdm-reviewer`

1. Open `/`
2. Verify the first viewport shows manager-focused PTO coverage context, Demo Mode, and next actions
3. Navigate to `/requests`
4. Verify the queue shows request dates, team, role, risk, recommendation, and reason text

### W2: Queue filters and recovery

Persona: `operations-manager`

1. Apply at least one filter and one sort change in `/requests`
2. Verify the active state is visible
3. Exercise a no-match or invalid-range case
4. Verify recovery actions return to the baseline queue

### W3: Heatmap, detail, and evidence

Persona: `operations-manager`

1. Open `/heatmap`
2. Select a week and verify the coverage matrix appears
3. Open a request detail route from the heatmap or queue
4. Open the evidence drawer from a recommendation reason
5. Verify the evidence matches the selected request context

### W4: Browser-only decision simulation and drafts

Persona: `operations-manager`

1. Open a seeded request detail route
2. Trigger Approve, Defer, or Ask for coverage
3. Verify the state is labeled as demo simulation only
4. Generate a manager draft and verify it reflects the selected request and action
5. Refresh and verify the simulated state resets

### W5: Accessibility and safe state previews

Persona: `keyboard-user`

1. Verify the main flow is keyboard reachable
2. Open and close the evidence drawer with keyboard input
3. Exercise one safe-state preview route such as `/?state=error` or `/heatmap?state=loading`
4. Verify no stale live data, stack traces, or private details are shown

### W6: Production smoke when provided

Persona: `it-security-reviewer`

1. Open the provided HTTPS base URL
2. Verify no login is required
3. Verify Demo Mode is visible
4. Open queue or detail and verify mock-only draft posture remains visible

## Known failure modes

1. If `/api/health` does not report `pto-readiness-planner`, the browser run is blocked.
2. Evidence drawer tests are stateful. Close the drawer before switching to another request.
3. Public smoke should never expose a provider selector or saved decision copy.
