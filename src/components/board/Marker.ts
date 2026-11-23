import {
    BufferGeometry, Color, DoubleSide, Matrix4, MeshStandardMaterial,
    Quaternion, Vector3
} from 'three'

import MeshBuilder from './markers/MeshBuilder'
import { getShape } from './markers/MarkerCatalog'
import MarkerModels from './markers/MarkerModels'
import { buildPalette, groundColorAt as sampleGroundColor } from './markers/colorways'
import { hashString, placeSymbols } from './markers/placement'
import mulberry32 from '../../utils/random'
import { defaultCount } from './markers/MarkerConfig'
import type { MarkerConfig, MarkerValue } from './markers/MarkerConfig'
import type Terrain from './Terrain'

// The merged fog marker for a revealed tile: a number is encoded by how many
// copies of its motif stand on the tile, a bomb by one oversized mine.
export interface MarkerEntry {
    value: string | number
    worldX: number
    worldZ: number
}

export interface MarkerEnvironment {
    heightAt(worldX: number, worldZ: number): number
    groundColorAt(worldX: number, worldZ: number): Color
    clampToFlat(worldX: number, worldZ: number, margin: number): { x: number, z: number }
}

// Kept as a pure seam: geometry in, chunk-local geometry out. The environment
// hides the terrain instance so this module never reaches into the scene.
export function createMarkerEnvironment(terrain: Terrain, tileSize: number): MarkerEnvironment {
    return {
        heightAt: (x, z) => terrain.heightAtWorld(x, z),
        groundColorAt: (x, z) => sampleGroundColor(terrain, x, z, tileSize),
        clampToFlat: (x, z, margin) => terrain.clampToFlat(x, z, margin),
    }
}

let material: MeshStandardMaterial | null = null

// Shared by every merged marker mesh in every chunk.
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

function markerValue(raw: string | number): MarkerValue | null {
    if (raw === 'bomb') return 'bomb'
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return null
    return Math.min(8, Math.max(1, Math.round(raw))) as MarkerValue
}

export interface MarkerBatch {
    geometry: BufferGeometry
    matrices: Matrix4[]
}

export interface MarkerPlan {
    batches: MarkerBatch[]
    fallback: MarkerEntry[]
}

const upAxis = new Vector3(0, 1, 0)

// Loaded models are instanced per chunk. Repeating the same geometry eight
// times per tile would otherwise copy tens of thousands of vertices into the
// merged mesh for a single marker.
export function planMarkers(
    entries: MarkerEntry[],
    environment: MarkerEnvironment,
    originX: number,
    originZ: number,
    config: MarkerConfig
): MarkerPlan {
    const batches = new Map<string, MarkerBatch>()
    const fallback: MarkerEntry[] = []
    const position = new Vector3()
    const quaternion = new Quaternion()
    const scaleVector = new Vector3()
    const yaw = new Quaternion()

    for (const entry of entries) {
        const value = markerValue(entry.value)
        if (value === null) continue
        const selection = config.perValue[value]
        if (!selection) continue
        const shape = getShape(selection.shape)
        const parts = MarkerModels.getParts(selection.shape)
        if (!parts || parts.length === 0) {
            fallback.push(entry)
            continue
        }

        const count = defaultCount(value)
        const rng = mulberry32(hashString(
            `${Math.round(entry.worldX)}:${Math.round(entry.worldZ)}:${value}:${selection.shape}`
        ))
        const placed = placeSymbols(count, shape.placement, shape.footprint, rng)
        const aligned = shape.id === 'village' || shape.id === 'barn'

        for (const symbol of placed) {
            const rawX = entry.worldX + symbol.x
            const rawZ = entry.worldZ + symbol.z
            // Every motif stands on the flat centre, not on a sloped edge.
            const margin = shape.footprint * symbol.scale * 0.5
            const { x: worldX, z: worldZ } = environment.clampToFlat(rawX, rawZ, margin)
            const baseY = environment.heightAt(worldX, worldZ)
            // Consume the same random values as the procedural path so a
            // fallback and a loaded model keep identical layouts.
            rng()
            const rotation = aligned ? 0 : symbol.rotation + (rng() - 0.5) * 0.3
            const scale = symbol.scale * (value === 'bomb' ? 1.6 : 1)

            yaw.setFromAxisAngle(upAxis, rotation)

            position.set(worldX - originX, baseY - 0.8, worldZ - originZ)
            quaternion.copy(yaw)
            scaleVector.setScalar(scale)

            for (let i = 0; i < parts.length; i++) {
                const key = `${selection.shape}:${i}`
                let batch = batches.get(key)
                if (!batch) {
                    batch = { geometry: parts[i].geometry, matrices: [] }
                    batches.set(key, batch)
                }
                batch.matrices.push(new Matrix4().compose(position, quaternion, scaleVector))
            }
        }
    }

    return { batches: Array.from(batches.values()), fallback }
}

export function buildMarkerGeometry(
    entries: MarkerEntry[],
    environment: MarkerEnvironment,
    originX: number,
    originZ: number,
    config: MarkerConfig
): BufferGeometry {
    const builder = new MeshBuilder()

    for (const entry of entries) {
        const value = markerValue(entry.value)
        if (value === null) continue

        const selection = config.perValue[value]
        if (!selection) continue
        const shape = getShape(selection.shape)
        // The count follows the tile value; it is not a separate setting.
        const count = defaultCount(value)

        const rng = mulberry32(hashString(
            `${Math.round(entry.worldX)}:${Math.round(entry.worldZ)}:${value}:${selection.shape}`
        ))
        const placed = placeSymbols(count, shape.placement, shape.footprint, rng)

        for (const symbol of placed) {
            const rawX = entry.worldX + symbol.x
            const rawZ = entry.worldZ + symbol.z
            const margin = shape.footprint * symbol.scale * 0.5
            const clamped = environment.clampToFlat(rawX, rawZ, margin)
            const worldX = clamped.x
            const worldZ = clamped.z
            const baseY = environment.heightAt(worldX, worldZ)
            const palette = buildPalette(
                'classic',
                value,
                environment.groundColorAt(worldX, worldZ),
                (rng() - 0.5) * 0.08
            )
            // Buildings stay on a shared grid; organic motifs get a seeded spin.
            const aligned = shape.id === 'village' || shape.id === 'barn'
            const rotation = aligned ? 0 : symbol.rotation + (rng() - 0.5) * 0.3
            const scale = symbol.scale * (value === 'bomb' ? 1.6 : 1)

            shape.build({
                builder,
                center: new Vector3(
                    worldX - originX,
                    baseY,
                    worldZ - originZ
                ),
                worldX,
                worldZ,
                count,
                rotation,
                scale,
                palette,
                rng,
                groundOffset: (dx, dz) => environment.heightAt(worldX + dx, worldZ + dz) - baseY,
            })
        }
    }

    return builder.build()
}
