// A shared campaign calendar, not a timer restarted for each visitor.
export const DROP_START = Date.parse('2026-09-11T18:00:00+05:30');
export const DROP_LAUNCH = Date.parse('2026-10-11T18:00:00+05:30');
export const DAY_MS = 86_400_000;
export const GROWTH_STAGES = [
	{ day: 0, label: 'Seedling', note: 'Every story starts small.' },
	{ day: 5, label: 'Taking root', note: 'Quiet strength, beneath the surface.' },
	{ day: 10, label: 'Rising', note: 'A little taller. A little closer.' },
	{ day: 15, label: 'Branching', note: 'Our first growth is taking shape.' },
	{ day: 20, label: 'Reaching', note: 'New branches. The same roots.' },
	{ day: 25, label: 'Almost there', note: 'The final days before the first drop.' },
	{ day: 30, label: 'Full growth', note: 'The wait is over. Meet Drop 001.' }
];

export function getDropState(now: number) {
	const elapsedDays = Math.max(0, (now - DROP_START) / DAY_MS);
	const stageIndex = Math.min(6, Math.floor(elapsedDays / 5));
	const remainingSeconds = Math.max(0, Math.ceil((DROP_LAUNCH - now) / 1000));
	return {
		stageIndex,
		stage: GROWTH_STAGES[stageIndex],
		launched: now >= DROP_LAUNCH,
		progress: Math.max(0, Math.min(1, (now - DROP_START) / (DROP_LAUNCH - DROP_START))),
		nextGrowthAt: stageIndex < 6 ? DROP_START + GROWTH_STAGES[stageIndex + 1].day * DAY_MS : null,
		days: Math.floor(remainingSeconds / 86400),
		hours: Math.floor((remainingSeconds % 86400) / 3600),
		minutes: Math.floor((remainingSeconds % 3600) / 60),
		seconds: remainingSeconds % 60
	};
}
