import path from 'node:path';
import fs from 'node:fs/promises';
import { packageFor } from '../analyzers.js';
import { safePath } from '../filesystem.js';
import { within } from '../security.js';
import type { Evidence, Edit } from '../model.js';
import type { Link } from '../markdown.js';
import type { VerificationContext } from './context.js';

function destinationEdit(
  source: string,
  link: Link,
  replacement: string,
  findingId: string,
): Edit | undefined {
  if (link.start === undefined || link.end === undefined) return;
  const raw = source.slice(link.start, link.end);
  const prefix =
    link.source === 'definition'
      ? /^\[[^\]\n]+\]:\s*</.test(raw)
        ? '<'
        : ': '
      : raw.includes(`(<${link.url}>`)
        ? '(<'
        : '(';
  const needle = `${prefix}${link.url}`;
  const at = raw.lastIndexOf(needle);
  if (at < 0 || raw.indexOf(needle) !== at) return;
  const start = link.start + at + prefix.length;
  return { start, end: start + link.url.length, text: replacement, findingId };
}

export async function verifyLinks({
  snapshot,
  analysis,
  documents,
  repairs,
  complete,
  add,
}: VerificationContext): Promise<void> {
  // Local resolution never opens arbitrary link contents. Only pre-scanned Markdown is parsed.
  for (const [file, doc] of documents) {
    const pkg = packageFor(file, analysis.packages),
      scope = pkg?.scope ?? '.';
    for (const link of doc.links) {
      const evidence: Evidence[] = [
        { file, line: link.line, kind: 'markdown-link' },
      ];
      const url = link.url;
      if (/^(https?:|mailto:|\/\/)/i.test(url)) continue;
      let target: string, fragment: string, local: string;
      try {
        const hashAt = url.indexOf('#');
        local = decodeURIComponent(hashAt < 0 ? url : url.slice(0, hashAt));
        fragment = hashAt < 0 ? '' : decodeURIComponent(url.slice(hashAt + 1));
        if (/^[a-z][a-z\d+.-]*:|^\/|\\|\?|[\u0000-\u001f]/i.test(local))
          throw new Error();
        target = local
          ? path.posix.normalize(
              path.posix.join(path.posix.dirname(file), local),
            )
          : file;
        if (
          !within(snapshot.root, path.resolve(snapshot.root, target)) ||
          /(?:^|\/)(?:\.git|\.env[^/]*|node_modules|\.aws|\.ssh)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i.test(
            target,
          )
        )
          throw new Error();
      } catch {
        add(
          'link.unknown',
          'Link is outside supported local path syntax or repository boundary.',
          scope,
          evidence,
          'unsupported',
        );
        continue;
      }
      if (target === '.') {
        continue;
      }
      const exact = snapshot.files.includes(target);
      const matches = snapshot.files.filter(
        (f) => f.toLowerCase() === target.toLowerCase(),
      );
      if (!exact && matches.length === 1) {
        const corrected = matches[0]!;
        const finding = add(
          'link.case',
          `Link casing differs from ${corrected}.`,
          scope,
          [...evidence, { file: corrected, kind: 'inventory' }],
        );
        const replacement =
          path.posix
            .relative(path.posix.dirname(file), corrected)
            .split('/')
            .map((segment) =>
              encodeURIComponent(segment).replace(
                /[!'()*]/g,
                (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
              ),
            )
            .join('/') + (url.includes('#') ? url.slice(url.indexOf('#')) : '');
        const edit = destinationEdit(
          snapshot.texts.get(file)!,
          link,
          replacement,
          finding.id,
        );
        if (
          edit &&
          complete &&
          !finding.suppression &&
          !/(?:^|\/)(?:LICENSE|SECURITY|CODE_OF_CONDUCT)\.md$/i.test(file)
        ) {
          finding.fixability = 'safe';
          repairs.set(file, [...(repairs.get(file) ?? []), edit]);
        }
        target = corrected;
      } else if (!exact) {
        try {
          const full = await safePath(snapshot.root, target);
          if ((await fs.stat(full)).isDirectory()) continue;
          add(
            'link.unknown',
            'Target exists outside scanned evidence; content and anchors were not checked.',
            scope,
            evidence,
            'unknown',
          );
        } catch (error) {
          const skipped =
            snapshot.issues.some(
              (i) =>
                i.file === '.' ||
                target === i.file ||
                target.startsWith(`${i.file}/`),
            ) ||
            snapshot.config.exclude.some(
              (e) => target === e || target.startsWith(`${e}/`),
            );
          if (!skipped && (error as NodeJS.ErrnoException).code === 'ENOENT')
            add(
              'link.missing',
              `Local target does not exist: ${target}.`,
              scope,
              evidence,
            );
          else
            add(
              'link.unknown',
              'Target cannot be safely verified or is excluded.',
              scope,
              evidence,
              'unknown',
            );
        }
        continue;
      }
      if (fragment) {
        const targetDoc = documents.get(target);
        if (!targetDoc || targetDoc.html)
          add(
            'link.unknown',
            'Fragment requires an unsupported renderer or HTML-anchor check.',
            scope,
            evidence,
            'unsupported',
          );
        else if (!targetDoc.anchors.has(fragment))
          add(
            'link.anchor',
            `Heading fragment is absent in ${target}.`,
            scope,
            evidence,
          );
      }
    }
  }
}
