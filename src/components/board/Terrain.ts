import {
    Color,
    MeshStandardMaterial,
    RepeatWrapping,
    SRGBColorSpace,
    Texture,
    TextureLoader
} from 'three'
import { createNoise2D } from 'simplex-noise'

import grassDetailUrl from '../../assets/textures/grass_detail.png'
import mulberry32 from '../../utils/random'
import { hash2 } from '../../utils/coords'
import type Board from './Board'

// A shared, deliberately low-contrast detail map derived from a CC0 grass
// texture. It adds grain without the old blotches overwhelming the tile
// colours underneath.
let sharedDetailTexture: Texture | null = null

function getDetailTexture(): Texture {
    if (!sharedDetailTexture) {
        const texture = new TextureLoader().load(grassDetailUrl)
        texture.colorSpace = SRGBColorSpace
        texture.wrapS = RepeatWrapping
        texture.wrapT = RepeatWrapping
        texture.repeat.set(2, 2)
        texture.anisotropy = 8
        sharedDetailTexture = texture
    }
    return sharedDetailTexture
}

// Terrain exposes one height value per grid corner as a pure function of
// the coordinate. It is procedural, so it works for any coordinate on the
// infinite board. Values are memoised to keep per-frame cost low.
export default class Terrain {
    public board: Board
    public tileSize: number

    // Height range of the mountains.
    public minHeight = 8
    public maxHeight = 210

    public material: MeshStandardMaterial

    public seed: number
    // Each tile is tessellated so its flat centre and edge bands are visible.
    // Six samples keep the added geometry modest while still giving a sloped,
    // non-vertical transition at every edge.
    public subdivisions = 6

    public get sampleStep(): number {
        return this.tileSize / this.subdivisions
    }

    private noise2D: (x: number, y: number) => number
    private noiseScale = 0.03
    private cache = new Map<number, number>()
    private plateauCache = new Map<number, number>()
    private bandCache = new Map<number, number>()
    private static readonly CACHE_LIMIT = 400000

