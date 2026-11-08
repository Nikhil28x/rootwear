# Hero tee model

The drop page's hero shows the tee as a real 3D garment (`src/lib/components/product/TeeHero.svelte`, `tee3d/`).

## Assets

- `static/models/tee-hi.glb`: about 54k triangles, about 385 KB. Desktops and most phones get this one.
- `static/models/tee-low.glb`: about 10k triangles, about 85 KB. Low-power devices get this one.
- `static/images/drop-01/tee-front-*.webp` and `tee-back-*.webp`: the studio T-pose shots, cropped to one shared box so front and back stay registered. These are also the fallback when 3D is unavailable.
- `static/images/drop-01/tee-poster-{1600,800}.webp`: the 3D scene's own first frame. It shows while three.js loads, so the swap to the live canvas can't be seen.

The mesh is the free CGTrader oversized T-shirt (`Hi_T-shirt.obj` / `Low_T-shirt.obj`, a Marvelous Designer export). Its only baked data is in `COLOR_0`: ambient occlusion, and which edges are real openings. At runtime the cloth colour, the knit relief, the collar rib colour and the embroidery are all read from the two photographs.

## Regenerating the GLBs

`scripts/prepare-tee-model.mjs` turns an OBJ into a GLB. It does eight things:

- splits the mesh into `body`, `collar` and `label` primitives;
- centres it and scales it to unit height;
- recomputes normals from the triangles, smooth across sewn seams;
- bakes ambient occlusion per vertex (red channel of `COLOR_0`), ignoring hits nearer than about 4 mm so stacked seam layers don't print as dark lines, then smooths it;
- flags the real openings (hem, cuffs, neck) in the green channel of `COLOR_0`, so the runtime only builds the cut-edge rim there and not on seam allowances tucked under the cloth;
- welds it;
- quantises it;
- compresses it with meshopt.

The script needs `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `meshoptimizer` and `three-mesh-bvh` (with `three`). These are not project dependencies. Install them beside a copy of the script, for example in a scratch folder:

```sh
npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer@0.22 three-mesh-bvh@0.9
node prepare-tee-model.mjs <repo>/node_modules/three Hi_T-shirt.obj <repo>/static/models/tee-hi.glb
node prepare-tee-model.mjs <repo>/node_modules/three Low_T-shirt.obj <repo>/static/models/tee-low.glb
```

## Regenerating the poster

Re-run this whenever the model, the photographs, the lighting or the shading change. If you don't, the poster and the first live frame stop matching and the swap becomes visible.

`scripts/make-tee-poster.mjs` opens the page in dev with `?tee-poster`. The scene holds still on its first frame, and the script saves that frame. It needs `playwright-core` and `sharp` installed beside a copy of the script, and Microsoft Edge (or set `CHANNEL=chrome`):

```sh
npm i playwright-core sharp
node make-tee-poster.mjs http://localhost:5173/drops/01-pineapple-haze/tee <repo>/static/images/drop-01
```

## Adding the shots for another piece

Add an entry to `src/lib/drop/tee-shots.ts`. A product without an entry keeps the single-photo cloth hero.
