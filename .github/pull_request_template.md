## Summary

What changed, in practical terms?

## Why

What problem does this solve?

## Validation

Commands run:

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] `npm run safety`
- [ ] `npm run quality:check`
- [ ] `npm run readme:verify`
- [ ] `npm run readiness-report`
- [ ] `npm run test:browser` (if browser surfaces or routes were touched)

## Demo safety checklist

- [ ] No real employee, company, customer, schedule, HR, medical, compensation, performance, or confidential staffing data was introduced.
- [ ] No secrets or secret-like values were introduced in code, logs, docs, comments, screenshots, tests, or commit messages.
- [ ] Public demo remains no-login and mock-only by default.
- [ ] Any approve, defer, or ask for coverage behavior remains browser-only simulation and resets on refresh.
- [ ] Prose and visible copy avoids Unicode em dash or en dash characters.
