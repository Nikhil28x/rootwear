/**
 * RW-039 — Stage resolution. Pure, and driven by an instant the SERVER supplies.
 *
 * §07, the rule that makes the tease work: "SAME STAGE FOR EVERYONE, NO REWIND.
 * The stage is a function of SERVER DATE, not of when a given visitor first
 * arrived. Everyone who opens the page on day four sees day four."
 *
 * §04: "COUNTDOWNS AND STATE CHANGES RUN ON SERVER TIME, never the visitor's
 * clock. A visitor changing their system time must not open the drop early."
 *
 * Nothing here reads Date.now(). Callers pass `now` from the request-scoped
 * server clock (src/lib/server/clock.ts). There is no per-visitor state, no
 * cookie, no localStorage — two visitors at the same instant see the same stage.
 */
import type { StageSchedule } from './schedule';

export type StageState = {
	/** Zero-based stage index, clamped to the schedule. */
	readonly stageIndex: number;
	/** 1-based for display: "Stage 4 of 10". */
	readonly stageNumber: number;
	readonly stageCount: number;
	/** True once the launch instant has passed, per server time. */
	readonly launched: boolean;
	/** True on the final stage before launch — §07's reveal. */
	readonly isFinalStage: boolean;
	/** 0..1 across the whole run. */
	readonly progress: number;
	readonly msUntilLaunch: number;
	readonly daysRemaining: number;
	/** When the next stage begins, or null once the run is over. */
	readonly nextStageAt: number | null;
};

export function resolveStage(schedule: StageSchedule, now: number): StageState {
	const { teaseStart, launchInstant, stageCount, stageDurationMs } = schedule;

	const elapsed = now - teaseStart;
	const rawIndex = Math.floor(elapsed / stageDurationMs);
	const stageIndex = Math.min(Math.max(rawIndex, 0), stageCount - 1);

	const launched = now >= launchInstant;
	const msUntilLaunch = Math.max(0, launchInstant - now);
	const span = launchInstant - teaseStart;
	const progress = span <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / span));

	const nextStageBoundary = teaseStart + (stageIndex + 1) * stageDurationMs;

	return {
		stageIndex,
		stageNumber: stageIndex + 1,
		stageCount,
		launched,
		isFinalStage: stageIndex === stageCount - 1,
		progress,
		msUntilLaunch,
		// Ceil so "1 day remaining" does not read as 0 for most of the final day.
		daysRemaining: Math.ceil(msUntilLaunch / 86_400_000),
		nextStageAt: launched || nextStageBoundary >= launchInstant ? null : nextStageBoundary
	};
}

/** Countdown parts for display. Derived from a server-supplied millisecond span. */
export function countdownParts(msUntilLaunch: number): {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
} {
	const total = Math.max(0, Math.ceil(msUntilLaunch / 1000));
	return {
		days: Math.floor(total / 86_400),
		hours: Math.floor((total % 86_400) / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60
	};
}
