# Configuration and exits

Only the selected repository's `.repopolish.json` is loaded. It is data, never code.
Unknown keys, unknown ignored rule IDs, invalid types and escaping paths are errors.
No user-wide or parent configuration is loaded. JSON is the only config format.

```json
{
  "version": 1,
  "docs": ["guide.md"],
  "exclude": ["examples", "generated"],
  "ignore": [
    {
      "id": "readme.quick-start",
      "scope": ".",
      "reason": "The introduction is intentionally a protocol specification."
    }
  ],
  "failOn": "error",
  "language": "en",
  "projectType": "library",
  "limits": {
    "files": 10000,
    "fileBytes": 524288,
    "totalBytes": 20971520,
    "depth": 20
  }
}
```

All fields except version are optional. Paths use `/`, are relative to the selected
root, and may not contain traversal, drive prefixes, alternate data streams or
ambiguous Windows path components. `exclude` matches an exact path or subtree;
it does not accept globs. `docs` explicitly includes paths otherwise ignored by root
.gitignore and identifies alternative README files. All non-excluded `.md` files are
normally analyzed. An explicitly excluded directory stays excluded.

Only the root `.gitignore` is interpreted. Nested ignore files are not applied.
Root metadata and root Markdown remain inspectable even if gitignored. Built-in
exclusions include `.git`, `node_modules`, vendor, virtual environments, build/dist,
Rust target, coverage and sensitive paths; config cannot grant access to them.
Sensitive names include `.env*`, private-key file extensions, `.aws`, `.ssh`, `.gnupg`.
Explicitly selected roots are canonicalized; no files outside that root are inspected.

`files` limits visited directory entries, not only parsed files. Limits may be raised
up to 50,000 entries, 2 MiB per file, 100 MiB parsed content and depth 64. JSON/TOML
nesting is capped at 64 and Markdown traversal at 100,000 nodes. No filesystem cache
is written. Unexpected skipped evidence creates `scan.incomplete` and exit 2.

Suppression is exact by rule ID and optionally package scope (`.` means root).
Suppressed findings remain in JSON with a reason, do not count toward severity
thresholds, and do not produce automatic fixes. Suppression never makes an incomplete
scan complete. Project type is recorded as user-provided, not independently verified.
Language controls English structural advice and draft eligibility; it is not translation.

| Exit | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| 0    | Completed below the configured severity threshold; preview created without writes         |
| 1    | Completed audit/re-audit exceeds the chosen severity threshold                            |
| 2    | Invalid arguments/config/root, partial analysis, denied/failed writes or changed evidence |
| 3    | Unexpected internal failure                                                               |

Threshold `error` is the default. `warning` includes errors; `suggestion` includes
warnings and errors. `none` never suppresses invalid/partial failures. CLI `--fail-on`
overrides config. Preview commands report whether planning completed, independently
of pre-existing findings. Launch recommendations default to 0 for complete analysis;
`launch --check` applies the audit threshold. JSON errors are single objects on stdout.
