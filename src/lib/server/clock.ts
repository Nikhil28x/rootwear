/**
 * RW-019 — One server clock.
 *
 * §04: "COUNTDOWNS AND STATE CHANGES RUN ON SERVER TIME, never the visitor's
 * clock." §18 launch gate: "A device with its clock set forward cannot open the
 * drop early."
 *
 * Every drop-state and stage decision reads `now` from here, via
 * `event.locals.now`, which hooks.server.ts stamps once per request so that
 * every resolution within a single response agrees on the same instant.
 *
 * This module is under src/lib/server, so SvelteKit refuses to bundle it into
 * client code.
 */

/** The single authorised call to Date.now() in drop/commerce paths. */
export function serverNow(): number {
	return Date.now();
}
