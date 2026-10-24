/**
 * Toasts for the admin shell: confirmation that something happened, with an
 * Undo where one exists. Held in context, not a module singleton, because a
 * module-level array would be shared by every request on the server.
 */
import { getContext, setContext } from 'svelte';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type Toast = {
	readonly id: number;
	readonly message: string;
	readonly tone: ToastTone;
	readonly action?: { readonly label: string; readonly run: () => void | Promise<void> };
};

const KEY = Symbol('admin-toaster');

export class Toaster {
	items = $state<Toast[]>([]);
	#next = 1;

	push(message: string, options: { tone?: ToastTone; action?: Toast['action'] } = {}): void {
		const id = this.#next++;
		this.items = [...this.items, { id, message, tone: options.tone ?? 'neutral', action: options.action }];
		// 5s to read; 8s when there is an Undo to reach for.
		setTimeout(() => this.dismiss(id), options.action ? 8000 : 5000);
	}

	success(message: string, action?: Toast['action']): void {
		this.push(message, { tone: 'success', action });
	}

	error(message: string): void {
		this.push(message, { tone: 'danger' });
	}

	dismiss(id: number): void {
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export function setToaster(): Toaster {
	return setContext(KEY, new Toaster());
}

export function getToaster(): Toaster {
	return getContext<Toaster>(KEY);
}
