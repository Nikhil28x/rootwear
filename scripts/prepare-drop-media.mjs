// Regenerate the responsive stills and individual growth chapters from the enhanced master.
// Usage: node scripts/prepare-drop-media.mjs /absolute/path/to/enhanced-growth.mp4
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROWTH_STAGES } from '../src/lib/drop-timeline.ts';

const source = process.argv[2];
if (!source) throw new Error('Pass the path to the Higgsfield-enhanced growth master.');
const root = fileURLToPath(new URL('..', import.meta.url));
const imageDir = resolve(root, 'static/images/drop-growth/hd');
const videoDir = resolve(root, 'static/video/drop-growth/hd');
mkdirSync(imageDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });
const probe = JSON.parse(
	execFileSync(
		'ffprobe',
		[
			'-v',
			'error',
			'-select_streams',
			'v:0',
			'-show_entries',
			'stream=nb_frames,r_frame_rate,width,height',
			'-of',
			'json',
			source
		],
		{ encoding: 'utf8' }
	)
).streams[0];
const [numerator, denominator] = probe.r_frame_rate.split('/').map(Number);
const fps = numerator / denominator;
if (fps !== 24) throw new Error('The growth calendar expects the original 24 fps timing.');
if (probe.width < 3840) throw new Error('Use the enhanced master at 3840 pixels wide or greater.');
const lastFrame = Number(probe.nb_frames) - 1;
if (!Number.isFinite(lastFrame) || lastFrame < 191)
	throw new Error('The complete eight-second growth sequence is required.');
const ffmpeg = (args) =>
	execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
		stdio: 'inherit'
	});

for (let stage = 0; stage < GROWTH_STAGES.length; stage++) {
	// Preserve the original campaign's 32-frame chapter boundaries (including the final frame).
	const frame = Math.min(stage * 32, lastFrame);
	const temp = mkdtempSync(resolve(tmpdir(), 'rootwear-frame-'));
	try {
		ffmpeg([
			'-ss',
			String(frame / fps),
			'-i',
			source,
			'-frames:v',
			'1',
			resolve(temp, 'frame.png')
		]);
		for (const width of [960, 1920, 3840]) {
			execFileSync('cwebp', [
				'-quiet',
				'-q',
				'88',
				'-m',
				'6',
				'-resize',
				String(width),
				'0',
				resolve(temp, 'frame.png'),
				'-o',
				resolve(imageDir, `stage-${stage}-${width}.webp`)
			]);
		}
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
	if (stage > 0) {
		const firstFrame = (stage - 1) * 32;
		ffmpeg([
			'-ss',
			String(firstFrame / fps),
			'-i',
			source,
			'-frames:v',
			String(frame - firstFrame + 1),
			'-vf',
			'scale=3840:-2:flags=lanczos',
			'-an',
			'-c:v',
			'libx264',
			'-preset',
			'slow',
			'-crf',
			'20',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			'-map_metadata',
			'-1',
			resolve(videoDir, `stage-${stage}.mp4`)
		]);
	}
	console.log(`Prepared stage ${stage + 1}/${GROWTH_STAGES.length}: ${GROWTH_STAGES[stage].label}`);
}
