# Architecture and bounded research

Consultation date: **2026-09-30**. The existing repository contained only a heading
and a clean main branch. The existing origin identified `irrumi/RepoPolish`; no remote
repository was created. TypeScript/Node was selected for a cross-platform CLI,
strict types, mature Markdown/TOML parsers and npm artifact testing.

## Boundaries

`filesystem` performs bounded reads and canonical boundary checks. `config` validates
data-only JSON. `analyzers` extracts static package facts. `markdown` parses a
CommonMark/GFM tree; `audit` checks claims against scoped evidence. `rules` supplies
explanatory metadata and built-in extensions. `changes` plans and applies approved
Markdown edits. `generators` derives README/launch proposals. `output` and `cli`
format results and enforce explicit command intent. Agent-specific logic stays in
thin integrations. No runtime third-party plugins are imported from target config.

Runtime dependencies are unified/remark parsers, github-slugger, smol-toml, semver,
zod, ignore and diff. Exact versions and integrity hashes are in package-lock.json.
The core has no process runner, network provider or model adapter. The wrapper alone
launches the trusted engine with argument arrays. Development scripts are separately
trusted tooling and can install/build/test the project.

## Decisions and primary sources

| Topic and source                                                                                                                                                                                                                                                                                                                                                         | Decision                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [Node release schedule](https://nodejs.org/en/about/previous-releases)                                                                                                                                                                                                                                                                                                   | Node 24 LTS minimum; local system Node 26 also exercised. CI selects 24.                                                 |
| [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)                                                                                                                                                                                                                                                                                     | Read package identity, scripts, bins and engines statically. Publication remains unknown offline.                        |
| [PEP 621 metadata](https://packaging.python.org/en/latest/specifications/pyproject-toml/)                                                                                                                                                                                                                                                                                | Support project fields and scripts without Python imports; dynamic and legacy formats remain limited.                    |
| [Cargo manifest](https://doc.rust-lang.org/cargo/reference/manifest.html)                                                                                                                                                                                                                                                                                                | Record package and workspace declarations; do not guess inherited values.                                                |
| [GitHub README behavior](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)                                                                                                                                                                                                              | Detect supported alternative README locations and relative links. HTML/custom anchors remain unsupported.                |
| [GitHub topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) and [social preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) | Generate local factual recommendations; do not upload assets or mutate metadata. No hardcoded platform image dimensions. |
| [Contribution guidance](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)                                                                                                                                                                                                         | Provide contributor instructions and issue/PR templates appropriate to this CLI.                                         |
| [Conduct policies](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project)                                                                                                                                                                                                                    | Enforcement requires a real maintainer channel; keep unapproved policies as drafts.                                      |
| [CITATION files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files)                                                                                                                                                                                                               | Detect their presence in launch checks; do not require research metadata for every CLI.                                  |
| [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use)                                                                                                                                                                                                                                                                              | Read-only permissions, no secrets or privileged PR workflow, no persisted checkout credentials.                          |
| [Checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node)                                                                                                                                                                                                                                                                  | Pin actual v6 refs verified with remote-ref reads on the consultation date.                                              |
| [Codex skills](https://learn.chatgpt.com/docs/build-skills)                                                                                                                                                                                                                                                                                                              | Ship a copyable repo-scoped skill, with explicit known-engine selection and packaged resources.                          |
| [Claude plugins](https://code.claude.com/docs/en/plugins-reference)                                                                                                                                                                                                                                                                                                      | Ship a host-native manifest plus skill and wrapper; validate with the installed host.                                    |
| [Gemini CLI skills](https://geminicli.com/docs/cli/skills/)                                                                                                                                                                                                                                                                                                              | A separate mechanism exists; implementation deferred until independently tested.                                         |
| [Antigravity skills](https://www.antigravity.google/docs/skills?tab=ide)                                                                                                                                                                                                                                                                                                 | Independently documented; do not assume Gemini integration paths apply. Deferred.                                        |

The GitHub security-policy documentation URL was inaccessible through the research
tool. Its contents were not assumed. A verified private reporting route remains a
maintainer prerequisite for adopting a security policy. No contact address or SLA
was invented.

A registry lookup of the unscoped working name returned 404 during development.
This is not name reservation or future availability. The deliverable uses the distinct
local identity `@irrumi/repopolish`, with publication disabled and no registry-install claim.

## Related tools

[markdownlint](https://github.com/DavidAnson/markdownlint) checks Markdown style and
structure. [lychee](https://github.com/lycheeverse/lychee) checks links across document
formats. RepoPolish combines a limited offline link subset with package-scoped metadata
contradictions, provenance and reviewed edits. These projects address overlapping
problems; this record makes no claim that they lack every RepoPolish feature or that
RepoPolish is first, faster or universally more complete. No comparative benchmark
was performed.

## Extension example

The built-in `src/rules/readme-quick-start.ts` demonstrates an `AuditRule`: metadata,
typed context and a `check` returning evidence-backed results. It is registered once
in `src/rules.ts`, which also powers explain output. Its focused test verifies English
scope and subjective severity. Expand the typed context only when new evidence is
needed. More complex verifiers belong in focused modules and must preserve uncertainty.

Analyzer additions should emit scoped facts and parse failures, never execute project
code. Fixer additions need bounded edits, approved risk, snapshot preconditions and
idempotency/conflict tests. Third-party executable extension loading is deferred.
