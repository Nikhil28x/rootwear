/**
 * RW-041 — Auto-publish at the launch instant.
 *
 * §06 state 2: "State 2 AUTO-PUBLISHES at the scheduled launch instant, with a
 * manual push button as the fallback if something is wrong."
 *
 * Without this, `state` is whatever was last written, so a drop sitting in
 * TEASE stays in TEASE forever — the launch instant passes, the countdown hits
 * zero, and the store never opens. That is the failure this closes.
 *
 * WHY DERIVE ON READ, when §06 insists state is explicit and stored?
 *
 * Because the brief's own mechanism is a SCHEDULED JOB that writes the state
 * (§07: "Scheduled job at 00:00 IST to advance the stage"). A job can be late,
 * can fail, or — as today — may not be deployed yet. Deriving the one
 * time-based transition on read makes the storefront correct regardless, and
 * the job becomes an optimisation rather than a single point of failure.
 *
 * Note what is NOT derived here: nothing is inferred from stock counts. §06 is
 * explicit that per-size availability belongs to the variant and must never be
 * what decides the drop's state. A size selling out does not move a drop to
 * SOLD_OUT; only an explicit write does. The single transition below is driven
 * by the clock, which is a schedule the drop already carries.
 */
import type { Drop } from './drop';
import type { DropState } from './drop-state';

/**
 * The state to present at `now`.
 *
 * TEASE and REVEALED are pre-launch states, so once the launch instant has
 * passed they present as LIVE. Every other state is returned untouched: a
 * drop that was explicitly moved to PARTIAL, SOLD_OUT or ARCHIVED must not be
 * dragged back open by the clock.
 */
export function resolveDropState(drop: Drop, now: number): DropState {
	const preLaunch = drop.state === 'TEASE' || drop.state === 'REVEALED';
	if (preLaunch && now >= drop.launchInstant) return 'LIVE';
	return drop.state;
}

/** The drop as the storefront should see it at `now`. */
export function withResolvedState(drop: Drop, now: number): Drop {
	const state = resolveDropState(drop, now);
	return state === drop.state ? drop : { ...drop, state };
}
