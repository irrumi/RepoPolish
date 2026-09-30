import { createHash } from 'node:crypto';
import path from 'node:path';
import { InputError } from './model.js';

export const hash = (text: string | Buffer): string =>
  createHash('sha256').update(text).digest('hex');
export function display(value: string): string {
  return value
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      ' ',
    )
    .replace(
      /(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,})/g,
      '[REDACTED]',
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@')
    .replace(
      /\b(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]',
    );
}
export function clean(value: string): string {
  return display(value)
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 1000);
}
export function relativePath(value: string): string {
  if (
    !value ||
    value.includes('\\') ||
    value.includes(':') ||
    value.startsWith('/') ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new InputError('Expected a safe repository-relative POSIX path.');
  const parts = value.split('/');
  if (
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
    )
  )
    throw new InputError('Ambiguous or escaping repository path.');
  return value;
}
export function within(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return (
    rel === '' ||
    (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`))
  );
}
export function parseJson(text: string): unknown {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const c of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[' || c === '{') {
      if (++depth > 64) throw new InputError('JSON nesting exceeds 64.');
    } else if (c === ']' || c === '}') depth--;
  }
  return JSON.parse(text);
}