    constructor(board: Board, seed: number = 1337) {
        this.board = board
        this.tileSize = board.tileSize
        this.seed = seed

        this.noise2D = createNoise2D(mulberry32(seed))

        this.material = new MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.95,
            metalness: 0,
            map: getDetailTexture(),
        })
    }

    // Change the seed, giving a completely new landscape.
    public reseed(seed: number): void {
        this.seed = seed
        this.noise2D = createNoise2D(mulberry32(seed))
        this.cache.clear()
        this.plateauCache.clear()
        this.bandCache.clear()
    }

    private key(gx: number, gz: number): number {
        return (gx + 131072) * 262144 + (gz + 131072)
    }

    // Height of a single grid corner. Pure function of the coordinate.
    public heightAt(gx: number, gz: number): number {
        const k = this.key(gx, gz)
        const cached = this.cache.get(k)
        if (cached !== undefined) return cached

        const nx = gx * this.noiseScale
        const nz = gz * this.noiseScale

        // Smooth rolling shape plus sharp ridged peaks.
        const base = this.fbm(nx, nz) * 0.5 + 0.5
        const ridge = this.ridged(nx, nz)
        let t = base * 0.5 + (ridge - 0.3)
        t = Math.max(0, Math.min(1, t))
        // Push the peaks up so the mountains read as tall.
        t = Math.pow(t, 1.3)

        const h = this.minHeight + t * (this.maxHeight - this.minHeight)

        if (this.cache.size > Terrain.CACHE_LIMIT) {
            this.cache.clear()
        }
        this.cache.set(k, h)
        return h
    }

    private fbm(x: number, z: number): number {
        let amplitude = 1
        let frequency = 1
        let sum = 0
        let norm = 0
        for (let octave = 0; octave < 4; octave++) {
            sum += amplitude * this.noise2D(x * frequency, z * frequency)
            norm += amplitude
            amplitude *= 0.5
            frequency *= 2
        }
        return sum / norm
    }

    // Ridged noise: sharp mountain ridges instead of rolling hills.
    private ridged(x: number, z: number): number {
        let amplitude = 1
        let frequency = 1
        let sum = 0
        let norm = 0
        for (let octave = 0; octave < 5; octave++) {
            const n = 1 - Math.abs(this.noise2D(x * frequency + 100, z * frequency - 50))
            sum += amplitude * n * n
            norm += amplitude
            amplitude *= 0.5
            frequency *= 2
        }
        return sum / norm
    }

    // World position of a corner along the X / Z axis.
    // The board is unbounded, so the origin sits at grid coordinate 0.
    public cornerWorldX(x: number): number {
        return x * this.tileSize
    }

    public cornerWorldZ(z: number): number {
        return z * this.tileSize
    }

    // The four corner heights of one tile, in order:
    // a = (x, z), b = (x + 1, z), c = (x, z + 1), d = (x + 1, z + 1).
    public tileCorners(x: number, z: number): { a: number, b: number, c: number, d: number } {
        return {
            a: this.heightAt(x, z),
            b: this.heightAt(x + 1, z),
            c: this.heightAt(x, z + 1),
            d: this.heightAt(x + 1, z + 1),
        }
    }

    // Flat top height of one tile. The deterministic offset breaks up a
    // landscape where every neighbouring plateau would sit at the same level.
    public plateauAt(tx: number, tz: number): number {
        const k = this.key(tx, tz)
        const cached = this.plateauCache.get(k)
        if (cached !== undefined) return cached

        const c = this.tileCorners(tx, tz)
        const jitter = (hash2(tx, tz, this.seed ^ 0x5f356495) - 0.5) * 24
        const h = Math.max(this.minHeight - 4, Math.min(this.maxHeight + 4,
            (c.a + c.b + c.c + c.d) / 4 + jitter))

        if (this.plateauCache.size > Terrain.CACHE_LIMIT) this.plateauCache.clear()
        this.plateauCache.set(k, h)
        return h
    }

    // Width of the sloped edge band as a fraction of one tile. Around 1/9,
    // randomized per tile so the terraces do not look machine-cut.
    private bandAt(tx: number, tz: number): number {
        const k = this.key(tx, tz)
        const cached = this.bandCache.get(k)
        if (cached !== undefined) return cached

        const h = 0.095 + hash2(tx, tz, this.seed ^ 0x27d4eb2d) * 0.06
        if (this.bandCache.size > Terrain.CACHE_LIMIT) this.bandCache.clear()
        this.bandCache.set(k, h)
        return h
    }

    // Height of the original rolling field under any world position. Grid
    // corners keep their exact noise height, while tile edges interpolate
    // between them so neighbouring terraces meet without a seam.
    private baseAtWorld(worldX: number, worldZ: number): number {
        const gx = worldX / this.tileSize
        const gz = worldZ / this.tileSize
        const x0 = Math.floor(gx)
        const z0 = Math.floor(gz)
        const u = gx - x0
        const v = gz - z0

        const top = this.heightAt(x0, z0) * (1 - u) + this.heightAt(x0 + 1, z0) * u
        const bottom = this.heightAt(x0, z0 + 1) * (1 - u) + this.heightAt(x0 + 1, z0 + 1) * u
        return top * (1 - v) + bottom * v
    }

    // Terrace height at an arbitrary point. Meshes sample this on the same
    // sub-grid that heightAtWorld interpolates.
    public terraceHeightAt(worldX: number, worldZ: number): number {
        const gx = worldX / this.tileSize
        const gz = worldZ / this.tileSize
        const tx = Math.floor(gx)
        const tz = Math.floor(gz)
        const u = gx - tx
        const v = gz - tz

        const band = this.bandAt(tx, tz)
        const distance = Math.min(u, 1 - u, v, 1 - v) / band
        const t = Math.max(0, Math.min(1, distance))
        const blend = t * t * (3 - 2 * t)
        const base = this.baseAtWorld(worldX, worldZ)
        return base + (this.plateauAt(tx, tz) - base) * blend
    }

    // Average height of a tile, used to place things on its flat top.
    public surfaceY(x: number, z: number): number {
        return this.plateauAt(x, z)
    }

    // Exact ground height under a world position, matching the tessellated
    // tile triangles. Props and markers use this so they never float.
    public heightAtWorld(worldX: number, worldZ: number): number {
        const step = this.sampleStep
        const sx = Math.floor(worldX / step)
        const sz = Math.floor(worldZ / step)

        const x0 = sx * step
        const z0 = sz * step
        const u = (worldX - x0) / step
        const v = (worldZ - z0) / step

        const ha = this.terraceHeightAt(x0, z0)
        const hb = this.terraceHeightAt(x0 + step, z0)
        const hc = this.terraceHeightAt(x0, z0 + step)
        const hd = this.terraceHeightAt(x0 + step, z0 + step)

        // The tile splits along the a-d diagonal (u === v).
        if (v <= u) {
            return ha * (1 - u) + hb * (u - v) + hd * v
        }
        return ha * (1 - v) + hc * (v - u) + hd * u
    }

    // Width of the sloped border band in world units. Trails live here so they
    // read as worn crossings between two plateaus, never as centre decorations.
    public edgeBand(tx: number, tz: number): number {
        return this.bandAt(tx, tz) * this.tileSize
    }

    // Keep decorations and motifs inside the flat centre of their tile. The
    // margin is in world units and leaves room for the model's footprint.
    public clampToFlat(worldX: number, worldZ: number, margin = 0): { x: number, z: number } {
        const ts = this.tileSize
        const tx = Math.floor(worldX / ts)
        const tz = Math.floor(worldZ / ts)
        const centerX = (tx + 0.5) * ts
        const centerZ = (tz + 0.5) * ts
        const half = Math.max(0, ts * (0.5 - this.bandAt(tx, tz)) - margin)

        return {
            x: Math.max(centerX - half, Math.min(centerX + half, worldX)),
            z: Math.max(centerZ - half, Math.min(centerZ + half, worldZ)),
        }
    }

    // Vivid grass on the lower slopes, rock on steep faces and high peaks.
    public colorFor(avgHeight: number, slope: number): Color {
        const grassLow = new Color(0x2f9e33)
        const grassHigh = new Color(0x8fd14f)
        const rock = new Color(0x8d9199)
        const snow = new Color(0xf4f7fa)

        const heightMix = Math.min(1, Math.max(0, (avgHeight - this.minHeight) / (this.maxHeight - this.minHeight)))
        const color = new Color()
        color.copy(grassLow).lerp(grassHigh, heightMix)

        const slopeRock = Math.min(1, Math.max(0, (slope - 0.9) / 1.2))
        const peakRock = Math.min(1, Math.max(0, (heightMix - 0.55) / 0.35))
        color.lerp(rock, Math.max(slopeRock, peakRock))

        // A touch of snow on the very top.
        const snowMix = heightMix > 0.9 ? (heightMix - 0.9) / 0.1 : 0
        color.lerp(snow, Math.min(1, snowMix) * 0.85)
        return color
    }
}
