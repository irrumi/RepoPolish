# CI

RepoPolish's own workflow builds from this repository; it does not install an
unpublished package by name. It runs on ordinary pushes and pull requests with
`contents: read`, no secret-dependent steps and no `pull_request_target` trigger.
Checkout credentials are not persisted. Action SHAs were resolved from upstream tags.

After installing a reviewed local build in another project, the static gate is:

```sh
repopolish audit . --ci --json --fail-on error
```

Provide the trusted engine installation separately from the repository being audited.
Do not dynamically download a package claimed by that repository. Do not execute
generated documentation snippets as CI commands. RepoPolish emits no GitHub workflow
annotations or privileged comments; preserve its exit result and JSON artifact.

The configured matrix uses Node 24 on Ubuntu, Windows and macOS. Configured jobs are
not evidence of completed runs; observed results are recorded separately in
[implementation status](implementation.md). `npm run validate` includes package
creation and installation, so it is authorized development execution, not static audit.

Self-audit excludes `tests`, `examples` and `integrations`: they contain deliberately
invalid fixtures, agent instructions and installation-relative resources rather than
RepoPolish user documentation. Tests validate those resources independently. No rules
are broadly suppressed. Source files and build outputs are not interpreted as docs.
