import { verifyLinks } from './verifiers/links.js';
import { verifyClaims } from './verifiers/claims.js';
import path from 'node:path';
import { analyze } from './analyzers.js';
import { scan, type Snapshot } from './filesystem.js';
import { markdown, type Markdown } from './markdown.js';
import { clean, hash } from './security.js';
import { registry, extensionRules } from './rules.js';
import {
  compare,
  VERSION,
  InputError,
  type Report,
  type Evidence,
  type Outcome,
  type Edit,
  type Finding,
} from './model.js';

export interface Audit {
  snapshot: Snapshot;
  report: Report;
  repairs: Map<string, Edit[]>;
  documents: Map<string, Markdown>;
  analysis: ReturnType<typeof analyze>;
}
export async function inspect(input = '.'): Promise<Audit> {
  const snapshot = await scan(input),
    analysis = analyze(snapshot),
    documents = new Map<string, Markdown>(),
    repairs = new Map<string, Edit[]>();
  const findings: Finding[] = [];
  let complete = snapshot.issues.length === 0 && analysis.errors.length === 0;
  const add = (
    id: string,
    message: string,
    scope: string,
    evidence: Evidence[],
    verification: Outcome = 'verified',
  ): Finding => {
    const rule = registry.get(id)!;
    const finding: Finding = {
      id: hash(JSON.stringify([id, scope, evidence, message])).slice(0, 20),
      ruleId: id,
      severity: rule.severity,
      message,
      scope,
      evidence,
      verification,
      fixability: 'manual',
    };
    const suppression = snapshot.config.ignore.find(
      (i) => i.id === id && (i.scope === undefined || i.scope === scope),
    );
    if (suppression) finding.suppression = { reason: suppression.reason };
    findings.push(finding);
    return finding;
  };
  for (const i of snapshot.config.ignore)
    if (!registry.has(i.id))
      throw new InputError('Configuration contains an unknown ignore rule ID.');
  for (const issue of snapshot.issues)
    add(
      'scan.incomplete',
      issue.reason,
      '.',
      [{ file: issue.file, kind: 'filesystem' }],
      'unknown',
    );
  for (const file of analysis.errors)
    add(
      'metadata.invalid',
      'Cannot parse supported manifest fields; checks for this scope are incomplete.',
      path.posix.dirname(file),
      [{ file, kind: 'manifest' }],
      'unknown',
    );
  for (const [file, text] of snapshot.texts)
    if (/\.md$/i.test(file)) {
      try {
        documents.set(file, markdown(text));
      } catch {
        complete = false;
        add(
          'scan.incomplete',
          'Markdown parse budget or parser failure; document checks skipped.',
          '.',
          [{ file, kind: 'markdown' }],
          'unknown',
        );
      }
    }
  const rootReadme =
    snapshot.files.find((f) =>
      /^(?:README\.md|\.github\/README\.md|docs\/README\.md)$/i.test(f),
    ) ?? snapshot.config.docs.find((f) => documents.has(f));
  if (!rootReadme)
    add(
      'readme.missing',
      'No README detected in supported locations.',
      '.',
      [{ file: '.', kind: 'inventory' }],
      complete ? 'detected' : 'unknown',
    );
  for (const rule of extensionRules)
    for (const finding of rule.check({
      readmePath: rootReadme,
      readme: rootReadme ? documents.get(rootReadme) : undefined,
      language: snapshot.config.language,
    }))
      add(
        rule.metadata.id,
        finding.message,
        finding.scope,
        finding.evidence,
        finding.verification,
      );

  const context = { snapshot, analysis, documents, repairs, complete, add };
  await verifyLinks(context);
  await verifyClaims(context);
  const report: Report = {
    schemaVersion: 1,
    toolVersion: VERSION,
    complete,
    capabilities: {
      readRepository: true,
      writeApprovedFiles: false,
      executeApprovedCommands: false,
      readRemoteMetadata: false,
      writeRemoteMetadata: false,
    },
    facts: analysis.facts,
    findings: findings.sort(
      (a, b) =>
        compare(a.scope, b.scope) ||
        compare(a.ruleId, b.ruleId) ||
        compare(a.evidence[0]?.file ?? '', b.evidence[0]?.file ?? '') ||
        (a.evidence[0]?.line ?? 0) - (b.evidence[0]?.line ?? 0) ||
        compare(a.id, b.id),
    ),
    checks: [
      {
        name: 'local-links',
        status: complete ? 'verified' : 'unknown',
        detail:
          'Relative Markdown links and supported heading anchors checked within scanned scope; individual unknowns remain in findings.',
      },
      {
        name: 'package-metadata',
        status: analysis.errors.length ? 'unknown' : 'detected',
        detail:
          'Static JS, PEP 621 and Cargo declarations; no imports or project tooling.',
      },
      {
        name: 'cli-api-coverage',
        status: 'unsupported',
        detail:
          'Entry points detected; subcommands, options and APIs are not extracted. Unrecognized commands are not errors.',
      },
      {
        name: 'runtime-constraints',
        status: 'detected',
        detail:
          'Only explicit Node.js claims are compared with npm semver. Python/Rust constraints are recorded without compatibility verification.',
      },
      {
        name: 'execution',
        status: 'skipped',
        detail:
          'Build, test, lint, CLI help and install commands were not executed.',
      },
      {
        name: 'registry-and-github',
        status: 'unknown',
        detail:
          'Publication, remote metadata, external links and social previews were not checked offline.',
      },
    ],
    limitations: [
      'Static checks do not establish overall correctness or release safety.',
      'Shell parsing is partial; yarn executable fallbacks, compound commands, install package identities, variables and changed working directories are not verified.',
      'Nested manifests define nearest package scope; workspace inheritance and cross-package shell contexts are unsupported.',
      'Only root .gitignore is interpreted. Built-in exclusions and sensitive paths remain excluded.',
      ...analysis.limitations,
    ],
    summary: { error: 0, warning: 0, suggestion: 0, info: 0, suppressed: 0 },
  };
  if (snapshot.config.projectType)
    report.facts.push({
      name: 'project-type',
      value: snapshot.config.projectType,
      scope: '.',
      status: 'user-provided',
      evidence: [
        { file: '.repopolish.json', pointer: '/projectType', kind: 'config' },
      ],
    });
  for (const finding of findings)
    if (finding.suppression) report.summary.suppressed++;
    else report.summary[finding.severity]++;
  // Sanitize repository strings at the report boundary, never mutate source bytes or plans.
  const sanitized = JSON.parse(
    JSON.stringify(report, (_k, v: unknown) =>
      typeof v === 'string' ? clean(v) : v,
    ),
  ) as Report;
  return { snapshot, report: sanitized, repairs, documents, analysis };
}
export async function audit(input = '.'): Promise<Report> {
  return (await inspect(input)).report;
}
export function exitCode(
  report: Report,
  failOn: 'error' | 'warning' | 'suggestion' | 'none' = 'error',
): number {
  if (!report.complete) return 2;
  const levels = ['error', 'warning', 'suggestion'] as const;
  return failOn !== 'none' &&
    levels
      .slice(0, levels.indexOf(failOn) + 1)
      .some((l) => report.summary[l] > 0)
    ? 1
    : 0;
}
