# Report contract v1

`audit --json` and `check --json` emit a single versioned object with no progress text.
The JS API exports `audit`, `inspect`, `exitCode`, `fixPlan`, `applyPlan`, generators,
the rule registry and TypeScript types through the package root.

Fields: `schemaVersion`, `toolVersion`, `complete`, `capabilities`, `facts`, `findings`,
`checks`, `limitations`, and `summary`. Paths in evidence are repository-relative.
Manifest evidence includes a JSON-pointer-style key path. Markdown evidence has a
one-based source line. Stable sorting uses scope, rule ID, file and source line.
Reports omit machine paths, timestamps and random identifiers.

Facts contain a name, value, scope, status and evidence. A finding adds a stable ID,
rule ID, severity, message, verification outcome, fixability and optional suppression.
Statuses include verified, detected, inferred, user-provided, unknown, unsupported
and skipped. Severity is independently error, warning, suggestion or info.

Finding IDs hash rule, scope, source evidence and message; they remain stable for
unchanged input. Moving source lines can change IDs. They are not durable Git-baseline
identifiers; baseline support is deferred. Before/after output identifies findings by
ID, refuses to claim resolution after incomplete analysis, and does not count suppressions
as repairs.

`complete` means the scanner and supported parsers completed within their configured
scope. Unsupported CLI/API and remote checks can still exist in a complete report.
A malformed manifest or unexpected read/limit failure makes it false. All unknown
checks remain visible, including unavailable registry and execution evidence.

Change-plan schema v1 includes the snapshot fingerprint, required write capability,
target paths, original hashes or expected absence, original/proposed bytes, exact diffs,
reasons, finding IDs and risk. CLI previews redact common secrets; raw plans are a
trusted in-memory API only. There is deliberately no `apply saved-plan.json` command.

`explain RULE` uses the same registry as findings and provides evidence, extraction
limits, false-positive caveats, suppression shape and fix availability. It explains a
rule generically; it does not load a historical report.
