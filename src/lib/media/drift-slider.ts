/**
 * A slow, endless strip of photographs that answers the hand.
 *
 *   use:driftSlider   on the slider; its first child is the track, which holds
 *                     the items twice over (the second copy makes the loop).
 *
 * At rest it drifts slowly to the left. Then:
 *   - drag (touch or mouse): the strip follows the finger one to one; let go
 *     and it carries on with the flick's speed, which eases back to the drift,
 *     in the flick's direction, so a flick to the right reverses it;
 *   - press and hold: it stops under the finger (pause);
 *   - page scroll: scrolling down pushes it on faster, scrolling up pulls it
 *     back, and the push fades out after the scroll stops;
 *   - hover (mouse): it pauses, so a photograph can be looked at.
 * Vertical swipes are left to the page (touch-action: pan-y), so it never
 * traps scrolling. Off screen it stops drawing. With reduced motion there is
 * no drift and no scroll push, but it can still be dragged.
 */

/** Pixels per second of the resting drift. */
const DRIFT = 26;
/** How quickly the speed returns to the drift after a flick or a scroll (per second). */
const SETTLE = 1.6;
/** Pixels per second of push for every pixel the page scrolls in a frame. */
const SCROLL_PUSH = 9;
/** A drag shorter than this is a tap: the link under it still opens. */
const TAP = 6;

export function driftSlider(node: HTMLElement) {
	const track = node.firstElementChild as HTMLElement | null;
	if (!track) return {};
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let offset = 0;
	/** px/s, signed: negative moves left. */
	let velocity = reduced ? 0 : -DRIFT;
	/** The drift's direction: a flick sets it. */
	let direction = -1;
	let hovered = false;
	let visible = true;
	let drag: { id: number; x: number; y: number; start: number; last: number; t: number; speed: number; moved: number; horizontal: boolean | null } | null = null;
	let suppressClick = false;

	/** Half the track: one copy of the items. The offset wraps within it. */
	let span = track.scrollWidth / 2;
	const measure = () => (span = Math.max(track.scrollWidth / 2, 1));
	const resize = new ResizeObserver(measure);
	resize.observe(track);

	const wrap = (x: number) => {
		const m = ((x % span) + span) % span;
		return m - span; // in [-span, 0)
	};
	const paint = () => {
		track.style.transform = `translate3d(${offset}px, 0, 0)`;
	};

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			start: offset,
			last: event.clientX,
			t: performance.now(),
			speed: 0,
			moved: 0,
			horizontal: event.pointerType === 'mouse' ? true : null
		};
		velocity = 0; // hold = pause
	}
	function onPointerMove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		// Touch: decide once whether this is a horizontal drag or a page scroll.
		if (drag.horizontal === null) {
			if (Math.hypot(dx, dy) < TAP) return;
			drag.horizontal = Math.abs(dx) > Math.abs(dy);
			if (!drag.horizontal) {
				drag = null;
				return;
			}
			node.setPointerCapture(event.pointerId);
		}
		if (!drag.horizontal) return;
		const now = performance.now();
		const dt = Math.max((now - drag.t) / 1000, 1 / 240);
		drag.speed = drag.speed * 0.6 + ((event.clientX - drag.last) / dt) * 0.4;
		drag.last = event.clientX;
		drag.t = now;
		drag.moved = Math.max(drag.moved, Math.abs(dx));
		offset = wrap(drag.start + dx);
		paint();
	}
	function onPointerUp(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		const flicked = performance.now() - drag.t < 90 ? drag.speed : 0;
		if (drag.moved > TAP) {
			suppressClick = true;
			velocity = Math.max(-2400, Math.min(2400, flicked));
			if (Math.abs(flicked) > 40) direction = Math.sign(flicked);
		} else if (!reduced) {
			velocity = direction * DRIFT;
		}
		drag = null;
	}
	/** A drag is not a click: keep the link under it from opening. */
	function onClick(event: MouseEvent) {
		if (!suppressClick) return;
		suppressClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	let lastScroll = window.scrollY;
	function onScroll() {
		const delta = window.scrollY - lastScroll;
		lastScroll = window.scrollY;
		if (reduced || !visible || drag) return;
		// Down pushes it on (in its direction), up pulls it back.
		velocity += direction * Math.max(-60, Math.min(60, delta)) * SCROLL_PUSH * 0.1;
		velocity = Math.max(-1800, Math.min(1800, velocity));
	}

	const onEnter = (event: PointerEvent) => event.pointerType === 'mouse' && (hovered = true);
	const onLeave = () => (hovered = false);

	let frame = 0;
	let last = performance.now();
	function tick(now: number) {
		const dt = Math.min((now - last) / 1000, 1 / 20);
		last = now;
		if (!drag) {
			const goal = reduced || hovered ? 0 : direction * DRIFT;
			velocity += (goal - velocity) * Math.min(1, dt * SETTLE);
			offset = wrap(offset + velocity * dt);
			paint();
		}
		if (visible && !document.hidden) frame = requestAnimationFrame(tick);
	}
	function start() {
		cancelAnimationFrame(frame);
		last = performance.now();
		frame = requestAnimationFrame(tick);
	}
	const io = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) start();
	});
	io.observe(node);
	const onVisibility = () => !document.hidden && visible && start();

	node.style.touchAction = 'pan-y';
	node.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
	node.addEventListener('click', onClick, true);
	node.addEventListener('pointerenter', onEnter);
	node.addEventListener('pointerleave', onLeave);
	window.addEventListener('scroll', onScroll, { passive: true });
	document.addEventListener('visibilitychange', onVisibility);
	// Images dragged as files would fight the strip.
	const noDrag = (event: Event) => event.preventDefault();
	node.addEventListener('dragstart', noDrag);
	start();

	return {
		destroy() {
			cancelAnimationFrame(frame);
			resize.disconnect();
			io.disconnect();
			node.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			node.removeEventListener('click', onClick, true);
			node.removeEventListener('pointerenter', onEnter);
			node.removeEventListener('pointerleave', onLeave);
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('visibilitychange', onVisibility);
			node.removeEventListener('dragstart', noDrag);
		}
	};
}
