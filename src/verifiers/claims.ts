import path from 'node:path';
import fs from 'node:fs/promises';
import semver from 'semver';
import { packageFor } from '../analyzers.js';
import { safePath } from '../filesystem.js';
import type { VerificationContext } from './context.js';

const recognizedLicense = (s: string): string | undefined =>
  /^(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC|MPL-2\.0|GPL-3\.0-only|Unlicense)$/.test(
    s.trim(),
  )
    ? s.trim()
    : undefined;
function licenseText(text: string): string | undefined {
  const spdx = text.match(/^SPDX-License-Identifier:\s*(\S+)\s*$/m)?.[1];
  if (spdx) return recognizedLicense(spdx);
  if (
    text.includes(
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
    ) &&
    text.includes('THE SOFTWARE IS PROVIDED "AS IS"')
  )
    return 'MIT';
  if (
    text.includes('Apache License') &&
    text.includes('Version 2.0, January 2004')
  )
    return 'Apache-2.0';
  return undefined;
}

export async function verifyClaims({
  snapshot,
  analysis,
  documents,
  add,
}: VerificationContext): Promise<void> {
  for (const [file, doc] of documents) {
    const pkg = packageFor(file, analysis.packages),
      scope = pkg?.scope ?? '.';
    if (pkg?.ecosystem === 'javascript' && pkg.valid && pkg.scriptsComplete) {
      for (const snippet of doc.snippets.filter((s) => s.shell)) {
        const lines = snippet.value.split('\n');
        // A changing shell working directory invalidates inferred package scope for the whole block.
        if (
          lines.some((l) =>
            /(?:^|[;&|])\s*(?:\$\s*)?(?:cd|pushd|popd|Set-Location|Push-Location|Pop-Location)\s|--(?:workspace|prefix|filter|cwd)\b|(?:^|\s)-[wC]\b|[\\`]\s*$|(?:^|\s)(?:export\s+)?[A-Za-z_][\w]*=/.test(
              l,
            ),
          )
        )
          continue;
        for (const [index, line] of lines.entries()) {
          const m = line
            .trim()
            .match(
              /^(?:\$\s+)?(?:npm|pnpm)\s+run\s+([a-zA-Z\d_][a-zA-Z\d:_.-]*)(?:\s+--\s+[a-zA-Z\d _.=-]+)?$/,
            );
          if (m && !pkg.scripts.includes(m[1]!))
            add(
              'script.missing',
              `Documented script ${m[1]} is absent from the scoped manifest.`,
              scope,
              [
                {
                  file,
                  line: snippet.line + index,
                  kind: 'documented-command',
                },
                { file: pkg.file, pointer: '/scripts', kind: 'manifest' },
              ],
            );
        }
      }
      if (pkg.runtime && semver.validRange(pkg.runtime))
        for (const prose of doc.prose) {
          const match = prose.value.match(
            /^(?:Node(?:\.js)?\s*:\s*|Requires Node(?:\.js)?\s+)([\d<>=~^*xX| .+-]+)\.?$/,
          );
          const range = match?.[1]
            ?.trim()
            .replace(/\.$/, '')
            .replace(/^(\d+)\+$/, '>=$1');
          if (
            range &&
            semver.validRange(range) &&
            !semver.intersects(pkg.runtime, range)
          )
            add(
              'runtime.conflict',
              'Explicit Node.js requirement and engines.node have no overlapping versions.',
              scope,
              [
                { file, line: prose.line, kind: 'runtime-claim' },
                { file: pkg.file, pointer: '/engines/node', kind: 'manifest' },
              ],
            );
        }
    }
    if (pkg?.valid && pkg.license && recognizedLicense(pkg.license))
      for (const prose of doc.prose) {
        const value = prose.value
          .match(/^License:\s*(\S+)\.?$/)?.[1]
          ?.replace(/\.$/, '');
        if (value && recognizedLicense(value) && value !== pkg.license)
          add(
            'license.conflict',
            'README and manifest declare different licenses; maintainer review required.',
            scope,
            [
              { file, line: prose.line, kind: 'license-claim' },
              { file: pkg.file, pointer: '/license', kind: 'manifest' },
            ],
          );
      }
  }
  for (const pkg of analysis.packages.filter((p) => p.valid)) {
    if (pkg.license && recognizedLicense(pkg.license))
      for (const [file, text] of snapshot.texts) {
        if (
          path.posix.dirname(file) !== pkg.scope ||
          !/^(LICENSE(?:\.md|\.txt)?|COPYING)$/i.test(path.posix.basename(file))
        )
          continue;
        const license = licenseText(text);
        if (license && license !== pkg.license)
          add(
            'license.conflict',
            'License file and manifest declare different licenses; no license was selected.',
            pkg.scope,
            [
              { file, kind: 'license-text' },
              { file: pkg.file, pointer: '/license', kind: 'manifest' },
            ],
          );
      }
    if (pkg.ecosystem !== 'python')
      for (const bin of Object.values(pkg.bins)) {
        try {
          if (path.isAbsolute(bin) || bin.includes('\\')) throw new Error();
          const rel = path.posix.normalize(path.posix.join(pkg.scope, bin));
          const full = await safePath(snapshot.root, rel);
          if (!(await fs.stat(full)).isFile()) throw new Error();
        } catch {
          add(
            'entry.missing',
            'A declared executable file is not safely available locally; it may require a build.',
            pkg.scope,
            [{ file: pkg.file, pointer: '/bin', kind: 'manifest' }],
            'unknown',
          );
        }
      }
  }
}
