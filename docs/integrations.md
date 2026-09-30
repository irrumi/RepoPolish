# Agent integrations

Install the engine from the reviewed source or local tarball first. Do not substitute
an unpinned package fetched by name. The wrappers require an absolute path to that
installation's `dist/cli.js` and an absolute target directory; this prevents accidental
use of a fake repository-local helper on PATH. Metadata checks are not code signatures.

## Codex skill

Copy the entire `integrations/codex/repopolish` directory into the intended repository's
`.agents/skills/repopolish`. Include `scripts/audit.mjs`. This is a repo-scoped skill,
not a submitted marketplace plugin. Select `$repopolish` in Codex, naming the repository
and trusted engine path. Codex may also discover it for relevant documentation tasks.

The skill uses the official SKILL.md format and repository discovery documented in
[Build skills](https://learn.chatgpt.com/docs/build-skills), consulted 2026-09-30.
No minimum host version is asserted. Restart Codex if a copied update is not discovered.

Update by reviewing and replacing this skill directory from a validated RepoPolish
version. Remove only the copied `.agents/skills/repopolish` directory to uninstall.
No account-wide settings or hooks need changing.

## Claude Code plugin

Load the local plugin for a session using:

```sh
claude --plugin-dir /absolute/path/to/RepoPolish/integrations/claude
```

Invoke `/repopolish:repopolish`, naming the target repository and trusted engine path.
The plugin contains `.claude-plugin/plugin.json` and `skills/repopolish/SKILL.md` with
its own wrapper script. The layout and namespace follow the official
[plugin documentation](https://code.claude.com/docs/en/plugins) and
[manifest reference](https://code.claude.com/docs/en/plugins-reference), consulted
2026-09-30. Local validation used Claude Code 2.1.283, not a claimed minimum version.

To update, review the new engine and plugin together, then restart with the updated
directory. To remove a session-only plugin, restart without `--plugin-dir`. Nothing
is installed globally by RepoPolish. Marketplace publication is deferred.

## Validation and workflow boundary

Both wrappers are exercised against actual clean and failing repositories, including
paths with spaces, and again from the installed local tarball. Tests verify exit-code
propagation and package identity. Claude's installed `plugin validate` also passes.
Codex skill frontmatter and resource validation are part of development verification.

**Structure and wrapper behavior validated; live host execution not tested.**
An installed host's manifest validator does not establish that an autonomous semantic
editing session discovered, invoked and followed the skill correctly. No such
end-to-end model session or universal prompt-injection resistance is claimed.

The workflow audits first, reads schema v1 evidence, previews changes, respects local
write authorization, preserves important prose, and re-audits. Semantic edits remain
host-agent work; the deterministic core never calls a model. Host privacy and execution
controls remain the user's responsibility and depend on that host's configuration.

Gemini CLI and Antigravity have separately documented skill routes, researched in
[the architecture record](architecture.md). No artifacts or compatibility claims for
those hosts ship in 0.1.0.
