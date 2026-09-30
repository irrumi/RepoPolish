#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { inspect, exitCode } from './audit.js';
import { fixPlan, applyPlan, ApplyError } from './changes.js';
import { readmeProposal, launchProposal } from './generators.js';
import { explain, rules } from './rules.js';
import { terminal } from './output.js';
import { clean, display } from './security.js';
import { InputError, VERSION } from './model.js';

const commands = ['audit', 'check', 'fix', 'readme', 'launch', 'explain'];
function help(command?: string): string {
  const common =
    '--json  --quiet  --no-color  --fail-on error|warning|suggestion|none';
  const usage: Record<string, string> = {
    audit: `audit [path] [--ci] [${common}]\nOffline static evidence checks. Never executes project commands.`,
    check: `check [path] [--safe] [${common}]\nStatic verification using the audit engine. Execution is not supported.`,
    fix: `fix [path] [--dry-run | --yes] [--json]\nPreview exact changes by default. --yes applies only eligible local fixes.`,
    readme: `readme [path] [--dry-run | --write] [--json]\nPropose a draft or targeted existing-README repair. --write saves this proposal.`,
    launch: `launch [path] [--check] [--json]\nLocal factual recommendations and aggregated release checks. No publishing.`,
    explain:
      'explain <rule-id> [--json]\nDescribe a rule, evidence, limitations, suppression and fixes.',
  };
  return command
    ? `repopolish ${usage[command]}\nUse --help for help. Default path: current directory. Default threshold: error (or config).`
    : `RepoPolish ${VERSION}\nUsage: repopolish <command> [path] [options]\nCommands: ${commands.join(', ')}\nUse repopolish <command> --help. --version prints the version.\nExits: 0 completed below threshold; 1 findings exceed threshold; 2 invalid/partial input or write conflict; 3 unexpected internal failure.\nRule IDs: ${rules.map((r) => r.id).join(', ')}`;
}
export async function main(args: string[]): Promise<number> {
  const json = args.includes('--json');
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        json: { type: 'boolean' },
        quiet: { type: 'boolean' },
        'no-color': { type: 'boolean' },
        ci: { type: 'boolean' },
        safe: { type: 'boolean' },
        check: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        yes: { type: 'boolean' },
        write: { type: 'boolean' },
        'fail-on': { type: 'string' },
      },
    });
    const command = positionals[0];
    if (values.version) {
      console.log(json ? JSON.stringify({ version: VERSION }) : VERSION);
      return 0;
    }
    if (command && !commands.includes(command))
      throw new InputError('Unknown command; use --help.');
    if (values.help || !command) {
      console.log(
        json ? JSON.stringify({ help: help(command) }) : help(command),
      );
      return 0;
    }
    if (positionals.length > 2)
      throw new InputError(
        'Too many positional arguments. Quote paths containing spaces.',
      );
    for (const [flag, allowed] of Object.entries({
      yes: ['fix'],
      write: ['readme'],
      'dry-run': ['fix', 'readme'],
      safe: ['check'],
      check: ['launch'],
      ci: ['audit', 'check'],
    }))
      if (values[flag as keyof typeof values] && !allowed.includes(command))
        throw new InputError(`--${flag} is not supported for ${command}.`);
    if (values['dry-run'] && (values.yes || values.write))
      throw new InputError('Dry-run and write flags are mutually exclusive.');
    const threshold = values['fail-on'];
    if (
      threshold &&
      !['error', 'warning', 'suggestion', 'none'].includes(threshold)
    )
      throw new InputError('Invalid --fail-on threshold.');
    if (command === 'explain') {
      if (!positionals[1] || !rules.some((r) => r.id === positionals[1]))
        throw new InputError('Specify a known rule ID; see --help.');
      console.log(JSON.stringify(explain(positionals[1]), null, 2));
      return 0;
    }
    const target = positionals[1] ?? '.',
      result = await inspect(target);
    const failOn = (threshold ?? result.snapshot.config.failOn) as
      'error' | 'warning' | 'suggestion' | 'none';
    if (command === 'audit' || command === 'check') {
      if (json) console.log(JSON.stringify(result.report, null, 2));
      else if (!values.quiet) console.log(terminal(result.report));
      return exitCode(result.report, failOn);
    }
    if (command === 'launch') {
      const proposal = launchProposal(result);
      console.log(JSON.stringify(proposal, null, 2));
      return values.check
        ? exitCode(result.report, failOn)
        : result.report.complete
          ? 0
          : 2;
    }
    const proposal = command === 'readme' ? readmeProposal(result) : undefined;
    const plan = proposal?.plan ?? fixPlan(result);
    const writing = Boolean(values.yes || values.write);
    if (writing && !result.report.complete)
      throw new InputError(
        'Incomplete evidence; resolve scan failures before writing.',
      );
    if (writing) {
      // Preview before touching disk even in explicit non-interactive write mode.
      console.error(
        plan.changes
          .map((c) => clean(c.path) + '\n' + display(c.diff))
          .join('\n') || 'No eligible changes.',
      );
      const applied = await applyPlan(result.snapshot.root, plan, {
        writeApprovedFiles: true,
        allowReview: Boolean(values.write),
      });
      const after = await inspect(target);
      const remaining = new Set(after.report.findings.map((f) => f.id));
      const output = {
        schemaVersion: 1,
        applied,
        resolvedFindingIds: after.report.complete
          ? result.report.findings
              .filter((f) => !f.suppression && !remaining.has(f.id))
              .map((f) => f.id)
          : [],
        after: after.report,
      };
      console.log(
        json
          ? JSON.stringify(output, null, 2)
          : `Applied ${applied.length} file changes.\n${terminal(after.report)}`,
      );
      return exitCode(after.report, failOn);
    }
    if (json)
      console.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            plan,
            ...(proposal
              ? { draft: proposal.draft, notes: proposal.notes }
              : {}),
          },
          (_key, value: unknown) =>
            typeof value === 'string' ? display(value) : value,
          2,
        ),
      );
    else {
      console.log(
        plan.changes
          .map(
            (c) =>
              `${clean(c.path)} [${c.risk}] ${c.reason}\n${display(c.diff)}`,
          )
          .join('\n') || 'No eligible changes.',
      );
      if (proposal) console.log(proposal.notes.join('\n'));
    }
    return result.report.complete ? 0 : 2;
  } catch (error) {
    const invalid =
      error instanceof InputError ||
      (error instanceof Error &&
        'code' in error &&
        String(error.code).startsWith('ERR_PARSE_ARGS'));
    const message = invalid
      ? clean((error as Error).message)
      : 'Unexpected internal failure. Please report a minimal reproducible case without secrets.';
    if (json)
      console.log(
        JSON.stringify({
          schemaVersion: 1,
          error: message,
          ...(error instanceof ApplyError ? { applied: error.applied } : {}),
        }),
      );
    else console.error(message);
    return invalid ? 2 : 3;
  }
}
process.exitCode = await main(process.argv.slice(2));
