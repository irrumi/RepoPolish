# Trust model and limitations

The core has no process-execution or network modules. The default capability set is
repository reads only. A reviewed in-memory plan plus explicit write intent enables
only planned local Markdown edits. Config, document text, existing authentication
and `--yes` cannot enable subprocesses or network operations.

Paths are checked against a canonical root; parent chains reject symlinks, junctions,
special files, traversal and ambiguous path forms. Arbitrary link contents are never
opened: only scanned Markdown is parsed for fragments. Symlinks produce incomplete
evidence. Directory links are not followed. Sensitive files are skipped even if linked.

Source bytes and the scanned evidence inventory are fingerprinted. Application checks
the entire snapshot, validates every target, stages same-directory temporary files,
then rechecks each target before atomic replacement. New files use exclusive link
creation; existing files use rename. POSIX file modes are retained. Windows ACLs and
extended attributes are not promised to be preserved.

Per-file atomic writes are not a multi-file transaction. If one replacement fails,
the writer stops and returns the already applied paths. It removes safely reachable
temporary files; it never rolls back over possible new human edits. Inspect the diff
and re-audit before retrying. Interrupted processes can leave `.repopolish-*.tmp` files
beside target documents; inspect them before removing them.

There remains a narrow filesystem race between the final checks and rename/open,
especially if another process maliciously swaps directories. This is defensive file
handling, not an OS sandbox. Do not concurrently mutate repository paths during fixes.
Hard links are replaced rather than written in place. Tests cover Windows junctions,
traversal and observed concurrent changes; they do not prove universal race immunity.

Reports avoid raw source excerpts and redact common token/password forms and terminal
controls. Previews redact recognized secrets, while edits preserve original source
bytes. Redaction cannot recognize every secret format: review output before sharing.
The JS API returns raw in-memory plans for trusted callers; do not publish these or
deserialize a plan from untrusted repository text and apply it.

The agent wrappers execute a specifically selected installed engine using the current
Node executable, argument arrays and `shell: false`. They verify expected package
metadata, but those fields are not a signature. The host must independently select a
trusted installation outside the untrusted target. No `npx`, downloads, hooks or
automatic user settings changes are included.

Host agents treat source text as evidence, not new permissions. Their model-provider
privacy is independent of the offline engine. Synthetic adversarial fixtures establish
only tested deterministic behavior, not universal prompt-injection resistance.

Private security reporting and community enforcement channels require maintainer input.
See the [security draft](policies/security-policy-draft.md) and
[conduct draft](policies/code-of-conduct-draft.md).
