# 03: Bomb seed pods at game over

**What to build:** A revealed bomb tile shows a dark spiky seed pod with a decorative ember-red seam instead of the flat atlas bomb icon. Pods appear only through the existing end-of-game bomb reveal, never before the game ends. They use the same footprint class as a bloom plant, sit slightly taller, carry no blooms and no distance cue, and stay outside the player raycast.

**Blocked by:** 01 (Bloom plants for revealed numbers)

**Status:** ready-for-agent

- [ ] A bomb tile revealed at game over shows a dark spiky pod with an ember-red seam.
- [ ] No pod appears before the end-of-game reveal.
- [ ] A pod shows no blooms and no distance cue.
- [ ] Pods render inside the existing merged marker mesh with the shared material.
- [ ] Pods sit on the terrain and are excluded from the player raycast.
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] Manual browser check confirms pods only appear on game over and remain distinct from flags.
