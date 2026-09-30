import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const project = fileURLToPath(new URL('../', import.meta.url));
export async function repo(t, files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'repopolish test '));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(
      path.join(root, name),
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }
  return root;
}
export function cli(args, cwd = project, env = {}) {
  return spawnSync(
    process.execPath,
    [path.join(project, 'dist/cli.js'), ...args],
    { cwd, encoding: 'utf8', timeout: 30000, env: { ...process.env, ...env } },
  );
}
export const ids = (report) =>
  report.findings.filter((f) => !f.suppression).map((f) => f.ruleId);
export async function tree(root) {
  const out = {};
  for (const entry of await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      out[path.relative(root, file)] = (await fs.readFile(file)).toString(
        'base64',
      );
    }
  return out;
}
