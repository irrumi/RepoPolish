import type { Audit } from './audit.js';
import { change } from './changes.js';
import { clean } from './security.js';
import { InputError, type ChangePlan } from './model.js';

const md = (value: string): string =>
  clean(value).replace(/[\\`*_{}[\]<>()!#|]/g, '\\$&');
export function readmeProposal(audit: Audit): {
  draft: string;
  plan: ChangePlan;
  notes: string[];
} {
  const pkg = audit.analysis.packages.find((p) => p.scope === '.' && p.valid);
  const existing = audit.snapshot.files.find((f) => /^README\.md$/i.test(f));
  const plan: ChangePlan = {
    schemaVersion: 1,
    snapshot: audit.snapshot.fingerprint,
    requiredCapability: 'writeApprovedFiles',
    changes: [],
  };
  if (existing) {
    const fixes = audit.repairs.get(existing) ?? [];
    let after = audit.snapshot.texts.get(existing);
    if (after === undefined)
      throw new InputError('Existing README cannot be safely read.');
    const before = after;
    for (const edit of [...fixes].sort((a, b) => b.start - a.start))
      after = after.slice(0, edit.start) + edit.text + after.slice(edit.end);
    if (after !== before)
      plan.changes.push(
        change(
          existing,
          before,
          after,
          'Targeted README link correction.',
          'safe',
          fixes.map((e) => e.findingId),
        ),
      );
    return {
      draft: '',
      plan,
      notes: [
        'Existing README preserved. Only eligible link corrections are proposed.',
        'Use the audit evidence with a coding agent for reviewed semantic edits. Full regeneration is not supported.',
      ],
    };
  }
  if (
    audit.snapshot.files.some((f) =>
      /^(?:\.github|docs)\/README\.md$/i.test(f),
    ) ||
    audit.snapshot.config.docs.length
  )
    return {
      draft: '',
      plan,
      notes: [
        'Alternative documentation exists. Review it before adding a root README.',
      ],
    };
  if (!audit.snapshot.config.language.startsWith('en'))
    throw new InputError(
      'Only English draft templates are supported; existing documentation is never translated.',
    );
  const name = pkg?.name
    ? md(pkg.name)
    : 'Project name — maintainer input needed';
  const description = pkg?.description
    ? `${md(pkg.description)}\n\n_Description detected in local metadata; behavior not independently verified._`
    : 'Maintainer input needed: explain what this project does and who it helps.';
  const lines = [
    `# ${name}`,
    '',
    description,
    '',
    '## Quick Start',
    '',
    'Maintainer input needed: provide a tested source-installation route and minimal example.',
    '',
    'Package publication and command execution have not been checked.',
    '',
    '## Development',
    '',
  ];
  if (pkg?.scripts.length) {
    lines.push(
      'Declared package scripts (not executed):',
      '',
      ...pkg.scripts.map((s) => `- ${md(s)}`),
      '',
    );
  } else
    lines.push(
      'Maintainer input needed: document the supported development commands.',
      '',
    );
  lines.push(
    '## Limitations',
    '',
    'This is a draft grounded in static metadata. Review every behavioral claim before saving.',
    '',
    '## License',
    '',
  );
  lines.push(
    pkg?.license
      ? `Local metadata declares ${md(pkg.license)}. Confirm the applicable license file and notices.`
      : 'Maintainer input needed: confirm licensing; no license has been selected.',
    '',
  );
  const draft = lines.join('\n');
  plan.changes.push(
    change(
      'README.md',
      undefined,
      draft,
      'Create an explicitly reviewed metadata-grounded draft.',
      'review',
    ),
  );
  return {
    draft,
    plan,
    notes: [
      'Draft only. Saving requires --write; policies and licensing require maintainer input.',
    ],
  };
}
export function launchProposal(audit: Audit): object {
  const { report } = audit;
  const pkg = audit.analysis.packages.find((p) => p.scope === '.' && p.valid);
  const description = pkg?.description
    ? clean(pkg.description)
    : 'Maintainer input needed: provide a factual one-sentence purpose.';
  const ecosystems = [
    ...new Set(
      audit.analysis.packages.filter((p) => p.valid).map((p) => p.ecosystem),
    ),
  ].sort();
  return {
    schemaVersion: 1,
    status: 'local-draft',
    description: {
      text: description,
      provenance: pkg?.description ? 'detected' : 'unknown',
    },
    topicCandidates: ecosystems,
    socialPreviewBrief: {
      title: clean(pkg?.name ?? 'Project name needed'),
      subtitle: description,
      guidance:
        'Use readable type and high contrast. Depict a real workflow; do not invent screenshots. Upload and platform dimensions require manual review.',
    },
    demoRecommendation:
      pkg && Object.keys(pkg.bins).length
        ? 'Capture a real terminal invocation with its actual result and limitations.'
        : 'Provide a small reproducible input/output example of the implemented behavior.',
    releaseCheck: {
      complete: report.complete,
      blocking: report.findings.filter(
        (f) => !f.suppression && f.severity === 'error',
      ),
      recommended: report.findings.filter(
        (f) => !f.suppression && ['warning', 'suggestion'].includes(f.severity),
      ),
      manual: [
        'Review licensing and ownership.',
        'Confirm contribution and private security-reporting channels.',
        'Inspect an actual built package and test the documented installation route.',
        'Confirm limitations and maturity are disclosed.',
      ],
      unknown: report.checks.filter((c) =>
        ['unknown', 'unsupported'].includes(c.status),
      ),
      skipped: report.checks.filter((c) => c.status === 'skipped'),
      guidanceFiles: audit.snapshot.files.filter((f) =>
        /(?:^|\/)(?:CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|CHANGELOG|CITATION)(?:\.[^/]+)?$/i.test(
          f,
        ),
      ),
    },
    limitations: report.limitations,
  };
}
