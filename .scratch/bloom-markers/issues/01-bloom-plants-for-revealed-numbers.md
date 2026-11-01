# 01: Bloom plants for revealed numbers

**What to build:** A revealed safe number tile shows a low-poly bloom plant instead of the flat atlas number. The plant carries one bloom per adjacent bomb (1–8) in the canonical Minesweeper color, with a pale cream center and thin dark rim. Counts 2–8 sit evenly on one ring whose radius grows to keep blooms from overlapping; count 1 is a single centered bloom. Bloom heads face upward with a slight outward tilt. The plant is roughly 16 world units tall and 14 wide, sits on the terrain height at the tile center, is static, and merges into one mesh and one draw call per chunk. Decorative props stay hidden on marker tiles. Markers appear only after fog clears, restore when a chunk is rebuilt, clear on restart, and never appear in the player raycast. Icon terminology in the tile and chunk hooks becomes marker terminology.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A revealed tile with value 1 shows exactly one bloom; values 2–8 show exactly that many blooms on one evenly spaced ring.
- [ ] Ring radius grows with count so blooms do not overlap at 8.
- [ ] Every bloom uses the canonical color for its value: 1 blue, 2 green, 3 red, 4 navy, 5 maroon, 6 teal, 7 black, 8 gray, with a readability lift for black and gray.
- [ ] Each bloom has a pale cream center and thin dark rim encoded in vertex colors.
- [ ] Bloom heads face upward with a 20–25 degree outward tilt.
- [ ] The plant base sits on the terrain height at the tile center.
- [ ] All markers in a chunk render through one merged vertex-colored mesh with flat shading and one shared standard material.
- [ ] The marker mesh is excluded from the player raycast.
- [ ] Marker tiles keep their props hidden.
- [ ] Markers appear only after fog clears.
- [ ] Markers restore when a chunk is rebuilt and are cleared on restart.
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] Manual browser check confirms counts 1–8, all colors, and readability of 7 and 8 on dark and light terrain.
