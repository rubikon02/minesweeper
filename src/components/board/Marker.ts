import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    MeshStandardMaterial,
    Vector3
} from 'three'

import mulberry32 from '../../utils/random'

// A marker is the landscape decoration on a revealed tile: a bloom plant for
// a number, spore litter for a bomb. The bomb's mushroom body is an instanced
// model owned by BombMushroom, so this module only carries the litter.
export interface MarkerEntry {
    value: string | number
    worldX: number
    worldZ: number
}

export type HeightSampler = (worldX: number, worldZ: number) => number

// Canonical Minesweeper number colours. Black and grey are lifted just enough
// to read under 3D lighting; bright blue and bright red stay brighter than
// their navy and maroon neighbours.
const PALETTE: Record<number, number> = {
    1: 0x2f7fff,
    2: 0x2fa63a,
    3: 0xe4443a,
    4: 0x243a8f,
    5: 0x7c2333,
    6: 0x1f8f8f,
    7: 0x34343d,
    8: 0xa9b0ba,
}

const CREAM = new Color(0xf7edc9)
const RIM = new Color(0x241d17)
const STEM = new Color(0x2f6b2a)
const LEAF = new Color(0x3f8a35)

// Spore litter under a bomb mushroom. The ember red keeps the bomb readable
// on snow and dark rock, the same role the old pod seam played.
const EMBER = new Color(0xd0442a)

const UP = new Vector3(0, 1, 0)

// Blooms are the long-range number cue, so make the heads slightly larger than
// the rest of the plant.
const BLOOM_SCALE = 1.6

let material: MeshStandardMaterial | null = null
const colorCache = new Map<number, Color>()

// Shared material for every merged marker mesh, in every chunk.
export function getMarkerMaterial(): MeshStandardMaterial {
    if (!material) {
        material = new MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.88,
            metalness: 0,
            side: DoubleSide,
        })
    }
    return material
}

function paletteColor(value: number): Color {
    const hex = PALETTE[value] ?? PALETTE[1]
    let color = colorCache.get(hex)
    if (!color) {
        color = new Color(hex)
        colorCache.set(hex, color)
    }
    return color
}

function shaded(color: Color, factor: number): Color {
    return color.clone().multiplyScalar(factor)
}

// Collects triangles with a colour per vertex. Kept non-indexed so flat
// shading and vertex colours give each facet its own hard edge.
class MeshBuilder {
    private positions: number[] = []
    private colors: number[] = []

    public tri(a: Vector3, b: Vector3, c: Vector3, color: Color): void {
        this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
        for (let i = 0; i < 3; i++) {
            this.colors.push(color.r, color.g, color.b)
        }
    }

    public quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color): void {
        this.tri(a, b, c, color)
        this.tri(a, c, d, color)
    }

    public build(): BufferGeometry {
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()
        return geometry
    }
}

// Pure marker-geometry seam: tile values in, one merged chunk geometry out.
// Entries carry world positions; the result is local to the chunk origin so
// the chunk group can place it without losing precision far from spawn.
export function buildMarkerGeometry(
    entries: MarkerEntry[],
    sampleHeight: HeightSampler,
    originX: number,
    originZ: number
): BufferGeometry {
    const builder = new MeshBuilder()

    for (const entry of entries) {
        const localX = entry.worldX - originX
        const localZ = entry.worldZ - originZ
        const baseY = sampleHeight(entry.worldX, entry.worldZ)

        if (entry.value === 'bomb') {
            addSporeLitter(builder, localX, localZ, entry.worldX, entry.worldZ, sampleHeight)
            continue
        }

        if (typeof entry.value !== 'number' || entry.value < 1) continue
        const count = Math.min(8, Math.round(entry.value))
        addBloomPlant(builder, count, localX, baseY, localZ, entry.worldX, entry.worldZ, sampleHeight)
    }

    return builder.build()
}

