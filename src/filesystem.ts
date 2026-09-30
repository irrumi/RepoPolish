import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { compare, InputError } from './model.js';
import { hash, relativePath, within } from './security.js';
import { parseConfig, type Config } from './config.js';

const skipped = new Set([
  '.git',
  '.svn',
  'node_modules',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  'target',
  'coverage',
  '.artifacts',
  '.codebase-memory',
  '.aws',
  '.ssh',
  '.gnupg',
]);
const sensitive = (name: string): boolean =>
  /^\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(name);
export interface ScanIssue {
  file: string;
  reason: string;
}
export interface Snapshot {
  root: string;
  config: Config;
  files: string[];
  texts: Map<string, string>;
  issues: ScanIssue[];
  fingerprint: string;
}
export async function safePath(
  root: string,
  rel: string,
  allowMissing = false,
): Promise<string> {
  relativePath(rel);
  let current = root;
  // Reject root replacement too. Root is canonicalized once by scan().
  if (
    (await fs.lstat(root)).isSymbolicLink() ||
    (await fs.realpath(root)) !== root
  )
    throw new InputError('Repository root changed.');
  for (const [i, part] of rel.split('/').entries()) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (
        stat.isSymbolicLink() ||
        (i < rel.split('/').length - 1 && !stat.isDirectory()) ||
        (!stat.isFile() && !stat.isDirectory())
      )
        throw new InputError('Symlink or special file refused.');
    } catch (error) {
      if (
        allowMissing &&
        (error as NodeJS.ErrnoException).code === 'ENOENT' &&
        i === rel.split('/').length - 1
      )
        return current;
      throw error;
    }
    if (!within(root, await fs.realpath(current)))
      throw new InputError('Path leaves the repository.');
  }
  return current;
}
export async function readBounded(
  root: string,
  rel: string,
  max: number,
): Promise<string> {
  const full = await safePath(root, rel);
  const handle = await fs.open(
    full,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > max)
      throw new InputError('File exceeds limit or is not regular.');
    const buffer = Buffer.alloc(max + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const read = await handle.read(
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        bytesRead,
      );
      if (!read.bytesRead) break;
      bytesRead += read.bytesRead;
    }
    const after = await handle.stat();
    if (
      bytesRead > max ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs ||
      after.ctimeMs !== stat.ctimeMs
    )
      throw new InputError('File changed or exceeds limit.');
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      buffer.subarray(0, bytesRead),
    );
  } finally {
    await handle.close();
  }
}
const readable = (file: string): boolean =>
  /\.md$/i.test(file) ||
  /(?:^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|LICENSE(?:\.md|\.txt)?|COPYING|\.gitignore|\.repopolish\.json)$/.test(
    file,
  );
export async function scan(input: string): Promise<Snapshot> {
  let root: string;
  try {
    root = await fs.realpath(path.resolve(input));
    if (!(await fs.stat(root)).isDirectory()) throw new Error();
  } catch {
    throw new InputError('Target must be an accessible repository directory.');
  }
  let configText: string | undefined;
  try {
    configText = await readBounded(root, '.repopolish.json', 65536);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new InputError('Cannot safely read .repopolish.json.');
  }
  const config = parseConfig(configText),
    texts = new Map<string, string>(),
    files: string[] = [],
    issues: ScanIssue[] = [];
  const matcher = ignore();
  let total = 0,
    entries = 0,
    exhausted = false;
  try {
    const text = await readBounded(root, '.gitignore', 65536);
    matcher.add(text);
    texts.set('.gitignore', text);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
      issues.push({
        file: '.gitignore',
        reason: 'Ignore file unreadable or over limit.',
      });
  }
  if (configText !== undefined) texts.set('.repopolish.json', configText);
  async function walk(dir: string, depth: number): Promise<void> {
    if (exhausted) return;
    if (depth > config.limits.depth) {
      issues.push({ file: dir, reason: 'Depth limit reached.' });
      return;
    }
    const children = [];
    try {
      const directory = await fs.opendir(
        dir ? await safePath(root, dir) : root,
      );
      for await (const child of directory) {
        if (children.length + entries >= config.limits.files) {
          issues.push({ file: dir || '.', reason: 'Entry limit reached.' });
          exhausted = true;
          return;
        }
        children.push(child);
      }
    } catch {
      issues.push({
        file: dir || '.',
        reason: 'Directory cannot be safely read.',
      });
      return;
    }
    children.sort((a, b) => compare(a.name, b.name));
    for (const child of children) {
      if (++entries > config.limits.files) {
        issues.push({ file: '.', reason: 'Entry limit reached.' });
        exhausted = true;
        return;
      }
      if (skipped.has(child.name) || sensitive(child.name)) continue;
      const rel = dir ? `${dir}/${child.name}` : child.name;
      if (config.exclude.some((p) => rel === p || rel.startsWith(`${p}/`)))
        continue;
      try {
        relativePath(rel);
      } catch {
        issues.push({
          file: dir || '.',
          reason: 'Unsupported path name skipped.',
        });
        continue;
      }
      const explicit =
        config.docs.some(
          (p) =>
            rel === p || p.startsWith(`${rel}/`) || rel.startsWith(`${p}/`),
        ) ||
        (!dir && readable(rel));
      if (!explicit && matcher.ignores(rel + (child.isDirectory() ? '/' : '')))
        continue;
      if (child.isSymbolicLink()) {
        issues.push({ file: rel, reason: 'Symlink skipped.' });
        continue;
      }
      if (child.isDirectory()) {
        await walk(rel, depth + 1);
        continue;
      }
      if (!child.isFile()) {
        issues.push({ file: rel, reason: 'Special file skipped.' });
        continue;
      }
      files.push(rel);
      if (!readable(rel)) continue;
      try {
        const text = await readBounded(root, rel, config.limits.fileBytes);
        total += Buffer.byteLength(text);
        if (total > config.limits.totalBytes) {
          issues.push({ file: rel, reason: 'Total read budget reached.' });
          exhausted = true;
          return;
        }
        texts.set(rel, text);
      } catch {
        issues.push({
          file: rel,
          reason: 'File unreadable, invalid UTF-8, changed, or over limit.',
        });
      }
    }
  }
  await walk('', 0);
  files.sort(compare);
  const fingerprint = hash(
    JSON.stringify([
      files,
      [...texts]
        .sort(([a], [b]) => compare(a, b))
        .map(([p, t]) => [p, hash(t)]),
      issues,
    ]),
  );
  return { root, config, files, texts, issues, fingerprint };
}
