/**
 * The progressive-enhancement wrapper every admin form uses.
 *
 * Without JavaScript the form still posts and the page re-renders with the
 * action's result. With it, the submit button shows it is working, the result
 * becomes a toast, and the page data refreshes in place.
 *
 * Actions return `{ message }` on success and `fail(status, { error })` on
 * failure; both become toasts. A redirect is followed as normal.
 */
import { applyAction } from '$app/forms';
import type { SubmitFunction } from '@sveltejs/kit';
import type { Toaster } from './toast.svelte';

type Options = {
	/** Clear the form after success. Off by default: most admin forms edit a record. */
	reset?: boolean;
	/** Shown when the action returns no message of its own. */
	success?: string;
	onSuccess?: (data: Record<string, unknown> | undefined) => void;
};

export function submitter(toaster: Toaster, options: Options = {}): SubmitFunction {
	return ({ formElement, submitter }) => {
		const button = submitter instanceof HTMLButtonElement ? submitter : null;
		formElement.setAttribute('aria-busy', 'true');
		if (button) {
			button.dataset.loading = 'true';
			button.disabled = true;
		}

		return async ({ result, update }) => {
			formElement.removeAttribute('aria-busy');
			if (button) {
				delete button.dataset.loading;
				button.disabled = false;
			}

			if (result.type === 'success') {
				const data = result.data as Record<string, unknown> | undefined;
				const message = (data?.message as string | undefined) ?? options.success;
				if (message) toaster.success(message);
				options.onSuccess?.(data);
				await update({ reset: options.reset ?? false });
			} else if (result.type === 'failure') {
				const data = result.data as Record<string, unknown> | undefined;
				toaster.error((data?.error as string | undefined) ?? 'That did not save. Try again.');
				await update({ reset: false });
			} else if (result.type === 'error') {
				toaster.error(result.error?.message ?? 'Something went wrong. Try again.');
			} else {
				await applyAction(result);
			}
		};
	};
}
