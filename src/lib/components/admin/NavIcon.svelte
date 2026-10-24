<script lang="ts">
	import {
		ChartColumn,
		Clock,
		FileText,
		History,
		Inbox,
		LayoutTemplate,
		Megaphone,
		MessageSquare,
		Package,
		Receipt,
		Settings,
		Shield,
		ShoppingCart,
		Sparkles,
		Ticket,
		TrendingUp,
		Truck,
		User,
		Users
	} from '@lucide/svelte';
	import type { AdminNavIcon } from '$lib/server/admin/roles';

	/** One outline icon set for the whole admin, 1.5px stroke. */
	let { name, size = 20 }: { name: AdminNavIcon; size?: number } = $props();

	const ICONS = {
		chart: ChartColumn,
		inbox: Inbox,
		package: Package,
		receipt: Receipt,
		clock: Clock,
		truck: Truck,
		cart: ShoppingCart,
		users: Users,
		user: User,
		megaphone: Megaphone,
		ticket: Ticket,
		sparkles: Sparkles,
		layout: LayoutTemplate,
		trending: TrendingUp,
		file: FileText,
		message: MessageSquare,
		settings: Settings,
		shield: Shield,
		history: History
	} as const;

	const Icon = $derived(ICONS[name]);
</script>

<Icon {size} strokeWidth={1.5} aria-hidden="true" />
