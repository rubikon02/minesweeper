# Bloom markers

Status: ready-for-agent

## Problem Statement

Revealed number tiles currently show flat, texture-atlas numbers. They read as UI stickers pasted onto the terrain, not as part of the landscape. The player wants the bomb count to remain immediately readable while the board feels like a natural world.

## Solution

Replace each revealed safe number tile with a low-poly bloom plant. The plant carries one bloom per adjacent bomb, all in the canonical Minesweeper number color. A revealed bomb tile becomes a dark spiky seed pod only when the game ends. Petal litter around the plant carries the canonical color at longer range, so the player can identify numbers across the board without a second count symbol.

## User Stories

1. As a player, I want a revealed safe tile to show a plant instead of a flat number, so that the board feels like part of the landscape.
2. As a player, I want the plant to carry one bloom per adjacent bomb, so that I can count the danger directly.
3. As a player, I want a tile with one adjacent bomb to show one bloom, so that the count is unambiguous.
4. As a player, I want a tile with eight adjacent bombs to show eight blooms, so that the maximum count stays readable.
5. As a player, I want every bloom on one plant to share the canonical number color, so that color confirms the count.
6. As a player, I want the canonical palette preserved, so that my existing Minesweeper color reflexes transfer.
7. As a player, I want one to be blue, two green, three red, four navy, five maroon, six teal, seven black, and eight gray.
8. As a player, I want seven and eight to remain visible on dark terrain, snow, and bright grass.
9. As a player, I want every bloom to have a pale cream center, so that adjacent blooms remain countable.
10. As a player, I want every bloom to have a thin dark rim, so that pale petals separate from pale terrain.
11. As a player, I want the blooms to sit on one plant, so that the marker reads as a single object rather than scattered clutter.
12. As a player, I want one bloom at the center for a count of one, so that the smallest marker is simple.
13. As a player, I want counts two through eight arranged on one even ring, so that counting is deterministic.
14. As a player, I want the ring to widen as the count grows, so that eight blooms do not overlap.
15. As a player, I want the blooms to face upward with a slight outward tilt, so that I can count them from eye level and from above.
16. As a player, I want the plant sized to the tile, so that it is visible from several tiles away without covering the board.
17. As a player, I want the marker to be static, so that motion does not compete with the clouds and terrain.
18. As a player, I want fallen petals around the base of a bloom plant, so that the marker blends into the ground.
19. As a player, I want the fallen petals to use the same canonical color, so that I can identify the number at longer range.
20. As a player, I want petal litter to be a color cue only, so that it does not create a second count to read.
21. As a player, I want an empty tile to have no marker, so that safe ground stays clean.
22. As a player, I want a revealed bomb to show a dark spiky seed pod, so that bombs are visually distinct from bloom markers.
23. As a player, I want bomb pods to appear only when the game ends, so that the decoration does not reveal hidden bombs early.
24. As a player, I want bomb pods to have no distance cue, so that they remain end-of-game decoration rather than a gameplay warning.
25. As a player, I want bomb pods to keep a decorative ember-red seam, so that they read against dark terrain.
26. As a player, I want decorative red flowers removed from random world scatter, so that scenery cannot be mistaken for a count marker.
27. As a player, I want decorative props hidden under marker tiles, so that grass and bushes cannot obscure the plant or pod.
28. As a player, I want markers to appear only after the fog is cleared, so that hidden tiles reveal nothing early.
29. As a player, I want markers restored when a chunk is rebuilt, so that walking away and back does not erase board state.
30. As a player, I want markers cleared on restart, so that a new board starts clean.
31. As a player, I want no numbers on the board and no crosshair number, so that the landscape stays free of UI text.
32. As a player, I want the bloom count to remain the primary signal, so that color is redundant rather than required.
33. As a player, I want bloom markers readable at roughly one to three tiles, so that normal play does not require walking up to every tile.
34. As a player, I want canonical color readable across the visible board, so that I can plan a route without counting every distant bloom.
35. As a player, I want marker tiles to keep their existing scoring and open state, so that the visual change does not alter the game rules.
36. As a player, I want marker tiles to keep their existing coordinate behavior, so that chunk streaming and clicking remain correct.
37. As a player, I want marker tiles to keep their existing flag behavior, so that flags and markers do not conflict.
38. As a player, I want markers to settle on the terrain rather than float above it, so that the board remains believable.
39. As a player, I want petal litter to follow the terrain slope, so that petals do not clip into hills or hover over valleys.
40. As a player, I want the marker system to stay performant while chunks stream, so that walking does not stutter.
41. As a player, I want the existing game-over bomb reveal to keep working, so that bomb pods appear on the same tiles as before.
42. As a player, I want the marker to be one draw call per chunk, so that the endless board does not accumulate per-tile meshes.
43. As a player, I want flags to remain visually separate from bloom plants, so that flagging an unopened tile is unchanged.
44. As a player, I want the board to remain readable in first-person view, so that I do not need bird's-eye mode to count bombs.

