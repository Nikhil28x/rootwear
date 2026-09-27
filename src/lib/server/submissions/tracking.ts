export type SubmissionPrefix = 'CON' | 'REQ' | 'NTF' | 'PRE';

let mockSequence = 0;

/**
 * Fixture-mode receipt numbers. Postgres owns live references; this generator
 * gives the no-database flow the same contract for browser verification.
 */
export function nextMockTrackingId(prefix: SubmissionPrefix): string {
	mockSequence += 1;
	return `RW-${prefix}-M${String(mockSequence).padStart(6, '0')}`;
}
