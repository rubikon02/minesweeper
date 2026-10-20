import {
    Color,
    MeshStandardMaterial,
    CanvasTexture,
    RepeatWrapping,
    SRGBColorSpace,
    Texture
} from 'three'
import { createNoise2D } from 'simplex-noise'

import mulberry32 from '../../utils/random'
import type Board from './Board'

// A shared grain texture so the ground is not a flat colour.
let sharedDetailTexture: Texture | null = null

function createDetailTexture(seed: number): Texture {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const rng = mulberry32(seed)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // Work in a few scales so the ground reads as real grass/dirt:
    // large soft patches, medium blotches, then fine grain.
    const blobs = (count: number, minR: number, maxR: number, maxAlpha: number) => {
        for (let i = 0; i < count; i++) {
            const x = rng() * size
            const y = rng() * size
            const r = minR + rng() * (maxR - minR)
            const dark = rng() < 0.6
            const alpha = maxAlpha * (0.4 + rng() * 0.6)
            ctx.fillStyle = dark
                ? `rgba(20,26,20,${alpha})`
                : `rgba(235,242,230,${alpha})`
            ctx.beginPath()
            ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    blobs(70, 24, 70, 0.18)
    blobs(320, 6, 24, 0.22)
    blobs(2600, 1, 3.5, 0.32)

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(2, 2)
    texture.anisotropy = 8
    texture.needsUpdate = true
    return texture
}

// Terrain builds one height value per grid corner. Neighbouring tiles
// share corners, so their surfaces always meet without gaps or cracks.
export default class Terrain {
    public board: Board
    public width: number
    public height: number
    public tileSize: number

    // Height range of the mountains.
    public minHeight = 8
    public maxHeight = 210

    // Corner heights: cornerHeights[x][z], size (width + 1) x (height + 1).
    public cornerHeights: number[][] = []

    public material: MeshStandardMaterial

    private noise2D: (x: number, y: number) => number
    private noiseScale = 0.03

    constructor(board: Board, seed: number = 1337) {
        this.board = board
        this.width = board.width
        this.height = board.height
        this.tileSize = board.tileSize

        this.noise2D = createNoise2D(mulberry32(seed))

        if (!sharedDetailTexture) {
            sharedDetailTexture = createDetailTexture(seed)
        }

        this.material = new MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.95,
            metalness: 0,
            map: sharedDetailTexture,
        })

        this.buildHeights()
    }

    private buildHeights(): void {
        this.cornerHeights = []
        for (let x = 0; x <= this.width; x++) {
            this.cornerHeights[x] = []
            for (let z = 0; z <= this.height; z++) {
                const nx = x * this.noiseScale
                const nz = z * this.noiseScale

                // Smooth rolling shape plus sharp ridged peaks.
                const base = this.fbm(nx, nz) * 0.5 + 0.5
                const ridge = this.ridged(nx, nz)
                let t = base * 0.5 + (ridge - 0.3)
                t = Math.max(0, Math.min(1, t))
                // Push the peaks up so the mountains read as tall.
                t = Math.pow(t, 1.3)

                this.cornerHeights[x][z] = this.minHeight + t * (this.maxHeight - this.minHeight)
            }
        }
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

    public heightAt(x: number, z: number): number {
        return this.cornerHeights[x][z]
    }

    // World position of a corner along the X / Z axis (board is centred on 0).
    public cornerWorldX(x: number): number {
        return x * this.tileSize - this.width * this.tileSize / 2
    }

    public cornerWorldZ(z: number): number {
        return z * this.tileSize - this.height * this.tileSize / 2
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

    // Average height of a tile, used to place things on its surface.
    public surfaceY(x: number, z: number): number {
        const c = this.tileCorners(x, z)
        return (c.a + c.b + c.c + c.d) / 4
    }

    // Exact ground height under a world position, matching the tile
    // triangles. Used so objects sit on the slope instead of floating.
    public heightAtWorld(worldX: number, worldZ: number): number {
        const gx = (worldX + this.width * this.tileSize / 2) / this.tileSize
        const gz = (worldZ + this.height * this.tileSize / 2) / this.tileSize

        let x0 = Math.floor(gx)
        let z0 = Math.floor(gz)
        x0 = Math.max(0, Math.min(this.width - 1, x0))
        z0 = Math.max(0, Math.min(this.height - 1, z0))

        const u = Math.max(0, Math.min(1, gx - x0))
        const v = Math.max(0, Math.min(1, gz - z0))

        const ha = this.heightAt(x0, z0)
        const hb = this.heightAt(x0 + 1, z0)
        const hc = this.heightAt(x0, z0 + 1)
        const hd = this.heightAt(x0 + 1, z0 + 1)

        // The tile splits along the a-d diagonal (u === v).
        if (v <= u) {
            return ha * (1 - u) + hb * (u - v) + hd * v
        }
        return ha * (1 - v) + hc * (v - u) + hd * u
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
