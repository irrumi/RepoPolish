import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { audit, exitCode } from '../dist/index.js';
import { repo, tree } from './helpers.mjs';

const corpus = JSON.parse(
  await fs.readFile(
    new URL('./fixtures/baseline-identity/cases.json', import.meta.url),
    'utf8',
  ),
);
const findings = (report, rule) =>
  report.findings.filter((finding) => finding.ruleId === rule);

// Characterize the real scanner only. `future` is a reviewable acceptance
// oracle for the later comparator, not a mocked implementation or passing claim.
for (const scenario of corpus.cases) {
  test(`baseline identity input: ${scenario.name}`, async (t) => {
    const root = await repo(t, corpus.files);
    const before = await audit(root);
    const readme = path.join(root, 'README.md');
    const source = corpus.files['README.md'];
    switch (scenario.operation) {
      case 'none':
        break;
      case 'prepend-blank-line':
        await fs.writeFile(readme, `\n${source}`);
        break;
      case 'change-fragment':
        await fs.writeFile(readme, source.replace('absent-b', 'absent-c'));
        break;
      case 'change-script':
        await fs.writeFile(
          readme,
          source.replace('run missing', 'run changed'),
        );
        break;
      case 'add-heading':
        // Explicit fragment spelling avoids relying on a guessed slug.
        await fs.writeFile(
          path.join(root, 'guide.md'),
          '# Guide\n## absent-a\n',
        );
        break;
      case 'duplicate-link':
        await fs.writeFile(readme, `${source}[again](guide.md#absent-a)\n`);
        break;
      case 'malformed-manifest':
        await fs.writeFile(path.join(root, 'package.json'), '{invalid');
        break;
      default:
        assert.fail(`Unknown fixture operation: ${scenario.operation}`);
    }
    const snapshot = await tree(root);
    const after = await audit(root);
    assert.deepEqual(await tree(root), snapshot);
    assert.equal(after.complete, scenario.expected.complete);
    assert.equal(
      findings(after, 'link.anchor').length,
      scenario.expected.anchor,
    );
    assert.equal(
      findings(after, 'script.missing').length,
      scenario.expected.script,
    );
    assert.equal(JSON.stringify(after).includes(root), false);
    if (scenario.operation === 'none') assert.deepEqual(after, before);
    if (scenario.operation === 'prepend-blank-line') {
      const original = findings(before, 'script.missing').find(
        (f) => f.scope === '.',
      );
      const shifted = findings(after, 'script.missing').find(
        (f) => f.scope === '.',
      );
      assert.equal(shifted.evidence[0].line, original.evidence[0].line + 1);
      assert.notEqual(shifted.id, original.id);
    }
    if (!after.complete) {
      assert.equal(exitCode(after, 'none'), 2);
      assert.ok(after.findings.some((f) => f.verification === 'unknown'));
    }
  });
}

test('identity corpus retains same-line anchors and repeated scoped claims', async (t) => {
  const report = await audit(await repo(t, corpus.files));
  const anchors = findings(report, 'link.anchor');
  assert.equal(anchors.length, 3);
  assert.equal(anchors.filter((f) => f.evidence[0].line === 3).length, 2);
  // Do not assert legacy ID collisions as desirable behavior. Keeping every
  // occurrence is the requirement even where existing display IDs collide.
  assert.deepEqual(
    findings(report, 'script.missing').map((f) => f.scope),
    ['.', 'packages/child'],
  );
});