function addBloomPlant(
    builder: MeshBuilder,
    count: number,
    localX: number,
    baseY: number,
    localZ: number,
    worldX: number,
    worldZ: number,
    sampleHeight: HeightSampler
): void {
    const petal = paletteColor(count)
    const base = new Vector3(localX, baseY, localZ)

    addLeaves(builder, base)

    const heads: { center: Vector3, outward: Vector3 }[] = []
    if (count === 1) {
        heads.push({
            center: new Vector3(localX, baseY + 15, localZ),
            outward: new Vector3(),
        })
    } else {
        // One even ring. Spacing keeps the enlarged bloom heads inside the
        // plant footprint without overlapping.
        const spacing = 4 * BLOOM_SCALE
        const radius = spacing / (2 * Math.sin(Math.PI / count))
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / count
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            heads.push({
                center: new Vector3(
                    localX + x,
                    baseY + 13.2 + (i % 2) * 0.3,
                    localZ + z
                ),
                outward: new Vector3(x, 0, z).normalize(),
            })
        }
    }

    const stemRoot = base.clone().add(new Vector3(0, 0.5, 0))
    for (const head of heads) {
        addStem(builder, stemRoot, head.center, STEM)
        addBloomHead(builder, head.center, head.outward, petal)
    }

    addLitter(builder, localX, localZ, worldX, worldZ, sampleHeight, {
        color: shaded(petal, 0.92),
        count: 9,
        innerRadius: 1.8,
        spread: 3.2,
        minSize: 0.5,
        sizeRange: 0.35,
    })
}

// A bloom head is a low-poly disc: a dark rim, six petals and a cream centre.
// It faces upward, tilted 22 degrees away from the middle of the plant.
function addBloomHead(
    builder: MeshBuilder,
    center: Vector3,
    outward: Vector3,
    petal: Color
): void {
    let normal = UP.clone()
    let right = new Vector3(1, 0, 0)
    let forward = new Vector3(0, 0, 1)

    if (outward.lengthSq() > 0) {
        const tilt = (22 * Math.PI) / 180
        normal = UP.clone()
            .multiplyScalar(Math.cos(tilt))
            .addScaledVector(outward, Math.sin(tilt))
            .normalize()
        right = new Vector3().crossVectors(UP, outward).normalize()
        forward = new Vector3().crossVectors(right, normal).normalize()
    }

    const surface = (radius: number, angle: number, lift: number): Vector3 => {
        return center.clone()
            .addScaledVector(right, Math.cos(angle) * radius)
            .addScaledVector(forward, Math.sin(angle) * radius)
            .addScaledVector(normal, lift)
    }

    // Dark disc under the petals, a little wider than the petals so a thin
    // rim stays visible against pale terrain.
    const rimSegments = 10
    const rimRadius = 1.9 * BLOOM_SCALE
    for (let i = 0; i < rimSegments; i++) {
        const a0 = (i * Math.PI * 2) / rimSegments
        const a1 = ((i + 1) * Math.PI * 2) / rimSegments
        builder.tri(center.clone(), surface(rimRadius, a0, 0), surface(rimRadius, a1, 0), RIM)
    }

    const petals = 6
    const half = Math.PI / petals
    const petalLift = 0.045 * BLOOM_SCALE
    for (let i = 0; i < petals; i++) {
        const angle = (i * Math.PI * 2) / petals
        const innerL = surface(0.58 * BLOOM_SCALE, angle - half * 0.5, petalLift)
        const innerR = surface(0.58 * BLOOM_SCALE, angle + half * 0.5, petalLift)
        const outerL = surface(1.5 * BLOOM_SCALE, angle - half * 0.82, petalLift)
        const outerR = surface(1.5 * BLOOM_SCALE, angle + half * 0.82, petalLift)
        const tip = surface(1.78 * BLOOM_SCALE, angle, petalLift)

        builder.tri(innerL, outerL, tip, petal)
        builder.tri(innerL, tip, outerR, petal)
        builder.tri(innerL, outerR, innerR, petal)
    }

    const centerSegments = 8
    const centerLift = 0.1 * BLOOM_SCALE
    for (let i = 0; i < centerSegments; i++) {
        const a0 = (i * Math.PI * 2) / centerSegments
        const a1 = ((i + 1) * Math.PI * 2) / centerSegments
        builder.tri(
            center.clone().addScaledVector(normal, centerLift),
            surface(0.72 * BLOOM_SCALE, a0, centerLift),
            surface(0.72 * BLOOM_SCALE, a1, centerLift),
            CREAM
        )
    }
}

