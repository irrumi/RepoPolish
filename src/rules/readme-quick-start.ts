import type { RuleMeta } from '../rules.js';
import type { Evidence, Outcome } from '../model.js';
import type { Markdown } from '../markdown.js';

export interface RuleContext {
  readmePath?: string;
  readme?: Markdown;
  language: string;
}
export interface RuleResult {
  message: string;
  evidence: Evidence[];
  verification: Outcome;
  scope: string;
}
export interface AuditRule {
  metadata: RuleMeta;
  check(context: RuleContext): RuleResult[];
}
/** Example built-in extension: a structural suggestion, never a correctness error. */
export const quickStartRule: AuditRule = {
  metadata: {
    id: 'readme.quick-start',
    severity: 'suggestion',
    description:
      'README has no installation, usage, example or quick-start heading.',
    evidence: 'Parsed README headings.',
    limitations:
      'English heuristic; a suggestion about structure, not comprehension.',
    fix: 'Manual review; no automatic change.',
  },
  check({ readmePath, readme, language }) {
    if (
      !readmePath ||
      !readme ||
      !language.startsWith('en') ||
      readme.headings.some((h) =>
        /install|usage|quick.?start|example/i.test(h.text),
      )
    )
      return [];
    return [
      {
        message:
          'Consider a discoverable installation, usage or example heading.',
        scope: '.',
        evidence: [{ file: readmePath, kind: 'markdown-headings' }],
        verification: 'inferred',
      },
    ];
  },
};
