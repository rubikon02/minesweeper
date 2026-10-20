// Small deterministic pseudo random generator.
// Same seed always produces the same sequence, so terrain and
// decorations look identical until we change the seed.
export default function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return function (): number {
        a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