## Implementation Decisions

- Replace the flat texture-atlas icon path with procedural low-poly marker geometry.
- Introduce a marker module that builds bloom plants and bomb pods as vertex-colored geometry.
- Expose one pure marker-geometry builder as the testing seam: tile value, world position, and terrain-height sampler in; merged vertex data or geometry out.
- Use a shared `MeshStandardMaterial` with vertex colors and flat shading for all markers.
- Merge all markers in a chunk into one mesh and one draw call.
- Store marker entries by tile value and world position; rebuild the merged marker geometry when a chunk's markers change.
- Place the plant base on the terrain height at the tile center so it does not float.
- Build petal litter from terrain-height samples so petals sit on slopes.
- Bloom plant dimensions: roughly 16 world units tall and 14 world units wide, with bloom heads 3–4 units across.
- Bloom layout: one bloom at the center for count one; counts two through eight evenly spaced on one ring; ring radius grows so bloom spacing stays roughly 3.5–4 units.
- Bloom heads face upward with a 20–25 degree outward tilt.
- Petals use the canonical palette, with a readability lift for black and gray. One and three stay brighter than four and five.
- Blooms have a pale cream center and a thin dark rim encoded in vertex colors.
- Petal litter uses the same canonical color, spans roughly 10 units, and does not encode a count.
- Bomb pod: near-black spiky pod with a decorative ember-red seam, same footprint class as the plant, slightly taller. No scorched patch, no distance cue.
- Bomb pods appear only through the existing end-of-game bomb reveal.
- Remove the decorative red flower model from random world decoration.
- Keep decorative props hidden on every revealed marker tile.
- Rename tile marker hooks from icon terminology to marker terminology.
- Keep markers out of the player raycast.
- Dispose marker geometry with its chunk; dispose the shared material only when appropriate for the shared resource.
- No animation.
- No numeric fallback on the board or crosshair.
- No changes to board state, scoring, timer, save state, bomb density, or coordinate packing.

## Testing Decisions

- No automated tests. The project has no test runner, and the project instructions explicitly say not to invent one.
- Good tests would check external behavior at the marker-geometry seam, not internal helper structure.
- If a test runner is added later, the highest practical seam is the pure marker-geometry builder.
- Useful future assertions: values one through eight produce that many bloom heads, the canonical color is present, a bomb produces a pod and no blooms, petal litter appears only for bloom markers, and empty tiles produce no geometry.
- There is no prior art for automated tests in this repository.
- Verification for this change is manual browser checking plus `npx tsc --noEmit` and `npm run build`.
- Manual checks must cover counts one through eight, all canonical colors, seven and eight on dark and light terrain, petal litter at distance, bomb pods only at game over, no props under markers, chunk rebuild restoration, restart clearing, terrain-slope placement, and streaming performance.

## Out of Scope

- Exact bloom count readable across the whole board.
- LOD or billboard markers at distance.
- Marker animation.
- Numeric fallback on the crosshair or HUD.
- A new test framework or automated visual tests.
- Changes to save, score, timer, bomb density, or coordinate packing semantics.
- Mobile or touch-specific marker behavior.
- Accessibility settings beyond the count-plus-color redundancy.
- Changes to flags, fog, chunk radius, or camera controls.

## Further Notes

- The old icon atlas image becomes unused after this change. It can be removed separately once the new marker path is proven.
- No ADR is proposed. The change is visual and reversible, and the domain terms are captured in `GLOSSARY.md`.
- Manual browser verification is required because the repository has no browser automation and no test suite.
