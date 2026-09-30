import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const source = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(
  npm,
  'Run through npm run smoke so the reviewed npm CLI is resolved.',
);
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), 'repopolish package '),
);
const artifacts = path.join(source, '.artifacts');
await fs.mkdir(artifacts, { recursive: true });
function run(executable, args, cwd = temporary) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
    windowsVerbatimArguments:
      process.platform === 'win32' &&
      path.basename(executable).toLowerCase() === 'cmd.exe',
  });
  assert.equal(
    result.status,
    0,
    `${args.join(' ')}\n${result.stderr}\n${result.stdout}`,
  );
  return result.stdout;
}
try {
  const fresh = path.join(temporary, 'fresh source');
  await fs.mkdir(fresh);
  for (const name of [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'src',
  ])
    await fs.cp(path.join(source, name), path.join(fresh, name), {
      recursive: true,
    });
  run(
    process.execPath,
    [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    fresh,
  );
  run(process.execPath, [npm, 'run', 'build'], fresh);
  assert.equal(
    run(process.execPath, [
      path.join(fresh, 'dist/cli.js'),
      '--version',
    ]).trim(),
    '0.1.0',
  );
  console.log('Fresh source npm ci and build passed.');
  const packed = JSON.parse(
    run(
      process.execPath,
      [
        npm,
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        artifacts,
      ],
      source,
    ),
  )[0];
  const files = packed.files.map((f) => f.path);
  for (const file of [
    'dist/cli.js',
    'dist/index.js',
    'dist/index.d.ts',
    'CONTRIBUTING.md',
    'integrations/codex/repopolish/SKILL.md',
    'integrations/claude/.claude-plugin/plugin.json',
    'integrations/claude/skills/repopolish/scripts/audit.mjs',
  ])
    assert.ok(files.includes(file), `Missing package file ${file}`);
  assert.ok(
    files.every(
      (f) =>
        !/^(?:tests|examples|src|node_modules|\.env|\.git|\.artifacts)(?:\/|$)/.test(
          f,
        ),
    ),
  );
  await fs.writeFile(
    path.join(artifacts, 'package-files.json'),
    JSON.stringify(files, null, 2),
  );
  const installed = path.join(temporary, 'installed consumer');
  await fs.mkdir(installed);
  await fs.writeFile(
    path.join(installed, 'package.json'),
    '{"name":"local-consumer","private":true}',
  );
  run(
    process.execPath,
    [
      npm,
      'install',
      path.join(artifacts, packed.filename),
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
    installed,
  );
  const cli = path.join(
    installed,
    'node_modules/@irrumi/repopolish/dist/cli.js',
  );
  assert.match(await fs.readFile(cli, 'utf8'), /^#!\/usr\/bin\/env node/);
  assert.equal(run(process.execPath, [cli, '--version']).trim(), '0.1.0');
  assert.match(run(process.execPath, [cli, '--help']), /audit/);
  const target = path.join(temporary, 'target with spaces');
  await fs.mkdir(target);
  await fs.writeFile(
    path.join(target, 'README.md'),
    '# Example\n## Usage\n[g](Guide.md)\n',
  );
  await fs.writeFile(path.join(target, 'guide.md'), '# Guide\n');
  const report = JSON.parse(
    run(process.execPath, [cli, 'audit', target, '--json']),
  );
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.summary.warning, 1);
  const before = await fs.readFile(path.join(target, 'README.md'));
  const preview = JSON.parse(
    run(process.execPath, [cli, 'fix', target, '--dry-run', '--json']),
  );
  assert.equal(preview.plan.changes.length, 1);
  assert.deepEqual(await fs.readFile(path.join(target, 'README.md')), before);
  for (const wrapper of [
    'integrations/codex/repopolish/scripts/audit.mjs',
    'integrations/claude/skills/repopolish/scripts/audit.mjs',
  ]) {
    const result = JSON.parse(
      run(process.execPath, [
        path.join(installed, 'node_modules/@irrumi/repopolish', wrapper),
        cli,
        target,
      ]),
    );
    assert.equal(result.schemaVersion, 1);
  }
  const bin = path.join(
    installed,
    'node_modules/.bin',
    process.platform === 'win32' ? 'repopolish.cmd' : 'repopolish',
  );
  if (process.platform === 'win32') {
    assert.ok(!/["&|<>^%!\r\n]/.test(bin));
    assert.equal(
      run(process.env.ComSpec ?? 'cmd.exe', [
        '/d',
        '/s',
        '/c',
        `""${bin}" --version"`,
      ]).trim(),
      '0.1.0',
    );
  } else assert.equal(run(bin, ['--version']).trim(), '0.1.0');
  console.log(
    `Package smoke passed: ${packed.filename}; ${files.length} files; installed bin, help, JSON, dry-run and both wrappers.`,
  );
} finally {
  // Only the exact mkdtemp directory created above is removed.
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('repopolish package '));
  await fs.rm(temporary, { recursive: true, force: true });
}
