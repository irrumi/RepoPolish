import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { audit, inspect, fixPlan, applyPlan } from '../dist/index.js';
import { repo, project, cli, tree } from './helpers.mjs';

test('static engine succeeds when network, subprocess and write APIs throw', async (t) => {
  const root = await repo(t, {
    'README.md': '# Demo\n## Usage\n[remote](https://example.invalid)',
    'package.json': { scripts: { test: 'node --version' } },
  });
  const script = `
    import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
    import cp from 'node:child_process'; import fs from 'node:fs/promises';
    import {syncBuiltinESMExports} from 'node:module';
    const deny = () => {throw new Error('Unexpected capability use');};
    http.request=http.get=https.request=https.get=net.connect=net.createConnection=deny;
    cp.spawn=cp.spawnSync=cp.exec=cp.execSync=cp.execFile=cp.execFileSync=cp.fork=deny;
    fs.writeFile=fs.appendFile=fs.mkdir=fs.rename=fs.unlink=fs.rm=deny; globalThis.fetch=deny;
    syncBuiltinESMExports();
    const {audit}=await import(${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)});
    const report=await audit(${JSON.stringify(root)}); if(!report.complete) process.exitCode=1;
  `;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: project, encoding: 'utf8', timeout: 30000 },
  );
  assert.equal(result.status, 0, result.stderr);
});
test('new CLI draft needs write flag, dry-run cannot save files', async (t) => {
  const root = await repo(t);
  assert.equal(cli(['readme', root, '--json']).status, 0);
  assert.deepEqual(await tree(root), {});
  const result = cli(['readme', root, '--write', '--json']);
  assert.equal(result.status, 0);
  assert.ok(JSON.parse(result.stdout).applied.includes('README.md'));
});
test('previews redact synthetic secrets and controls without corrupting saved prose', async (t) => {
  const root = await repo(t, {
    'README.md':
      '# Hi\n## Usage\ntoken=synthetic-secret\u001b[31m\n[g](Guide.md)',
    'guide.md': '# Guide',
  });
  const preview = cli(['fix', root, '--json']);
  assert.ok(!preview.stdout.includes('synthetic-secret'));
  assert.ok(!preview.stdout.includes('\\u001b'));
  await applyPlan(root, fixPlan(await inspect(root)), {
    writeApprovedFiles: true,
  });
  assert.match(
    await fs.readFile(path.join(root, 'README.md'), 'utf8'),
    /synthetic-secret/,
  );
});
test('escaped, encoded and reference links preserve surrounding text', async (t) => {
  const root = await repo(t, {
    'README.md':
      '# Demo\n## Usage\n[one][guide]\n\n[guide]: docs/Guide.md "Title"\n\n[space](<docs/space name.md>)\n[unicode](docs/%E4%B8%96%E7%95%8C.md)\n',
    'docs/guide.md': '# Guide',
    'docs/space name.md': '# Space',
    'docs/世界.md': '# World',
  });
  const r = await inspect(root);
  assert.equal(r.report.summary.error, 0);
  await applyPlan(root, fixPlan(r), { writeApprovedFiles: true });
  assert.match(
    await fs.readFile(path.join(root, 'README.md'), 'utf8'),
    /docs\/guide.md "Title"/,
  );
});
test('total budget, binary input and BOM are handled conservatively', async (t) => {
  const root = await repo(t, {
    '.repopolish.json': { version: 1, limits: { totalBytes: 1000 } },
    'README.md': '# Demo\n' + 'x'.repeat(700),
    'guide.md': 'y'.repeat(700),
  });
  assert.equal((await audit(root)).complete, false);
  const bom = await repo(t, {
    'README.md': '\uFEFF# Demo\r\n## Usage\r\n[g](Guide.md)',
    'guide.md': '# Guide',
  });
  const plan = fixPlan(await inspect(bom));
  await applyPlan(bom, plan, { writeApprovedFiles: true });
  assert.equal(
    (await fs.readFile(path.join(bom, 'README.md')))
      .subarray(0, 3)
      .toString('hex'),
    'efbbbf',
  );
});
test('suppressed safe findings do not become writes', async (t) => {
  const root = await repo(t, {
    'README.md': '[g](Guide.md)',
    'guide.md': '# Guide',
    '.repopolish.json': {
      version: 1,
      ignore: [{ id: 'link.case', reason: 'Intentional spelling.' }],
    },
  });
  assert.equal(fixPlan(await inspect(root)).changes.length, 0);
});
test('partial snapshots do not auto-fix unrelated evidence', async (t) => {
  const root = await repo(t, {
    'README.md': '[g](Guide.md)',
    'guide.md': '# Guide',
    'package.json': 'bad',
  });
  assert.equal(fixPlan(await inspect(root)).changes.length, 0);
});
