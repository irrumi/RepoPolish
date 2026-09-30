import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTwoFilesPatch } from 'diff';
import { scan, safePath, readBounded } from './filesystem.js';
import type { Audit } from './audit.js';
import { hash, relativePath } from './security.js';
import { InputError, type Change, type ChangePlan } from './model.js';

export function change(
  file: string,
  before: string | undefined,
  after: string,
  reason: string,
  risk: 'safe' | 'review',
  findingIds: string[] = [],
): Change {
  return {
    path: relativePath(file),
    beforeHash: before === undefined ? null : hash(before),
    before: before ?? '',
    after,
    reason,
    risk,
    findingIds,
    diff: createTwoFilesPatch(`a/${file}`, `b/${file}`, before ?? '', after),
  };
}
export function fixPlan(audit: Audit): ChangePlan {
  const changes: Change[] = [];
  for (const [file, edits] of audit.repairs) {
    const before = audit.snapshot.texts.get(file)!;
    let after = before,
      bound = before.length;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      if (edit.end > bound)
        throw new InputError('Overlapping edits require manual review.');
      after = after.slice(0, edit.start) + edit.text + after.slice(edit.end);
      bound = edit.start;
    }
    if (after !== before)
      changes.push(
        change(
          file,
          before,
          after,
          'Correct unique local-link destination casing.',
          'safe',
          edits.map((e) => e.findingId),
        ),
      );
  }
  return {
    schemaVersion: 1,
    snapshot: audit.snapshot.fingerprint,
    requiredCapability: 'writeApprovedFiles',
    changes,
  };
}
export class ApplyError extends InputError {
  constructor(
    message: string,
    public applied: string[],
  ) {
    super(message);
  }
}
async function validateOriginal(root: string, item: Change): Promise<string> {
  if (
    !/\.md$/i.test(item.path) ||
    /(?:^|\/)(?:LICENSE|SECURITY|CODE_OF_CONDUCT)\.md$/i.test(item.path)
  )
    throw new InputError('Writer only accepts non-policy Markdown files.');
  const full = await safePath(root, item.path, item.beforeHash === null);
  if (item.beforeHash === null) {
    try {
      await fs.lstat(full);
      throw new InputError('New target already exists.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  } else if (
    hash(await readBounded(root, item.path, 2097152)) !== item.beforeHash
  )
    throw new InputError('Source changed since preview.');
  return full;
}
/** Approved in-memory plans only. Never deserialize and execute plans from repository data. */
export async function applyPlan(
  root: string,
  plan: ChangePlan,
  approval: { writeApprovedFiles: true; allowReview?: boolean },
): Promise<string[]> {
  if (!approval?.writeApprovedFiles)
    throw new InputError('Explicit write approval is required.');
  if (new Set(plan.changes.map((c) => c.path)).size !== plan.changes.length)
    throw new InputError('Duplicate target paths.');
  if (plan.changes.some((c) => c.risk !== 'safe') && !approval.allowReview)
    throw new InputError('Review edits need separate approval.');
  const fresh = await scan(root);
  if (fresh.fingerprint !== plan.snapshot)
    throw new InputError(
      'Repository evidence changed since preview; generate a new plan.',
    );
  const staged: { item: Change; full: string; temp: string }[] = [],
    applied: string[] = [];
  try {
    // Validate all source files before any staging or replacement.
    for (const item of plan.changes) await validateOriginal(fresh.root, item);
    for (const item of plan.changes) {
      const full = await validateOriginal(fresh.root, item);
      const mode =
        item.beforeHash === null ? 0o644 : (await fs.stat(full)).mode;
      const temp = path.join(
        path.dirname(full),
        `.repopolish-${randomUUID()}.tmp`,
      );
      const handle = await fs.open(temp, 'wx', mode);
      staged.push({ item, full, temp });
      try {
        await handle.writeFile(item.after, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    for (const { item, full, temp } of staged) {
      await validateOriginal(fresh.root, item);
      if (item.beforeHash === null) {
        await fs.link(temp, full);
        await fs.unlink(temp);
      } else await fs.rename(temp, full);
      applied.push(item.path);
    }
    return applied;
  } catch {
    throw new ApplyError(
      'Application stopped: conflict, boundary change or filesystem error. Inspect applied paths; no automatic rollback over possible new user work.',
      applied,
    );
  } finally {
    for (const { temp, item } of staged) {
      // Never clean through a replaced parent link.
      try {
        await safePath(
          fresh.root,
          path.posix.join(path.posix.dirname(item.path), path.basename(temp)),
        );
        await fs.unlink(temp);
      } catch {
        /* Missing or unsafe temporary path is deliberately left alone. */
      }
    }
  }
}
