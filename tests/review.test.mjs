import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inspect, audit, fixPlan, applyPlan } from '../dist/index.js';
import { repo, ids } from './helpers.mjs';

test('invalid PEP 621 field types are partial and repository URLs are sourced', async (t) => {
  const bad = await repo(t, {
    'pyproject.toml': '[project]\nname = { invalid = true }\n',
  });
  assert.equal((await audit(bad)).complete, false);
  const badTable = await repo(t, { 'pyproject.toml': 'project = 42\n' });
  assert.equal((await audit(badTable)).complete, false);
  const root = await repo(t, {
    'package.json': {
      repository: { type: 'git', url: 'https://example.invalid/repo.git' },
    },
  });
  const fact = (await audit(root)).facts.find((f) => f.name === 'repository');
  assert.equal(fact.status, 'detected');
  assert.equal(fact.evidence[0].file, 'package.json');
});

test('Yarn binary fallback and run options are not absent script claims', async (t) => {
  const root = await repo(t, {
    'README.md': '# Hi\n## Usage\n`yarn run tsc`\n`npm run --help`\n',
    'package.json': {},
  });
  assert.ok(!ids(await audit(root)).includes('script.missing'));
});
test('multiline and PowerShell context are not evaluated in the wrong package', async (t) => {
  const root = await repo(t, {
    'README.md':
      '# Hi\n## Usage\n```sh\necho \\\nnpm run absent\n```\n```powershell\nSet-Location packages/foo\nnpm run absent\n```\n```sh\nexport npm_config_prefix=other\nnpm run absent\n```',
    'package.json': {},
  });
  assert.ok(!ids(await audit(root)).includes('script.missing'));
});
test('indented examples retain the exact source line', async (t) => {
  const root = await repo(t, {
    'README.md': '# Hi\n\n    npm run absent\n',
    'package.json': {},
  });
  const finding = (await audit(root)).findings.find(
    (f) => f.ruleId === 'script.missing',
  );
  assert.equal(finding.evidence[0].line, 3);
});
test('case repair encodes punctuation so it cannot break Markdown', async (t) => {
  const root = await repo(t, {
    'README.md': '# Hi\n## Usage\n[g](Guide%28.md)',
    'guide(.md': '# Guide',
  });
  const before = await inspect(root);
  assert.equal(before.repairs.size, 1);
  await applyPlan(root, fixPlan(before), { writeApprovedFiles: true });
  assert.match(
    await fs.readFile(path.join(root, 'README.md'), 'utf8'),
    /guide%28.md/,
  );
  assert.equal((await audit(root)).summary.warning, 0);
});
test('policy files do not acquire automatic write eligibility', async (t) => {
  const root = await repo(t, {
    'README.md': '# Hi\n## Usage',
    'SECURITY.md': '[g](Guide.md)',
    'guide.md': '# Guide',
  });
  const result = await inspect(root);
  assert.ok(ids(result.report).includes('link.case'));
  assert.equal(fixPlan(result).changes.length, 0);
});
test('multi-file write failure reports applied paths and preserves unrelated edits', async (t) => {
  const root = await repo(t, {
    'README.md': '[g](Guide.md)',
    'other.md': '[g](Guide.md)',
    'guide.md': '# Guide',
  });
  const plan = fixPlan(await inspect(root));
  assert.equal(plan.changes.length, 2);
  const rename = fs.rename;
  let calls = 0;
  fs.rename = async (...args) => {
    if (++calls === 2) throw new Error('Synthetic I/O failure');
    return rename(...args);
  };
  try {
    await assert.rejects(
      applyPlan(root, plan, { writeApprovedFiles: true }),
      (error) => {
        assert.deepEqual(error.applied, ['README.md']);
        return true;
      },
    );
  } finally {
    fs.rename = rename;
  }
  assert.equal(
    await fs.readFile(path.join(root, 'README.md'), 'utf8'),
    '[g](guide.md)',
  );
  assert.equal(
    await fs.readFile(path.join(root, 'other.md'), 'utf8'),
    '[g](Guide.md)',
  );
  assert.ok(!(await fs.readdir(root)).some((f) => f.endsWith('.tmp')));
});
