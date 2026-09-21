# Drop countdown media

The Explore the Drop page uses the existing forest growth sequence, enhanced with Higgsfield's Bytedance Video Upscale (Pro, AIGC preset, 4K, 24 fps). The enhancement retains the original composition, elements, chapter timing, and 193 frames.

- Original: `static/video/rootwear-tree-growth.mp4` (1488 × 620).
- Enhanced master: 5184 × 2160, 8.041667 seconds.
- Higgsfield job: `2998e593-b908-483e-8078-9576d406b707`.
- [Download enhanced master](https://d8j0ntlcm91z4.cloudfront.net/user_33HQyj26qPkCknghFTJaxRkNXQ6/hf_20260919_150729_2998e593-b908-483e-8078-9576d406b707.mp4).

To regenerate the web assets, download the master and run:

```sh
node scripts/prepare-drop-media.mjs /absolute/path/to/enhanced-growth.mp4
```

Requires Node.js 22.18+ with TypeScript stripping, FFmpeg/FFprobe with libx264, and cwebp. This produces seven stills at 960, 1920, and 3840 pixels wide, plus six 3840 × 1600 growth clips. Each clip includes its final stage frame, matching the corresponding still, and plays once at half speed. Visitors load only their current chapter; reduced-motion visitors see the current still without downloading video.

The campaign dates and stage names remain in `src/lib/drop-timeline.ts`. The responsive image sizes account for the scene's cover crop so high-density screens receive enough pixels.
