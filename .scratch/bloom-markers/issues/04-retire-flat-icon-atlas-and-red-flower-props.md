# 04: Retire flat icon atlas and red-flower props

**What to build:** Once bloom plants and bomb pods are proven, remove the obsolete flat icon path: the icon atlas module, its asset, and every remaining import or hook. Remove the red flower model from random world decoration so scenery can never be mistaken for a count marker. The board keeps rendering blooms and pods exactly as before, with no leftover icon terminology or unused asset.

**Blocked by:** 01 (Bloom plants for revealed numbers), 03 (Bomb seed pods at game over)

**Status:** ready-for-agent

- [ ] The icon atlas module, the `tiles.png` asset, and all remaining icon imports are gone.
- [ ] The red flower model is removed from random world decoration.
- [ ] No unused icon terminology or dead marker code remains.
- [ ] Reopened and restored tiles still show blooms and pods correctly.
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] Manual browser check confirms no red flower props scatter and no visual regressions.
