# Maintenance queue

## RP-02 — stable baseline identity

- Problem/evidence: display IDs include source lines; same-line anchor findings can
  share an ID. See the scanner-backed identity corpus and
  [proposed contract](../design/baseline-identity.md).
- Status: contract and regression inputs prepared for manual review; semantic
  fingerprint extraction, envelope validation and comparison are not implemented.
- Dependency: RP-01 reproduced on Node 24.19.0: full validation and copied-demo
  audit, dry-run, apply and repeat checks passed (remaining script error is expected).
- Acceptance: line shifts preserve identity; changed targets/scripts do not; duplicate
  counts survive; repairs resolve only after complete compatible analysis; wrong
  root/schema and private envelope fields fail closed.
- Risk: API/data-format and privacy design requires manual review.
- Change reference: branch `maint/rp-02-baseline-identity-contract`.
- Next small step: implement reviewed identity adapters and baseline comparison in
  a separate PR, consuming the existing fixture expectations.
