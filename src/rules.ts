import type { Severity } from './model.js';
import { quickStartRule } from './rules/readme-quick-start.js';
export const extensionRules = [quickStartRule];
export interface RuleMeta {
  id: string;
  severity: Severity;
  description: string;
  evidence: string;
  limitations: string;
  fix: string;
}
const rule = (
  id: string,
  severity: Severity,
  description: string,
  evidence: string,
  limitations: string,
  fix = 'Manual review; no automatic change.',
): RuleMeta => ({ id, severity, description, evidence, limitations, fix });
export const rules: RuleMeta[] = [
  rule(
    'scan.incomplete',
    'warning',
    'Some requested evidence could not be inspected.',
    'Scanner path and reason.',
    'Excluded and sensitive files are outside default scope; unexpected read/limit failures make analysis partial.',
  ),
  rule(
    'metadata.invalid',
    'error',
    'A supported manifest is malformed or has invalid supported fields.',
    'JSON/TOML manifest path.',
    'Unknown fields are retained as out of scope; executable metadata is never loaded.',
  ),
  rule(
    'readme.missing',
    'warning',
    'No README was found in supported root, .github or docs locations.',
    'Root inventory.',
    'Use docs config for alternative paths. Not every package needs its own README.',
    'Generate a review-only draft using readme.',
  ),
  ...extensionRules.map((r) => r.metadata),
  rule(
    'link.missing',
    'error',
    'A relative local link target does not exist.',
    'Markdown source line and local target inventory.',
    'Excluded, unreadable and unsupported paths are unknown, not missing.',
  ),
  rule(
    'link.case',
    'warning',
    'A local link differs from one unique target only by casing.',
    'Markdown source line and target inventory.',
    'Case-insensitive hosts may resolve it; case-sensitive hosts may not.',
    'SAFE: change literal destination casing only.',
  ),
  rule(
    'link.anchor',
    'error',
    'A supported Markdown heading fragment is absent.',
    'Source line and target headings.',
    'HTML anchors, MDX, custom renderer IDs and generated anchors are not verified.',
  ),
  rule(
    'link.unknown',
    'info',
    'A link cannot be verified within the supported boundary.',
    'Markdown source location.',
    'Remote links are never fetched; symlinks and outside paths are refused.',
  ),
  rule(
    'script.missing',
    'error',
    'A simple documented npm/pnpm run command names an absent script.',
    'Snippet line and same-scope package.json /scripts.',
    'Only simple standalone literal invocations; cd, variables, shell operators and workspace flags are unsupported.',
  ),
  rule(
    'runtime.conflict',
    'error',
    'An explicit Node.js runtime claim and engines.node have disjoint ranges.',
    'README paragraph and /engines/node.',
    'Only Node.js: RANGE or Requires Node.js RANGE syntax; overlapping or narrower ranges are not contradictions.',
  ),
  rule(
    'license.conflict',
    'error',
    'Explicit single-license declarations disagree.',
    'Manifest and README License: or exact SPDX license marker.',
    'No legal interpretation or license selection; compound expressions and unrecognized texts are manual.',
  ),
  rule(
    'entry.missing',
    'warning',
    'A declared file entry point is absent from the local tree.',
    'Manifest /bin and local inventory.',
    'Generated entries may exist after build; this is local availability, not package publication.',
  ),
];
export const registry = new Map(rules.map((r) => [r.id, r]));
export function explain(id: string): RuleMeta & { suppression: object } {
  const rule = registry.get(id);
  if (!rule) throw new Error('Unknown rule ID.');
  return {
    ...rule,
    suppression: {
      version: 1,
      ignore: [{ id, reason: 'Describe the intentional exception.' }],
    },
  };
}
