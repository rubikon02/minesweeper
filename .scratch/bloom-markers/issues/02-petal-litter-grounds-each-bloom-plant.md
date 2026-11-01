# 02: Petal litter grounds each bloom plant

**What to build:** Each bloom plant gets fallen petals scattered around its base in the same canonical color as the plant. Litter spans roughly 10 world units, follows the terrain slope through height samples so petals do not clip into hills or hover over valleys, and acts as a color cue only — it never encodes a count. Empty tiles and bomb markers get no litter.

**Blocked by:** 01 (Bloom plants for revealed numbers)

**Status:** ready-for-agent

- [ ] Every bloom marker has petal litter around its base; empty tiles and bomb markers have none.
- [ ] Litter uses the same canonical color as its marker.
- [ ] Litter follows the terrain slope and does not float or clip.
- [ ] Litter spans roughly 10 world units and does not encode a count.
- [ ] Litter renders inside the existing merged marker mesh with no extra draw call per tile.
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] Manual browser check confirms litter at distance and on sloped terrain.
