import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DataTexture,
    DoubleSide,
    MeshStandardMaterial
} from 'three'

import { hash2 } from '../../utils/coords'
import type Terrain from './Terrain'
import type Chunk from './Chunk'

const DIRECTIONS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

const DIRT_EDGE = new Color(0x857555)
const DIRT_CENTER = new Color(0x5f513a)

interface Vertex {
    x: number
    y: number
    z: number
    color: Color
}

// Beaten crossings between neighbouring plateaus. Each shared tile edge is
// hashed once, so both sides generate the same straight line and meet exactly
// at the boundary. The ribbon only covers the sloped border band; it barely
// touches the flat centre.
export default class Trail {
    private static readonly CHANCE = 0.016
    private static readonly LIFT = 0.09
    private static readonly STEPS = 6

    public static buildGeometry(terrain: Terrain, chunk: Chunk): BufferGeometry {
        const positions: number[] = []
        const colors: number[] = []
        const ts = terrain.tileSize

        const push = (vertex: Vertex): void => {
            positions.push(vertex.x - chunk.originX, vertex.y, vertex.z - chunk.originZ)
            colors.push(vertex.color.r, vertex.color.g, vertex.color.b)
        }

        for (const tile of chunk.tiles) {
            for (const [dx, dz] of DIRECTIONS) {
                const nx = tile.x + dx
                const nz = tile.z + dz
                const horizontal = dx !== 0

                // Normalise the pair so both tiles hash the same edge.
                let sx = tile.x
                let sz = tile.z
                if (dx < 0 || dz < 0) {
                    sx = nx
                    sz = nz
                }

                const selectSeed = terrain.seed ^ (horizontal ? 0x9e3779b9 : 0x85ebca77)
                if (hash2(sx, sz, selectSeed) >= Trail.CHANCE) continue

                const variantSeed = terrain.seed ^ (horizontal ? 0x7f4a7c15 : 0x4cf5ad43)
                const width = 1.5 + hash2(sx, sz, variantSeed) * 1.1
                const bandHere = terrain.edgeBand(tile.x, tile.z)
                const bandThere = terrain.edgeBand(nx, nz)
                const band = Math.max(bandHere, bandThere)
                const lateralLimit = Math.max(0, ts * 0.5 - band * 1.35 - width)
                const lateral = (hash2(sx, sz, variantSeed ^ 0x27d4eb2d) * 2 - 1) * lateralLimit

                const reach = bandHere * 0.98
                let start: number
                let boundary: number
                let center: number
                let alongX = horizontal

                if (horizontal) {
                    boundary = dx > 0 ? (tile.x + 1) * ts : tile.x * ts
                    start = dx > 0 ? boundary - reach : boundary + reach
                    center = (tile.z + 0.5) * ts + lateral
                } else {
                    boundary = dz > 0 ? (tile.z + 1) * ts : tile.z * ts
                    start = dz > 0 ? boundary - reach : boundary + reach
                    center = (tile.x + 0.5) * ts + lateral
                }

                const grid: Vertex[][] = []
                for (let i = 0; i <= Trail.STEPS; i++) {
                    const t = i / Trail.STEPS
                    const along = start + (boundary - start) * t
                    const row: Vertex[] = []
                    for (let j = 0; j < 3; j++) {
                        const side = (j - 1) * width * 0.5
                        const wx = alongX ? along : center + side
                        const wz = alongX ? center + side : along
                        row.push({
                            x: wx,
                            y: terrain.heightAtWorld(wx, wz) + Trail.LIFT,
                            z: wz,
                            color: j === 1 ? DIRT_CENTER : DIRT_EDGE,
                        })
                    }
                    grid.push(row)
                }

                for (let i = 0; i < Trail.STEPS; i++) {
                    for (let j = 0; j < 2; j++) {
                        const a = grid[i][j]
                        const b = grid[i + 1][j]
                        const c = grid[i][j + 1]
                        const d = grid[i + 1][j + 1]
                        push(a); push(d); push(b)
                        push(a); push(c); push(d)
                    }
                }
            }
        }

        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()
        return geometry
    }

    // The chunk reveal mask doubles as the trail mask, so a crossing appears
    // exactly when its tile opens and needs no per-tile visibility bookkeeping.
    public static buildMaterial(mask: DataTexture, size: number): MeshStandardMaterial {
        const material = new MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 1,
            metalness: 0,
            side: DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
        })

        material.onBeforeCompile = shader => {
            shader.uniforms.uTrailMask = { value: mask }
            shader.uniforms.uTrailSize = { value: size }

            shader.vertexShader = 'uniform float uTrailSize;\nvarying vec2 vTrailMask;\n' +
                shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\n    vTrailMask = transformed.xz / uTrailSize;'
                )

            shader.fragmentShader = 'uniform sampler2D uTrailMask;\nvarying vec2 vTrailMask;\n' +
                shader.fragmentShader.replace(
                    '#include <opaque_fragment>',
                    'if (texture2D(uTrailMask, vTrailMask).r > 0.5) discard;\n' +
                    '    #include <opaque_fragment>'
                )
        }

        return material
    }
}
