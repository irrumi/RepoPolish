import { parse as toml } from 'smol-toml';
import path from 'node:path';
import { z } from 'zod';
import { parseJson } from './security.js';
import type { Snapshot } from './filesystem.js';
import type { Package, Fact } from './model.js';

const strings = z.record(z.string(), z.string().max(10000));
const npmSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  license: z.string().optional(),
  repository: z.union([z.string(), z.object({ url: z.string() })]).optional(),
  scripts: strings.optional(),
  bin: z.union([z.string(), strings]).optional(),
  engines: z.object({ node: z.string().optional() }).optional(),
  packageManager: z.string().optional(),
  workspaces: z
    .union([z.array(z.string()), z.object({ packages: z.array(z.string()) })])
    .optional(),
});
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
function optionalText(
  obj: Record<string, unknown>,
  key: string,
  allowTable = false,
): string | undefined {
  const value = obj[key];
  if (
    value === undefined ||
    (allowTable &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value))
  )
    return undefined;
  if (typeof value !== 'string') throw new Error('Expected text');
  return value;
}
export interface Analysis {
  packages: Package[];
  facts: Fact[];
  errors: string[];
  limitations: string[];
}
export function analyze(snapshot: Snapshot): Analysis {
  const packages: Package[] = [],
    facts: Fact[] = [],
    errors: string[] = [],
    limitations: string[] = [];
  for (const [file, text] of snapshot.texts) {
    const base = path.posix.basename(file);
    if (!['package.json', 'pyproject.toml', 'Cargo.toml'].includes(base))
      continue;
    const scope = path.posix.dirname(file),
      ecosystem =
        base === 'package.json'
          ? 'javascript'
          : base === 'pyproject.toml'
            ? 'python'
            : 'rust';
    const pkg: Package = {
      scope,
      file,
      ecosystem,
      scripts: [],
      bins: {},
      scriptsComplete: false,
      valid: true,
    };
    try {
      if (ecosystem === 'javascript') {
        const data = npmSchema.parse(parseJson(text));
        Object.assign(pkg, {
          name: data.name,
          version: data.version,
          description: data.description,
          license: data.license,
          runtime: data.engines?.node,
          repository:
            typeof data.repository === 'string'
              ? data.repository
              : data.repository?.url,
          scripts: Object.keys(data.scripts ?? {}).sort(),
          scriptsComplete: true,
        });
        if (typeof data.bin === 'string' && data.name)
          pkg.bins[data.name.split('/').at(-1)!] = data.bin;
        else if (data.bin && typeof data.bin !== 'string') pkg.bins = data.bin;
        if (data.workspaces)
          facts.push({
            name: 'workspace-members',
            value: Array.isArray(data.workspaces)
              ? data.workspaces
              : data.workspaces.packages,
            scope,
            status: 'detected',
            evidence: [{ file, pointer: '/workspaces', kind: 'manifest' }],
          });
        if (data.packageManager)
          facts.push({
            name: 'package-manager',
            value: data.packageManager,
            scope,
            status: 'detected',
            evidence: [{ file, pointer: '/packageManager', kind: 'manifest' }],
          });
      } else {
        const data = object(toml(text, { maxDepth: 64 }));
        const rawMeta = data[ecosystem === 'python' ? 'project' : 'package'];
        if (
          rawMeta !== undefined &&
          (typeof rawMeta !== 'object' ||
            rawMeta === null ||
            Array.isArray(rawMeta))
        )
          throw new Error('Invalid metadata table');
        const meta = object(rawMeta);
        if (Object.keys(meta).length === 0)
          limitations.push(
            `${file}: no static ${ecosystem === 'python' ? '[project]' : '[package]'} metadata; legacy/dynamic metadata is unsupported.`,
          );
        for (const key of [
          'name',
          'version',
          'description',
          'license',
        ] as const)
          pkg[key] = optionalText(
            meta,
            key,
            ecosystem === 'rust' || key === 'license',
          );
        pkg.runtime = optionalText(
          meta,
          ecosystem === 'python' ? 'requires-python' : 'rust-version',
          ecosystem === 'rust',
        );
        pkg.repository =
          ecosystem === 'rust'
            ? optionalText(meta, 'repository', true)
            : optionalText(object(meta.urls), 'Repository');
        if (ecosystem === 'python') {
          if (
            meta.scripts !== undefined &&
            (typeof meta.scripts !== 'object' ||
              meta.scripts === null ||
              Array.isArray(meta.scripts))
          )
            throw new Error('Invalid scripts table');
          const scripts = object(meta.scripts);
          for (const [name, value] of Object.entries(scripts)) {
            if (typeof value !== 'string') throw new Error();
            pkg.bins[name] = value;
          }
          if (meta.dynamic)
            limitations.push(`${file}: dynamic fields are not evaluated.`);
          if (typeof meta.license === 'object')
            limitations.push(
              `${file}: legacy license table is not an SPDX declaration.`,
            );
        } else {
          const workspace = object(data.workspace);
          if (
            Array.isArray(workspace.members) &&
            workspace.members.every((x) => typeof x === 'string')
          )
            facts.push({
              name: 'workspace-members',
              value: workspace.members,
              scope,
              status: 'detected',
              evidence: [
                { file, pointer: '/workspace/members', kind: 'manifest' },
              ],
            });
          if (Array.isArray(data.bin))
            for (const bin of data.bin) {
              const b = object(bin);
              if (typeof b.name === 'string' && typeof b.path === 'string')
                pkg.bins[b.name] = b.path;
            }
          if (Object.values(meta).some((v) => typeof v === 'object'))
            limitations.push(
              `${file}: inherited workspace metadata is not resolved.`,
            );
        }
      }
    } catch {
      pkg.valid = false;
      pkg.scriptsComplete = false;
      errors.push(file);
    }
    packages.push(pkg);
    if (!pkg.valid) continue;
    for (const field of [
      'name',
      'version',
      'description',
      'license',
      'runtime',
      'repository',
    ] as const) {
      const value = pkg[field];
      if (value !== undefined)
        facts.push({
          name: field,
          value,
          scope,
          status: 'detected',
          evidence: [
            {
              file,
              pointer:
                ecosystem === 'javascript'
                  ? field === 'runtime'
                    ? '/engines/node'
                    : `/${field}`
                  : `/${ecosystem === 'python' ? 'project' : 'package'}/${field === 'runtime' ? (ecosystem === 'python' ? 'requires-python' : 'rust-version') : field === 'repository' && ecosystem === 'python' ? 'urls/Repository' : field}`,
              kind: 'manifest',
            },
          ],
        });
    }
    facts.push({
      name: 'ecosystem',
      value: ecosystem,
      scope,
      status: 'detected',
      evidence: [{ file, kind: 'manifest' }],
    });
    if (pkg.scripts.length)
      facts.push({
        name: 'declared-scripts',
        value: pkg.scripts,
        scope,
        status: 'detected',
        evidence: [{ file, pointer: '/scripts', kind: 'manifest' }],
      });
    if (Object.keys(pkg.bins).length)
      facts.push({
        name: 'declared-entry-points',
        value: Object.keys(pkg.bins).sort(),
        scope,
        status: 'detected',
        evidence: [
          {
            file,
            pointer: ecosystem === 'python' ? '/project/scripts' : '/bin',
            kind: 'manifest',
          },
        ],
      });
  }
  return { packages, facts, errors, limitations };
}
export function packageFor(
  file: string,
  packages: Package[],
): Package | undefined {
  return packages
    .filter((p) => p.scope === '.' || file.startsWith(`${p.scope}/`))
    .sort(
      (a, b) =>
        b.scope.length - a.scope.length ||
        a.ecosystem.localeCompare(b.ecosystem),
    )[0];
}
