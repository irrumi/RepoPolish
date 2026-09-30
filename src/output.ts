import type { Report } from './model.js';
import { clean } from './security.js';
export function terminal(report: Report): string {
  const lines = [
    `RepoPolish ${report.toolVersion} — offline static audit`,
    report.complete
      ? 'Completed within supported scope.'
      : 'PARTIAL: some evidence could not be analyzed.',
  ];
  for (const finding of report.findings.filter((f) => !f.suppression)) {
    const at = finding.evidence[0];
    lines.push(
      `${finding.severity.toUpperCase()} ${finding.ruleId} [${finding.verification}] ${clean(at?.file ?? '.')}${at?.line ? `:${at.line}` : ''}`,
      `  ${clean(finding.message)}`,
    );
  }
  const s = report.summary;
  lines.push(
    `${s.error} errors, ${s.warning} warnings, ${s.suggestion} suggestions, ${s.info} information; ${s.suppressed} suppressed.`,
    'SKIPPED: repository commands. UNKNOWN: registry and remote metadata.',
    'CLI/API extraction is unsupported; passing checks do not establish overall correctness.',
  );
  return lines.join('\n');
}
