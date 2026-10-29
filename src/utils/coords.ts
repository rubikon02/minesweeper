// Shared constants and helpers for the infinite board.
//
// The world is an endless grid of tiles. Tiles are grouped into square
// chunks so only the chunks near the player are built and drawn.

export const CHUNK_SIZE = 16

// How many chunks to keep charged in every direction around the player.
export const CHUNK_RADIUS = 3

// How far (in tiles) the player may walk past the nearest uncovered tile.
export const ACCESS_MARGIN = 3

// Pack a grid coordinate pair into one integer key.
// Supports coordinates in the range roughly +/- 131072.
export function packKey(x: number, z: number): number {
    return (x + 131072) * 262144 + (z + 131072)
}

// Pack a chunk coordinate pair into one integer key.
export function chunkKey(cx: number, cz: number): number {
    return (cx + 32768) * 65536 + (cz + 32768)
}

export function chunkKeyOfTile(x: number, z: number): number {
    return chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE))
}

// Deterministic value hash for a grid coordinate, in [0, 1).
// Same inputs always give the same value, so terrain and bombs never
// change while the seed is fixed.
export function hash2(x: number, z: number, seed: number): number {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1013904223)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
}
