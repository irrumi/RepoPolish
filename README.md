# RepoPolish

Audit documentation claims against repository files, explain the evidence, and preview
small repairs before writing.

RepoPolish is a local-first CLI for maintainers and coding agents. It checks Markdown
links and headings, supported package-script examples, selected runtime requirements
and explicit license contradictions. It does not need an LLM API key or execute the
repository it audits. Version 0.1.0 is an initial, unpublished release candidate.

## Quick Start

Requires Node.js >=24

Install from this source checkout. These commands execute RepoPolish's reviewed
development tooling; auditing arbitrary repositories does not run their tooling.

```sh
npm ci --ignore-scripts
npm run build
node dist/cli.js audit examples/messy-repo
node dist/cli.js fix examples/messy-repo --dry-run
```

The demo intentionally exits 1 because it contains a stale script. A compact excerpt
captured from that fixture:

```text
WARNING link.case [verified] README.md:7
  Link casing differs from docs/usage.md.
ERROR script.missing [verified] README.md:10
  Documented script check is absent from the scoped manifest.
1 errors, 1 warnings, 0 suggestions, 0 information; 0 suppressed.
```

The fix preview corrects only the link casing; the stale script remains for review.
Run `node dist/cli.js fix PATH --yes` to explicitly apply eligible changes to your target.

For installation outside the checkout, build and pack locally:

```sh
npm run build
npm pack --ignore-scripts
npm install --global ./irrumi-repopolish-0.1.0.tgz --ignore-scripts
repopolish --help
repopolish audit /path/to/repository --json
```

On Windows, use a quoted Windows directory path. Local tarball installation and the
Windows npm command shim are covered by `npm run smoke`. The package is named
`@irrumi/repopolish` and has `private: true` to prevent accidental publication.
There is no advertised registry or marketplace installation route.

## Commands

| Command                 | Behavior                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| `audit [path]`          | Read-only static findings, facts, evidence and coverage limits    |
| `check [path] --safe`   | The same static verification engine; no execution runner          |
| `fix [path] --dry-run`  | Show eligible local changes and unified diffs; default is preview |
| `fix [path] --yes`      | Apply eligible link casing corrections and re-audit               |
| `readme [path]`         | Propose a new draft or targeted repair of an existing README      |
| `readme [path] --write` | Explicitly save the proposed draft or targeted repair             |
| `launch [path]`         | Local description, topic, social-preview and demo recommendations |
| `launch [path] --check` | Include a CI exit result from the aggregated static checks        |
| `explain <rule-id>`     | Rule purpose, evidence, limitations, suppression and fix details  |

Every command supports `--help`. Audit/check accept `--ci`, `--json`, `--quiet`,
`--no-color` and `--fail-on error|warning|suggestion|none`. There is no color or animation.
All paths default to the current directory. `--json` emits JSON only on stdout,
including input errors; write previews go to stderr before writes.

## Supported evidence

| Area       | Implemented scope                                                                                 | Boundary                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Markdown   | CommonMark/GFM links, images, reference definitions, heading anchors, Unicode and duplicate slugs | HTML/custom/MDX anchors and external links are not verified                                                   |
| JS/TS      | package.json identity, scripts, bins, engines.node, package manager and workspace declarations    | Literal standalone npm/pnpm `run` examples only; Yarn fallback and dynamic CLI/API extraction are unsupported |
| Python     | PEP 621 project fields, runtime declaration and console-script entry points                       | No imports, setup.py evaluation, legacy tool tables or runtime compatibility verifier                         |
| Rust       | Cargo package fields, workspace members, explicit bin paths                                       | No workspace inheritance, implicit targets or runtime compatibility verifier                                  |
| Workspaces | Recursively detected manifests and nearest-package documentation scope                            | Advanced workspace formats and cross-package shell contexts remain unsupported                                |
| Licensing  | Selected single SPDX IDs and recognized MIT/Apache texts, explicit README declarations            | Contradictions require review; no license selection or legal conclusion                                       |

Facts are **detected**, not proof of working behavior. Findings separately state
severity and verification status. A declared test script does not mean tests pass;
local package metadata does not establish publication. Exit 0 means no blocking
findings within supported scope, not overall correctness or release safety.

## Safety and privacy

Default audit, check, draft and launch commands read local evidence only: no network,
telemetry, source upload, cache writes, imports or repository subprocesses. Symlinks,
special files and sensitive paths are refused or skipped. Resource limits produce an
explicit partial report. See [the trust model](docs/security.md).

Fixes preserve surrounding prose, line endings and BOMs. Plans include fingerprints,
evidence and exact diffs; source changes abort application. `--yes` authorizes eligible
local edits only. Existing READMEs are never fully regenerated. A missing README draft
marks unknown purpose, installation and policy information for maintainer input.

## Agent integrations

The package includes a **Codex skill** and **Claude Code plugin**. Both run the same
offline engine before and after requested documentation edits. The agent may improve
wording using implementation evidence and maintainer context. A host agent may send
content to its provider according to its own configuration.

See [installation, invocation, update and removal](docs/integrations.md). Integration
structure and wrappers are tested; host manifest validation is distinct from a full
live semantic editing session.

## Configuration and CI

Optional `.repopolish.json` supports versioned JSON configuration, docs locations,
exclusions, scoped suppressions with reasons, language, project type and scan budgets.
See [configuration and exit codes](docs/configuration.md) and [CI](docs/ci.md).
Malformed input and incomplete scans return 2 even with `--fail-on none`.

## Development and limitations

```sh
npm run validate
```

This runs typing, lint, formatting, tests, build, fresh-source and package installation
smoke tests, and self-audit. See [contributing](CONTRIBUTING.md),
[architecture and research](docs/architecture.md), [report contract](docs/report.md)
and [implementation/validation status](docs/implementation.md).

Process execution, GitHub/registry reads or writes, Git baseline/diff analysis, full
README regeneration, API inference and additional agent hosts are deferred. No flags
pretend these features work. English draft templates only; existing prose is preserved.

Security and conduct policies are [drafts awaiting real reporting and enforcement
channels](docs/policies/security-policy-draft.md), not adopted maintainer commitments.

## License

License: MIT

See [LICENSE](LICENSE). Copyright holder is the repository owner, `irrumi`.
