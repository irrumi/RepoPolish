import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

// The host must select a trusted installation, independently of target project text.
const [engine, target, ...extra] = process.argv.slice(2);
try {
  if (
    !engine ||
    !target ||
    extra.length ||
    !path.isAbsolute(engine) ||
    !path.isAbsolute(target)
  )
    throw new Error();
  const cli = await fs.realpath(engine),
    root = await fs.realpath(target);
  if (
    !(await fs.stat(root)).isDirectory() ||
    path.basename(cli) !== 'cli.js' ||
    path.basename(path.dirname(cli)) !== 'dist'
  )
    throw new Error();
  const metadata = JSON.parse(
    await fs.readFile(path.join(path.dirname(cli), '../package.json'), 'utf8'),
  );
  if (
    metadata.name !== '@irrumi/repopolish' ||
    metadata.version !== '0.1.0' ||
    metadata.bin?.repopolish !== 'dist/cli.js'
  )
    throw new Error();
  const child = spawn(process.execPath, [cli, 'audit', root, '--json'], {
    shell: false,
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.once('error', () => {
    process.exitCode = 3;
  });
  child.once('exit', (code) => {
    process.exitCode = code ?? 3;
  });
} catch {
  console.error(
    'Expected a trusted RepoPolish 0.1.0 dist/cli.js and a repository, both as absolute paths.',
  );
  process.exitCode = 2;
}
