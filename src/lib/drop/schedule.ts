/**
 * RW-040 / RW-002 — The stage schedule: start date, stage count, launch instant.
 *
 * §07: the tease "advances ONE STAGE PER DAY across a 7-10 DAY RUN until it is
 * full grown and the drop unlocks". §02 fixes the tease live on 14 Sep 2026 and
 * the store live on 24 Sep 2026 — a ten-day run at one stage per day.
 *
 * The repo previously encoded a 30-day run to 11 Oct at one stage per FIVE days
 * (src/lib/drop-timeline.ts), which matches neither the brief's cadence nor its
 * launch date. That is corrected here.
 *
 * §15 OPEN ITEM — "Exact launch time, 24 Sep", owner Aaron, was due 12 Sep.
 * Trone's recommendation is an evening slot stated in IST. 19:00 IST is encoded
 * below; `LAUNCH_TIME_CONFIRMED` stays false until Aaron confirms in writing,
 * and RW-167's launch gate fails while it is false.
 */

import { STAGE_COUNT } from './stage-manifest';

/** IST is +05:30 year round. Every instant below is written with the offset explicit. */
export const IST_OFFSET = '+05:30';

/** §02: store live, drop opens at an exact stated time on 24 Sep 2026. */
export const LAUNCH_INSTANT = Date.parse('2026-09-24T19:00:00+05:30');

/** Awaiting Aaron's written answer on the exact time of day. */
export const LAUNCH_TIME_CONFIRMED = false;

export const DAY_MS = 86_400_000;

/** §07: one stage per day. The run length is the number of stage assets. */
export const STAGE_DURATION_MS = DAY_MS;

export { STAGE_COUNT };

/**
 * Derived, not hardcoded: the tease starts however many days before launch as
 * there are stages. Supplying the 8th-10th stage asset (§07 allows 7-10)
 * lengthens the run automatically, with no date edit and no second source of
 * truth to drift.
 *
 * With the seven assets currently in static/, the run is 17-24 Sep 2026.
 */
export const TEASE_START = LAUNCH_INSTANT - STAGE_COUNT * STAGE_DURATION_MS;

export type StageSchedule = {
	readonly teaseStart: number;
	readonly launchInstant: number;
	readonly stageCount: number;
	readonly stageDurationMs: number;
};

export const DROP_01_SCHEDULE: StageSchedule = {
	teaseStart: TEASE_START,
	launchInstant: LAUNCH_INSTANT,
	stageCount: STAGE_COUNT,
	stageDurationMs: STAGE_DURATION_MS
};
