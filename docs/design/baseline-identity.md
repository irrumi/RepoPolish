# RP-02: baseline identity contract (proposal)

Status: design and regression inputs only; manual review required. No baseline
reader, writer, comparator, public API export or CLI option ships with this note.
Comparison and serialization belong in a later, separate PR. Existing report v1
and display IDs remain unchanged. See [report v1](../report.md).

## Problem and scope

`inspect` hashes rule, scope, evidence (including source line) and message for the
display ID. Inserting a blank line changes it. Two absent anchors in one document
line can have identical evidence and messages despite different fragments. Removing
all evidence or using display IDs as set keys would silently merge occurrences.

The first baseline implementation should support local link and literal script
findings with explicit semantic data from their verifiers. Other rules remain
unknown for baseline matching until each has a reviewed identity adapter. Do not
recover identity by parsing human-readable messages or sanitized report strings.

## Proposed internal identity contract

Keep display ID for current diagnostics and repair plans. A separate versioned
semantic key uses an unambiguous canonical JSON array, hashed with full SHA-256:

- Identity algorithm version and rule ID
- Canonical root-relative POSIX document path and nearest package scope; preserve
  case and Unicode, reject escaping/absolute paths, use `.` for root scope
- Typed subject: link node kind plus safely normalized local target and exact
  decoded fragment, or package-manager name plus literal script name and manifest
  path/key; retain supported literal arguments when they change the claim
- Bounded structural context: containing heading ancestry (depth at most six) and
  node kind, hashed separately; no source line, byte offset, prose, timestamps,
  severity, suppression, rendered message or entire source file in the key

Do not truncate context to fit a budget or silently discard a subject. If required
identity data exceeds a documented limit or cannot be safely extracted, mark that
occurrence unknown. Do not hash unknown/unsupported targets as if verified. Preserve
link fragments, distinct target paths and package scopes; non-semantic blank-line
shifts alone must leave the key unchanged. Heading or document moves may legitimately
create new identities; this slice promises line-shift stability, not rename tracking.

A key identifies a semantic group, not a unique occurrence. Keep a multiset count
and an occurrence ordinal within that group for display association. Match counts
one-to-one: two old identical occurrences and three current ones mean two existing
and one new. Removing one means one resolved, never all resolved. Ordinals cannot
prove which indistinguishable copy survived; disclose this instead of fabricating
source continuity. Different fragments on the same line must have different keys.
Keep canonical tuples in memory to detect a hash collision; ambiguity fails closed.

## Proposed persistence boundary

A strict, size-bounded baseline envelope contains only these reviewed fields:

- `schemaVersion`: baseline schema, independent of report schema
- `identityVersion`: canonicalization/adapter version
- `toolCompatibility`: explicit supported tool contract, not an assumed semver match
- `sourceId`: explicit user-selected opaque project identifier, never a root path
- `rootScope`: safe relative subtree (`.` at the selected root)
- `coverageDigest`: digest of relevant scan configuration and enabled adapters
- `entries`: fingerprint and positive bounded occurrence count, deterministically sorted

Source identity is not inferred from a machine path or auto-fetched Git remote.
The caller must supply an expected source ID independently of the loaded baseline;
a different project/root scope must be rejected. This prevents accidental mixing,
not adversarial substitution by someone who controls both inputs. An explicit copy
of the same project can share the identifier across machines. Reviewers must approve
this tradeoff before implementation.

Reject unknown fields, unsupported versions, duplicate entry keys, malformed hashes,
invalid counts, wrong source/root, changed coverage and incompatible tools before
comparison. A baseline can be created only from complete, compatible evidence.
Never serialize absolute paths, raw claim text, headings, URLs, snippets, messages,
plan bytes or credentials. Hashes are not encryption; dictionary guessing remains
possible, so review baseline diffs as repository data. Sensitive or unsafe subjects
remain unknown rather than being persisted as raw strings or redacted placeholders.

## Future API and comparison behavior

Proposed internal operations are explicit creation, validation and comparison of
in-memory evidence and envelopes. Names and signatures require review in the
implementation PR; this note advertises no callable API or future CLI spelling.
Ordinary audit remains read-only. Creating/updating a baseline requires explicit
intent, a reviewable diff and separate write approval; audit never refreshes it.

Return all observed findings with existing/new/unknown classification and retain
resolved counts separately. Suppression remains visible and is not a repair.
Incomplete scans, wrong source/schema/coverage and incompatible tools return an
error independently of severity thresholds. Partial scans have overall unknown
comparison status and cannot certify resolution; absent findings are unknown,
not resolved. Unsupported checks remain visible even when `complete` is true.

## Regression corpus and next gate

The synthetic corpus at `tests/fixtures/baseline-identity/cases.json` specifies
future expected classifications. Scanner-backed tests currently verify its actual
findings, blank-line display-ID instability, same-line anchor occurrences, package
scope, read-only behavior and partial-scan exit 2. They do **not** implement or claim
to test future semantic matching or baseline validation. Compatibility entries are
acceptance vectors for the later validator, not executable checks today.

The separate implementation PR must consume these vectors and add executed rejection
tests for wrong root/schema/tool/coverage, unsafe envelope fields and collision
handling. It must prove unchanged/line-shift equality; changed script/fragment
inequality; repair resolution; duplicate multiplicity; no private paths/snippets;
and incomplete/unsupported evidence staying unknown. No Git execution, network
fetch, provider integration or publication is part of this contract.
