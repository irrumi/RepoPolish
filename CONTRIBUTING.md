# Contributing

Use Node 24 or newer. Install exact locked dependencies with `npm ci --ignore-scripts`.
Run `npm run validate` before proposing changes. The full suite includes formatting,
lint, strict typing, tests/build, disposable fresh-source and tarball installation,
installed CLI/wrapper smoke tests and self-audit. `npm run format` applies formatting.

For a focused regression after `npm run build`, run:

```sh
node --test tests/safety.test.mjs
```

Report reproducible bugs through the repository's issue templates using synthetic
fixtures and redacted report fields. Include rule IDs, platform and Node version.
Do not post secrets or exploitable private security details in public issues; a
private reporting policy remains [pending](docs/policies/security-policy-draft.md).

## Adding a check

Start from `src/rules/readme-quick-start.ts` and `tests/extensions.test.mjs`. Add a
typed rule module, register metadata in `src/rules.ts`, and test both the intended
finding and a plausible counterexample. Metadata supplies explain output and must
describe evidence, support boundaries and fix risk. See [architecture](docs/architecture.md).

Add parsers in `analyzers` or dedicated modules without importing target code.
Preserve package scope, source evidence and partial-analysis errors. For a claim
extractor, make coverage explicit before reporting negative evidence. For a fixer,
test dry-run, unrelated prose, line endings, simultaneous edits, path boundaries,
partial failure and repeated application. Do not make policy or licensing choices.

The runtime extension contract is currently internal. Do not load executable plugins
from analyzed repository configuration. Keep optional subprocess/network capabilities
separate from static auditing and local-write approval.

## Review expectations

Keep changes narrow and explain the concrete behavior. A passing static report does
not establish all documentation claims. New support claims need executed tests; a CI
matrix or agent manifest alone is insufficient. Do not add success badges for runs
that have not been observed or advertise publication that has not occurred.
