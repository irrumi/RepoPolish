# RepoPolish

An offline CLI that catches broken Markdown links and outdated package-script examples
before they trip up your users.

Check documentation against the files and metadata in your repository, see the evidence
for each finding, and preview link casing fixes. No API keys or LLM required.

[![Validate](https://github.com/irrumi/RepoPolish/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/irrumi/RepoPolish/actions/workflows/ci.yml)

## Quick Start

Requires **Node.js >=24**, npm and Git. Version **0.1.0 is an unreleased MVP**;
install from source. There is no published npm package or GitHub release.

```sh
git clone https://github.com/irrumi/RepoPolish.git
cd RepoPolish
npm ci --ignore-scripts
npm run build
node dist/cli.js audit examples/messy-repo
```

The included demo has a link with incorrect casing and an example calling a missing script.
Its audit **intentionally exits 1**. Actual output excerpt:

```text
WARNING link.case [verified] README.md:7
  Link casing differs from docs/usage.md.
ERROR script.missing [verified] README.md:10
  Documented script check is absent from the scoped manifest.
1 errors, 1 warnings, 0 suggestions, 0 information; 0 suppressed.
```

Preview the repair without changing the demo:

```sh
node dist/cli.js fix examples/messy-repo --dry-run
```

The diff changes `docs/Usage.md` to `docs/usage.md`. The stale script remains for
maintainer review. To audit your own project, replace `examples/messy-repo` with its
directory path; quote paths containing spaces.

## Why RepoPolish?

Documentation drifts as files move, scripts change and runtime requirements evolve.
A Markdown link checker can find a broken link, but it cannot tell you that a documented
`npm run` command refers to a script absent from the relevant package.

RepoPolish gives maintainers and coding agents one local report with file locations,
evidence and explicit coverage limits. Use it while reviewing documentation changes or
as a static CI check, without running the project being inspected.

- **Catch stale instructions:** check local links, heading anchors, supported npm/pnpm
  script examples, Node runtime conflicts and selected license contradictions.
- **Review before writing:** inspect unified diffs; apply eligible link casing repairs
  only with `--yes`.
- **Keep findings in context:** associate documentation with the nearest package
  manifest in a workspace.
- **Use the same evidence in CI and agents:** get JSON reports, severity thresholds,
  rule explanations and bundled Codex/Claude Code integrations.

```text
Local Markdown + package metadata
               |
        Static verification
               |
    Findings + evidence + limits
               |
      Preview eligible repairs
               |
    Explicit write -> re-audit
```

## Installation

The source checkout above is the primary installation method. Setup downloads npm
dependencies and runs RepoPolish's build tooling; the audit engine itself works offline.

To use `repopolish` from any directory, build a local tarball from that checkout:

```sh
npm run build
npm pack --ignore-scripts
npm install --global ./irrumi-repopolish-0.1.0.tgz --ignore-scripts
repopolish --help
repopolish audit /path/to/repository --json
```

Replace `/path/to/repository` with a real directory. On Windows, for example, use
`repopolish audit "C:\Projects\My App" --json`. Local tarball installation and the
Windows npm command shim are covered by `npm run smoke`. The package is named
`@irrumi/repopolish` and has `private: true` to prevent accidental publication.

## Usage

From the source checkout, inspect a repository, preview fixes, then apply them when ready:

```sh
node dist/cli.js audit /path/to/repository
node dist/cli.js fix /path/to/repository --dry-run
node dist/cli.js fix /path/to/repository --yes
```

For CI, fail on warnings as well as errors and emit a machine-readable report:

```sh
node dist/cli.js audit /path/to/repository --ci --fail-on warning --json
```

Exit `0` means the scan completed below the chosen threshold, `1` means findings
exceed it, `2` means invalid input, incomplete evidence or a write conflict, and `3`
means an unexpected internal failure. Preview success does not mean the repository
has no findings. See [CI setup](docs/ci.md) and [the JSON report contract](docs/report.md).

### Commands

Use `node dist/cli.js --help` in the checkout, or `repopolish --help` after installing
the tarball. The table uses the installed command's subcommands.

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

## Supported environments and checks

The CLI requires Node.js >=24. The validation suite has passed on **Linux, macOS and
Windows with Node 24** ([verified CI run](https://github.com/irrumi/RepoPolish/actions/runs/36719228009)).
Python and Rust are metadata sources; their runtimes are not needed for an audit.

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

Default `audit`, `check`, `readme` and `launch` commands read local evidence only: no network,
telemetry, source upload, cache writes, imports or repository subprocesses. Symlinks,
special files and sensitive paths are refused or skipped. Resource limits produce an
explicit partial report. See [the trust model](docs/security.md).

Fixes modify eligible Markdown files inside the selected repository and preserve
surrounding prose, line endings and BOMs. Plans include fingerprints, evidence and
exact diffs; detected source changes stop application. `--yes` authorizes eligible
local edits only. No backups are created, and a multi-file write is not one transaction;
review the reported applied paths if a write fails.

Existing READMEs are never fully regenerated. `readme --write` saves eligible link
corrections or creates a missing README draft that marks unknown purpose, installation
and policy information for maintainer input. Review output before sharing: secret
redaction is best-effort.

## Agent integrations

The package includes a **Codex skill** and **Claude Code plugin**. Both run the same
offline engine before and after requested documentation edits. The agent may improve
wording using implementation evidence and maintainer context. A host agent may send
content to its provider according to its own configuration.

These integrations are **experimental**: their structure and wrappers are tested,
but a live semantic editing session in either host has not been validated.
See [installation, invocation, update and removal](docs/integrations.md).

## Configuration

Place an optional `.repopolish.json` in the repository you audit:

```json
{
  "version": 1,
  "exclude": ["generated"],
  "failOn": "warning"
}
```

`exclude` skips exact relative paths or subtrees, not globs. `failOn` sets the severity
threshold; `--fail-on` overrides it. All non-excluded Markdown is normally analyzed.
Configuration is JSON data and cannot run code.

[Full configuration reference](docs/configuration.md) covers additional docs locations,
scoped suppressions with reasons, language, project type and scan budgets. Malformed
input and incomplete scans return 2 even with `--fail-on none`.

## Development and contributing

After cloning and installing dependencies as shown in Quick Start:

```sh
npm run build
npm test
npm run lint
npm run validate
```

`validate` is the complete gate: typing, lint, formatting, tests/build, fresh-source
and package installation smoke tests, and self-audit. The other commands are useful
for focused checks. `npm run format` applies formatting.

Contributions to rules, parsers, regression fixtures and documentation are welcome.
Start with [CONTRIBUTING.md](CONTRIBUTING.md), including the sample rule and safety
expectations. [Architecture and research](docs/architecture.md) explains the code layout.

## Maturity and limitations

This is an initial MVP with deliberately bounded static checks. A declared test script
does not prove tests pass, and a clean report does not certify release readiness.
English draft templates only; existing prose is preserved.

Process execution, GitHub/registry reads or writes, Git baseline/diff analysis, full
README regeneration, API inference and additional agent hosts are **deferred**.
See [implementation and validation status](docs/implementation.md) and
[the changelog](CHANGELOG.md) for the available scope.

Security and conduct policies are [drafts awaiting real reporting and enforcement
channels](docs/policies/security-policy-draft.md), not adopted maintainer commitments.

## License

License: MIT

See [LICENSE](LICENSE). Copyright holder is the repository owner, `irrumi`.
