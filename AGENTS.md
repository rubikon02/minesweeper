# Project: 3D Minesweeper

Endless 3D Minesweeper built with Three.js, TypeScript, and Vite. The board
is an infinite procedural heightmap split into chunks; only chunks near the
player exist as meshes. Hidden tiles are covered by clouds; opening a tile
fades the cover away. The player walks the terrain in first person and
clicks tiles to open or flag them.

## Commands

- Install: `npm install`
- Dev server: `npm run dev` (port 8080, no auto-open)
- Type check: `npx tsc --noEmit`
- Production build: `npm run build` (`tsc && vite build`)
- Preview build: `npm run preview`

There is no test suite and no linter/formatter config. Do not claim tests
ran. Verify changes with `npx tsc --noEmit` and a manual browser check.

## Tech Stack

- TypeScript 5.8, `strict: true`, ESNext target, bundler resolution
- Three.js 0.186 (`three/examples/jsm` loaders and PointerLockControls)
- Vite 6, assets imported as URLs
- `simplex-noise` for terrain, `mulberry32` for deterministic random

## Architecture

Entry: `src/index.ts` mounts `Game` into `#root`.

- `src/components/Game.ts` — owns scene, camera, renderer, board, horizon,
  player, controller. Owns HUD/score/timer state and the `requestAnimationFrame`
  loop. Constructs the world view. Restart resets board, horizon, and player.
- `src/components/Renderer.ts` — `WebGLRenderer` subclass; sizes to window,
  shadows disabled.
- `src/components/Player.ts` — raycasts the center of the camera against
  `chunkManager.meshList`, converts the hit point to grid coords, tracks
  `tileLookedAt`, toggles crosshair state. Mouse is fixed at screen center.
- `src/components/PlayerController.ts` — `PointerLockControls`. WASD/arrows
  walk, Shift sprints, Space toggles bird's-eye, E/Q raise/lower camera,
  R restarts. Left click opens, right click flags. First click only locks the
  pointer; interactions happen on later clicks. Movement is clamped to
  `board.accessible` unless in bird's-eye mode.
- `src/components/board/Board.ts` — logical state: `opened`, `flagged`,
  `safeZone`, `accessible` sets of packed coords; seed; `tileSize = 35`;
  `bombsDensity = 0.13`; running centroid of opened tiles. `isBomb` is a
  deterministic hash of coords + seed, and is false before the game starts.
  First open marks a 3x3 safe zone and starts the timer. Opening a tile
  dilates `accessible` by `ACCESS_MARGIN`.
- `src/components/board/ChunkManager.ts` — streams `Chunk`s around the
  player's chunk, keeps `CHUNK_RADIUS` chunks in every direction, disposes
  farther ones, owns `meshList` for raycasting.
- `src/components/board/Chunk.ts` — one merged terrain mesh, one merged fog
  mesh with a per-chunk reveal mask (`DataTexture`, 255 hidden / 0 shown),
  one merged marker mesh, and instanced decoration. All geometry is local to
  the chunk origin; the chunk group carries the world offset.
- `src/components/board/Tile.ts` — logical tile only: value, open state,
  flag. Value comes from `Board.isBomb`; markers are registered on the chunk.
  Empty tiles flood-open iteratively.
- `src/components/board/Terrain.ts` — procedural heights. `heightAt` is a
  pure function of grid corner, memoised. `tileCorners`, `surfaceY`,
  `heightAtWorld` (matches rendered triangles), `colorFor` (grass/rock/snow).
- `src/components/board/Decoration.ts` — loads GLB nature models, builds
  `InstancedMesh` props per chunk, hides props on unrevealed tiles. Props
  rebuild after async load via `onReady -> chunkManager.rebuildDecorations()`.
- `src/components/board/Flag.ts` — preloads `flag.obj`/`flag.mtl`, clones per
  tile, hides with chunk disposal, falls back to a primitive pole/cone.
- `src/components/board/Fog.ts` — shared cloud canvas texture.
- `src/components/board/Marker.ts` — procedural low-poly tile markers:
  bloom plants for numbers, seed pods for bombs. `buildMarkerGeometry` is the
  pure seam (entries + height sampler + chunk origin in, merged vertex-colored
  geometry out); all chunks share one flat-shaded `MeshStandardMaterial`.
- `src/components/board/Horizon.ts` — coarse far-terrain mesh from the same
  height function.
- `src/utils/coords.ts` — `CHUNK_SIZE = 16`, `CHUNK_RADIUS = 3`,
  `ACCESS_MARGIN = 3`, `packKey`, `chunkKey`, `hash2`.
- `src/utils/random.ts` — `mulberry32`.
- `src/style.css` + `index.html` — HUD (`#points`, `#minesCount` = cleared
  tiles, `#timeCount`, `#crosshair`, `#popup`) and control legend.

## Coordinates and Units

- Grid tile `(x, z)` occupies world `[x*35, (x+1)*35]` on each axis.
- Tile center: `((x + 0.5) * 35, terrain, (z + 0.5) * 35)`.
- Chunk `(cx, cz)` covers `CHUNK_SIZE` tiles starting at
  `cx * CHUNK_SIZE * 35`.
- Terrain corner heights sit on grid corner `(x, z)`, so adjacent tiles share
  corner values. Keep this invariant when touching terrain or chunk geometry.
- `packKey` supports roughly +/-131072 tiles; `chunkKey` +/-32768 chunks.

## Code Conventions

- One class per file, `export default class Name`. Import types with
  `import type`.
- 4-space indentation. Semicolons are optional and mixed; match the file you
  edit. Single quotes dominate.
- Declare class fields explicitly, usually `public`. Keep `this.board`,
  `this.game` back-references consistent with neighbours.
- Comments explain *why* (coordinate quirks, z-fighting, performance), not
  what. Preserve existing comments.
- Avoid per-tile meshes: batch into chunk-level geometry or `InstancedMesh`.
  Reuse shared materials/textures (terrain, markers, clouds).
- Dispose GPU resources (`geometry`, `material`, `texture`) when removing
  chunks or rebuilding decorations.
- DOM HUD is addressed by element ID directly from `Game`; there is no UI
  framework.

## Known Gotchas

- `Horizon` is constructed and updated in `Game.render`, but its scene add is
  commented out (`Game.ts:91`). It is currently invisible.
- Marker tiles hide decorations; revealed empty tiles re-show props.
  Keep `setDecoVisible` in sync when restoring chunk state.
- `Chunk.restoreState` must re-apply opened/flagged state after a chunk is
  rebuilt; scoring must not run on restore (`restoreOpen`).
- Fog uses polygon offset plus a small lift to beat z-fighting; changing the
  fog material or mesh height can reintroduce artifacts.
- Raycast distance cap is 12000 because E can raise the camera to 4000.
- Asset imports rely on declarations in `src/vite-env.d.ts` and
  `assetsInclude` in `vite.config.ts`. Add both for new extensions.
- Bird's-eye mode frees movement from the accessible-area clamp.

## Boundaries

- Do not commit `node_modules/` or `dist/`.
- Do not add dependencies without a concrete need; the project deliberately
  stays on Three.js + simplex-noise.
- Do not invent a test/lint command that does not exist.
- Ask before changing save/score semantics or the coordinate packing ranges.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to the same label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the root plus `docs/adr/`. See `docs/agents/domain.md`.
