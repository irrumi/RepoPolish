export type Severity = 'error' | 'warning' | 'suggestion' | 'info';
export type Outcome =
  | 'verified'
  | 'detected'
  | 'inferred'
  | 'user-provided'
  | 'unknown'
  | 'unsupported'
  | 'skipped';
export interface Evidence {
  file: string;
  line?: number;
  pointer?: string;
  kind: string;
}
export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  message: string;
  scope: string;
  evidence: Evidence[];
  verification: Outcome;
  fixability: 'safe' | 'review' | 'manual';
  suppression?: { reason: string };
}
export interface Fact {
  name: string;
  value: string | string[];
  scope: string;
  status: Outcome;
  evidence: Evidence[];
}
export interface Package {
  scope: string;
  file: string;
  ecosystem: 'javascript' | 'python' | 'rust';
  name?: string;
  description?: string;
  version?: string;
  license?: string;
  runtime?: string;
  repository?: string;
  scripts: string[];
  bins: Record<string, string>;
  scriptsComplete: boolean;
  valid: boolean;
}
export interface Check {
  name: string;
  status: Outcome;
  detail: string;
}
export interface Report {
  schemaVersion: 1;
  toolVersion: string;
  complete: boolean;
  capabilities: {
    readRepository: true;
    writeApprovedFiles: false;
    executeApprovedCommands: false;
    readRemoteMetadata: false;
    writeRemoteMetadata: false;
  };
  facts: Fact[];
  findings: Finding[];
  checks: Check[];
  limitations: string[];
  summary: Record<Severity, number> & { suppressed: number };
}
export interface Edit {
  start: number;
  end: number;
  text: string;
  findingId: string;
}
export interface Change {
  path: string;
  beforeHash: string | null;
  before: string;
  after: string;
  reason: string;
  risk: 'safe' | 'review';
  findingIds: string[];
  diff: string;
}
export interface ChangePlan {
  schemaVersion: 1;
  snapshot: string;
  requiredCapability: 'writeApprovedFiles';
  changes: Change[];
}
export const VERSION = '0.1.0';
export const compare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
export class InputError extends Error {}
