## QA Report

| #   | Target | Test Case | App | Persona | Result | Notes |
| --- | ------ | --------- | --- | ------- | ------ | ----- |

{{TEST_ROWS}}

Result values: :white_check_mark: PASS, :x: FAIL, :no_entry: BLOCKED, :warning: FLAKY, :grey_question: INCONCLUSIVE

### Summary

- Local target: {{LOCAL_TARGET}}
- Production smoke target: {{PRODUCTION_TARGET}}
- Scope basis: {{SCOPE_BASIS}}
- Apps exercised: {{APPS_EXERCISED}}

{{#if ACTIONABLE_ITEMS}}

### Action Required

{{ACTIONABLE_ITEMS}}
{{/if}}

<details>
<summary>Screenshots and evidence</summary>

{{EVIDENCE}}

</details>
