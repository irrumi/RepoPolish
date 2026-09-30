import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, project } from './helpers.mjs';

const skills = [
  'integrations/codex/repopolish',
  'integrations/claude/skills/repopolish',
];
for (const skill of skills) {
  test(`${skill} structure and real wrapper statuses with spaces`, async (t) => {
    const dir = path.join(project, skill),
      text = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
    assert.match(text, /^---\nname: repopolish\ndescription: .+\n---/);
    const wrapper = path.join(dir, 'scripts/audit.mjs');
    await fs.access(wrapper);
    const root = await repo(t, {
      'README.md': '# Hi\n## Usage\n[broken](missing.md)',
    });
    const result = spawnSync(
      process.execPath,
      [wrapper, path.join(project, 'dist/cli.js'), root],
      { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).schemaVersion, 1);
    const bad = spawnSync(process.execPath, [wrapper, 'relative-cli', root], {
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(bad.status, 2);
    await fs.writeFile(path.join(root, 'README.md'), '# Hi\n## Usage\n');
    assert.equal(
      spawnSync(
        process.execPath,
        [wrapper, path.join(project, 'dist/cli.js'), root],
        { timeout: 30000 },
      ).status,
      0,
    );
  });
}
test('Claude manifest only declares supported metadata and contained resources', async () => {
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(project, 'integrations/claude/.claude-plugin/plugin.json'),
    ),
  );
  assert.equal(manifest.name, 'repopolish');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(Object.keys(manifest).sort(), [
    'author',
    'description',
    'license',
    'name',
    'repository',
    'version',
  ]);
});
