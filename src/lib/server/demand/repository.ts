/**
 * RW-047 — The demand seam, mirroring src/lib/server/drops/repository.ts.
 *
 * Routes import ONLY this interface. That is what lets the archive, the
 * request form and the notify-me form run today against fixtures with no
 * database, and switch to Postgres on one environment variable.
 *
 * Under src/lib/server, so it can never be bundled into client code.
 */
import type { DemandRow, DemandWriteStatus, DropRequestInput, NotifyRequestInput } from './types';

export interface DemandRepository {
	/**
	 * §12 — "bring this drop back, in this size". Idempotent on
	 * (drop, variant, email): a repeat submission returns 'already'.
	 */
	requestDrop(input: DropRequestInput): Promise<DemandWriteStatus>;

	/**
	 * §06 — notify-me on a sold-out piece and size. Idempotent on
	 * (variant, email).
	 */
	notifyMe(input: NotifyRequestInput): Promise<DemandWriteStatus>;

	/**
	 * Per-size demand for one drop. §07: these numbers are real and live.
	 * Nothing in the UI may invent or inflate them.
	 */
	demandForDrop(dropId: string): Promise<DemandRow[]>;
}
