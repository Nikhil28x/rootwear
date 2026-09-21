/**
 * RW-038 — Drop 01 campaign calendar.
 *
 * This module previously hardcoded a 30-day run to 2026-10-11 at one stage per
 * FIVE days. §02 fixes the launch at 24 Sep 2026 and §07 fixes the cadence at
 * ONE STAGE PER DAY over a 7-10 day run. Both are corrected; the schedule now
 * lives in $lib/drop/schedule and the stage copy in $lib/drop/stage-manifest.
 *
 * Kept as a thin re-export so existing importers keep working.
 *
 * IMPORTANT (§04, §18): `launched` and `stageIndex` are authoritative ONLY when
 * resolved from the server clock. Never call getDropState(Date.now()) in client
 * code to decide whether the drop is open — a visitor with a forward-set clock
 * would open it early, which the launch gate explicitly tests for. Client code
 * receives a server-resolved StageState as a prop.
 */
import { DROP_01_SCHEDULE, LAUNCH_INSTANT, TEASE_START, DAY_MS } from './drop/schedule';
import { STAGE_MANIFEST } from './drop/stage-manifest';
import { resolveStage, countdownParts, type StageState } from './drop/stage-resolver';

export { DAY_MS, LAUNCH_INSTANT, TEASE_START, resolveStage, countdownParts };
export type { StageState };

/** Back-compat aliases for the original export names. */
export const DROP_START = TEASE_START;
export const DROP_LAUNCH = LAUNCH_INSTANT;

/** Stage copy, sourced from the manifest so there is one list, not two. */
export const GROWTH_STAGES = STAGE_MANIFEST.map((stage, index) => ({
	day: index,
	label: stage.label,
	note: stage.note
}));

/**
 * Resolve the full campaign state at an instant.
 * Callers MUST pass a server-supplied `now` (event.locals.now).
 */
export function getDropState(now: number) {
	const stage = resolveStage(DROP_01_SCHEDULE, now);
	const parts = countdownParts(stage.msUntilLaunch);
	return {
		stageIndex: stage.stageIndex,
		stage: GROWTH_STAGES[stage.stageIndex],
		launched: stage.launched,
		progress: stage.progress,
		nextGrowthAt: stage.nextStageAt,
		...parts
	};
}