function addStem(builder: MeshBuilder, from: Vector3, to: Vector3, color: Color): void {
    const direction = to.clone().sub(from)
    if (direction.lengthSq() < 0.0001) return
    direction.normalize()

    const hint = Math.abs(direction.y) > 0.9 ? new Vector3(1, 0, 0) : UP
    const side = new Vector3().crossVectors(direction, hint).normalize()
    const side2 = new Vector3().crossVectors(direction, side).normalize()

    const sides = 4
    const bottomRadius = 0.42
    const topRadius = 0.22
    for (let i = 0; i < sides; i++) {
        const a0 = (i * Math.PI * 2) / sides
        const a1 = ((i + 1) * Math.PI * 2) / sides
        const p0 = from.clone()
            .addScaledVector(side, Math.cos(a0) * bottomRadius)
            .addScaledVector(side2, Math.sin(a0) * bottomRadius)
        const p1 = from.clone()
            .addScaledVector(side, Math.cos(a1) * bottomRadius)
            .addScaledVector(side2, Math.sin(a1) * bottomRadius)
        const q0 = to.clone()
            .addScaledVector(side, Math.cos(a0) * topRadius)
            .addScaledVector(side2, Math.sin(a0) * topRadius)
        const q1 = to.clone()
            .addScaledVector(side, Math.cos(a1) * topRadius)
            .addScaledVector(side2, Math.sin(a1) * topRadius)
        builder.quad(p0, p1, q1, q0, color)
    }
}

// A few low-poly blades anchor the plant to the ground.
function addLeaves(builder: MeshBuilder, base: Vector3): void {
    const blades = 5
    for (let i = 0; i < blades; i++) {
        const angle = (i * Math.PI * 2) / blades + 0.35
        const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle))
        const side = new Vector3(-direction.z, 0, direction.x)
        const root = base.clone().addScaledVector(direction, 0.6).add(new Vector3(0, 0.2, 0))
        const mid = root.clone().addScaledVector(direction, 2.2).add(new Vector3(0, 1, 0))
        const tip = root.clone().addScaledVector(direction, 4).add(new Vector3(0, 3.8, 0))
        const width = 0.8

        builder.tri(root, mid.clone().addScaledVector(side, width), tip, LEAF)
        builder.tri(root, tip, mid.clone().addScaledVector(side, -width), LEAF)
    }
}

// One flake of ground debris. Litter is the long-range colour cue for a
// marker, so its vertices are sampled against the terrain and each flake
// follows the slope instead of hovering.
interface LitterOptions {
    color: Color
    count: number
    innerRadius: number
    spread: number
    minSize: number
    sizeRange: number
}

function addLitter(
    builder: MeshBuilder,
    localX: number,
    localZ: number,
    worldX: number,
    worldZ: number,
    sampleHeight: HeightSampler,
    options: LitterOptions
): void {
    const seed = (
        Math.imul(Math.floor(worldX), 73856093) ^
        Math.imul(Math.floor(worldZ), 19349663) ^
        0x9e3779b9
    ) >>> 0
    const rng = mulberry32(seed)

    for (let i = 0; i < options.count; i++) {
        const angle = rng() * Math.PI * 2
        const radius = options.innerRadius + rng() * options.spread
        const px = Math.cos(angle) * radius
        const pz = Math.sin(angle) * radius
        const rotation = rng() * Math.PI * 2
        const size = options.minSize + rng() * options.sizeRange
        const fx = Math.cos(rotation)
        const fz = Math.sin(rotation)
        const rx = -fz
        const rz = fx

        const offsets: [number, number][] = [
            [px + fx * size * 1.5, pz + fz * size * 1.5],
            [px + rx * size, pz + rz * size],
            [px - fx * size * 1.5, pz - fz * size * 1.5],
            [px - rx * size, pz - rz * size],
        ]
        const vertices = offsets.map(([ox, oz]) => new Vector3(
            localX + ox,
            sampleHeight(worldX + ox, worldZ + oz) + 0.18,
            localZ + oz
        ))
        builder.quad(vertices[0], vertices[1], vertices[2], vertices[3], options.color)
    }
}

// Spores around the base of a bomb mushroom. No count is encoded: like petal
// litter, this is a colour cue only.
function addSporeLitter(
    builder: MeshBuilder,
    localX: number,
    localZ: number,
    worldX: number,
    worldZ: number,
    sampleHeight: HeightSampler
): void {
    addLitter(builder, localX, localZ, worldX, worldZ, sampleHeight, {
        color: shaded(EMBER, 0.92),
        count: 8,
        innerRadius: 1.4,
        spread: 4.4,
        minSize: 0.35,
        sizeRange: 0.35,
    })
}
