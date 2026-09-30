import type { Audit } from '../audit.js';
import type { Evidence, Outcome, Finding } from '../model.js';
export type VerificationContext = Pick<
  Audit,
  'snapshot' | 'analysis' | 'documents' | 'repairs'
> & {
  complete: boolean;
  add: (
    id: string,
    message: string,
    scope: string,
    evidence: Evidence[],
    verification?: Outcome,
  ) => Finding;
};
