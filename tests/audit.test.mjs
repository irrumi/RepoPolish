import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  audit,
  inspect,
  exitCode,
  explain,
  launchProposal,
  readmeProposal,
} from '../dist/index.js';
import { repo, cli, ids, tree, project } from './helpers.mjs';

test('clean scoped JS metadata and deterministic versioned report', async (t) => {
  const root = await repo(t, {
    'package.json': {
      name: 'fixture',
      version: '1.2.3',
      scripts: { build: 'DO NOT EXECUTE' },
      engines: { node: '>=24' },
    },
    'README.md':
      '# Fixture\n## Usage\n```sh\nnpm run build\n```\nRequires Node.js >=24\n',
  });
  const before = await tree(root),
    report = await audit(root);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.complete, true);
  assert.equal(report.summary.error, 0);
  assert.equal(
    report.facts.find((f) => f.name === 'declared-scripts').status,
    'detected',
  );
  assert.deepEqual(report, await audit(root));
  assert.deepEqual(before, await tree(root));
  assert.equal(
    report.checks.find((c) => c.name === 'execution').status,
    'skipped',
  );
  assert.equal(
    report.checks.find((c) => c.name === 'registry-and-github').status,
    'unknown',
  );
});
test('nearest package README scope prevents cross-package conclusions', async (t) => {
  const root = await repo(t, {
    'package.json': { workspaces: ['packages/*'], scripts: { root: 'no' } },
    'README.md': '# Root\n## Usage\n`npm run root`',
    'packages/cli/package.json': { scripts: { local: 'no' } },
    'packages/cli/README.md': '# CLI\n`npm run local`\n`npm run root`',
  });
  const r = await audit(root),
    f = r.findings.filter((f) => f.ruleId === 'script.missing');
  assert.equal(f.length, 1);
  assert.equal(f[0].scope, 'packages/cli');
  assert.equal(f[0].evidence[0].line, 3);
  assert.equal(f[0].evidence[1].file, 'packages/cli/package.json');
});
test('shell context is conservative and code is never executed', async (t) => {
  const root = await repo(t, {
    'package.json': { scripts: { test: 'node evil.js' } },
    'evil.js': 'throw new Error("executed")',
    'README.md':
      '# Sample\n## Usage\n```sh\ncd packages/a\nnpm run unknown\n```\n```sh\nnpm run $SCRIPT\nnpm run missing && echo x\nnpm --workspace a run missing\n```\n```js\nnpm run illustrative\n```\n`npm run absent`\n`tool unknown --whatever`',
  });
  const r = await audit(root);
  assert.equal(
    r.findings.filter((f) => f.ruleId === 'script.missing').length,
    1,
  );
  assert.match(
    r.findings.find((f) => f.ruleId === 'script.missing').message,
    /absent/,
  );
  assert.equal(
    r.checks.find((c) => c.name === 'cli-api-coverage').status,
    'unsupported',
  );
});
test('Markdown links, images, references, anchors, Unicode and code fences', async (t) => {
  const root = await repo(t, {
    'README.md':
      '# Demo\n## Usage\n[ok](docs/guide.md#hello-世界)\n![missing](missing.png)\n[reference][ref]\n[ref]: docs/guide.md#duplicate-1\n[bad](docs/guide.md#absent)\n```md\n[fake](fake.md)\n```\n    [also fake](absent.md)\n\n| Table |\n| --- |\n| [guide](docs/guide.md) |\n',
    'docs/guide.md': '# Hello 世界\n## Duplicate\n## Duplicate\n',
  });
  const r = await audit(root);
  assert.equal(r.findings.filter((f) => f.ruleId === 'link.missing').length, 1);
  assert.equal(r.findings.filter((f) => f.ruleId === 'link.anchor').length, 1);
  assert.equal(
    r.findings.find((f) => f.ruleId === 'link.missing').evidence[0].line,
    4,
  );
});
test('HTML fragments, remote links and unsupported paths stay uncertain', async (t) => {
  const root = await repo(t, {
    'README.md':
      '# Demo\n## Usage\n[remote](https://127.0.0.1:1/secret)\n[html](doc.md#custom)\n[out](../outside.md)\n[drive](C:/secret)\n<https://example.invalid/>',
    'doc.md': '<a id="custom"></a>',
  });
  const r = await audit(root);
  assert.equal(r.summary.error, 0);
  assert.ok(ids(r).includes('link.unknown'));
});
test('Node semver rejects disjoint claims only, no lexical comparison', async (t) => {
  const root = await repo(t, {
    'package.json': { engines: { node: '>=24 <27' } },
    'README.md':
      '# Demo\n## Usage\nNode.js: >=25 <26\n\nRequires Node.js >=18 <20\n',
  });
  const r = await audit(root);
  assert.equal(
    r.findings.filter((f) => f.ruleId === 'runtime.conflict').length,
    1,
  );
});
test('license conflicts diagnose without selecting licensing', async (t) => {
  const root = await repo(t, {
    'package.json': { license: 'MIT' },
    LICENSE: 'SPDX-License-Identifier: Apache-2.0',
    'README.md': '# Demo\n## Usage\nLicense: ISC\n',
  });
  const before = await tree(root),
    r = await audit(root);
  assert.equal(
    r.findings.filter((f) => f.ruleId === 'license.conflict').length,
    2,
  );
  assert.deepEqual(before, await tree(root));
});
test('Python and Rust static metadata and workspace declarations', async (t) => {
  const root = await repo(t, {
    'pyproject.toml':
      '[project]\nname="sample"\nversion="0.1.0"\nrequires-python=">=3.11"\nlicense="MIT"\n[project.scripts]\nsample="sample:main"',
    'rust/Cargo.toml':
      '[package]\nname="rusty"\nversion="0.1.0"\nrust-version="1.80"\nlicense="MIT"\n[workspace]\nmembers=["crates/*"]',
    'README.md': '# Demo\n## Usage\n',
  });
  const r = await audit(root);
  assert.ok(r.facts.some((f) => f.name === 'runtime' && f.value === '>=3.11'));
  assert.ok(r.facts.some((f) => f.name === 'ecosystem' && f.value === 'rust'));
  assert.ok(r.facts.some((f) => f.name === 'workspace-members'));
  assert.equal(r.summary.error, 0);
});
test('malformed metadata is partial and independent link checks continue', async (t) => {
  const root = await repo(t, {
    'package.json': '{broken',
    'pyproject.toml': '[oops',
    'README.md': '# Hi\n[bad](absent.md)\n`npm run missing`',
  });
  const r = await audit(root);
  assert.equal(r.complete, false);
  assert.equal(exitCode(r, 'none'), 2);
  assert.ok(ids(r).includes('link.missing'));
  assert.ok(!ids(r).includes('script.missing'));
});
test('config validation and suppression preserve uncertainty', async (t) => {
  const root = await repo(t, {
    '.repopolish.json': {
      version: 1,
      ignore: [{ id: 'readme.missing', reason: 'Documentation is elsewhere.' }],
    },
  });
  const r = await audit(root);
  assert.equal(r.summary.suppressed, 1);
  assert.equal(r.summary.warning, 0);
  assert.equal(r.findings[0].verification, 'detected');
  await fs.writeFile(
    path.join(root, '.repopolish.json'),
    '{"version":1,"run":"evil"}',
  );
  await assert.rejects(audit(root), /Invalid/);
  await fs.writeFile(
    path.join(root, '.repopolish.json'),
    '{"version":1,"exclude":["../secrets"]}',
  );
  await assert.rejects(audit(root), /Invalid/);
});
test('alternative README locations and docs overrides', async (t) => {
  const root = await repo(t, { '.github/README.md': '# Demo\n## Usage' });
  assert.ok(!ids(await audit(root)).includes('readme.missing'));
  const other = await repo(t, {
    'guide.md': '# Demo\n## Usage',
    '.repopolish.json': { version: 1, docs: ['guide.md'] },
  });
  assert.ok(!ids(await audit(other)).includes('readme.missing'));
});
test('readme proposals preserve human prose and avoid publication claims', async (t) => {
  const root = await repo(t, {
    'package.json': {
      name: 'private-fixture',
      description: 'Useful [tool]',
      scripts: { test: 'x' },
    },
  });
  const result = await inspect(root),
    proposal = readmeProposal(result);
  assert.match(proposal.draft, /not been checked/);
  assert.match(proposal.draft, /Maintainer input needed/);
  assert.equal(proposal.plan.changes[0].risk, 'review');
  assert.equal(launchProposal(result).status, 'local-draft');
  const maintained = await repo(t, {
    'README.md': '# Автор\r\n\r\nImportant warning and acknowledgments.\r\n',
  });
  const p = readmeProposal(await inspect(maintained));
  assert.equal(p.plan.changes.length, 0);
  assert.equal(p.draft, '');
});
test('CLI JSON, thresholds, errors, help and version', async (t) => {
  const root = await repo(t);
  assert.equal(cli(['--version']).stdout.trim(), '0.1.0');
  for (const command of [
    'audit',
    'check',
    'fix',
    'readme',
    'launch',
    'explain',
  ])
    assert.equal(cli([command, '--help']).status, 0);
  const r = cli(['audit', root, '--json', '--fail-on', 'warning']);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).summary.warning, 1);
  assert.equal(cli(['audit', root, '--quiet']).stdout, '');
  assert.equal(cli(['check', root, '--safe', '--json']).status, 0);
  assert.equal(cli(['audit', root, '--run', '--json']).status, 2);
  assert.equal(cli(['fix', root, '--yes', '--dry-run', '--json']).status, 2);
  assert.equal(JSON.parse(cli(['unknown', '--json']).stdout).schemaVersion, 1);
  assert.equal(explain('link.case').id, 'link.case');
  assert.throws(() => explain('bogus'));
});
test('realistic demo produces objective evidence', async () => {
  const r = await audit(path.join(project, 'examples/messy-repo'));
  assert.ok(ids(r).includes('script.missing'));
  assert.ok(ids(r).includes('link.case'));
});
