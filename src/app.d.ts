// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		// interface Error {}

		interface Locals {
			/**
			 * RW-019 — the request-scoped server instant, stamped once in
			 * hooks.server.ts. Every drop-state and countdown resolution reads
			 * this rather than calling Date.now() again, so a single response
			 * cannot straddle the launch instant.
			 */
			now: number;
		}

		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
