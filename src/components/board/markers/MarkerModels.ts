import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Color,
    Matrix4,
    MeshStandardMaterial,
    SRGBColorSpace,
    Vector3
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LoadingManager, Material, Object3D, Texture } from 'three'

import { collectModelParts, prepareNatureModel } from '../InstancedProp'
import type { Part } from '../InstancedProp'
import type { ShapeId } from './MarkerConfig'

import lighthouseUrl from '../../../assets/markers/lighthouse.glb'
import pineUrl from '../../../assets/markers/pine.glb'
import oakUrl from '../../../assets/markers/oak.glb'
import chimneyUrl from '../../../assets/markers/chimney.glb'
import windmillUrl from '../../../assets/markers/windmill.glb'
import towerUrl from '../../../assets/markers/tower.glb'
import siloUrl from '../../../assets/markers/silo.glb'
import villageUrl from '../../../assets/markers/village.glb'
import waterTowerUrl from '../../../assets/markers/waterTower.glb'
import barnUrl from '../../../assets/markers/barn.glb'
import pylonUrl from '../../../assets/markers/pylon.glb'

const MODEL_URLS: Record<Exclude<ShapeId, 'mine'>, string> = {
    lighthouse: lighthouseUrl,
    pine: pineUrl,
    oak: oakUrl,
    chimney: chimneyUrl,
    windmill: windmillUrl,
    tower: towerUrl,
    silo: siloUrl,
    village: villageUrl,
    waterTower: waterTowerUrl,
    barn: barnUrl,
    pylon: pylonUrl,
}

// Same diameters as MarkerCatalog, so the placement layouts stay identical
// to the procedural shapes they replace.
const FOOTPRINTS: Record<Exclude<ShapeId, 'mine'>, number> = {
    lighthouse: 10, pine: 6, oak: 8, chimney: 5, windmill: 16,
    tower: 6, silo: 6, village: 7, waterTower: 8, barn: 8, pylon: 14,
}

// Source models do not share the procedural shapes' proportions. Squashing or
// stretching only Y keeps the tile footprint (and therefore the layout) while
// giving every motif the same silhouette height it had before the swap.
const HEIGHTS: Record<Exclude<ShapeId, 'mine'>, number> = {
    lighthouse: 22, pine: 17, oak: 14, chimney: 22, windmill: 21,
    tower: 20, silo: 18, village: 9, waterTower: 22, barn: 13, pylon: 26,
}

export interface ModelPart {
    geometry: BufferGeometry
    // Per-vertex colours are baked once at load: the marker mesh is a single
    // vertex-coloured batch shared by every chunk, so it cannot use per-model
    // textures. Sampling the embedded texture here keeps the models detailed.
    colors: Float32Array
}

interface SampledTexture {
    data: Uint8ClampedArray
    width: number
    height: number
}

const partsByShape = new Map<ShapeId, ModelPart[]>()
const textureCache = new Map<Texture, SampledTexture | null>()
let ready = false
let pending: Promise<void> | null = null

function sampleTexture(texture: Texture): SampledTexture | null {
    const cached = textureCache.get(texture)
    if (cached !== undefined) return cached

    let result: SampledTexture | null = null
    const image = texture.image as CanvasImageSource & { width?: number, height?: number }
    const width = image?.width ?? 0
    const height = image?.height ?? 0
    if (width > 0 && height > 0) {
        try {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (ctx) {
                ctx.drawImage(image, 0, 0, width, height)
                result = { data: ctx.getImageData(0, 0, width, height).data, width, height }
            }
        } catch {
            // A tainted image simply falls back to the material colour.
        }
    }
    textureCache.set(texture, result)
    return result
}

function materialAt(part: Part, vertexIndex: number): Material | null {
    const materials = Array.isArray(part.material) ? part.material : [part.material]
    if (materials.length === 1) return materials[0]
    for (const group of part.geometry.groups) {
        if (vertexIndex >= group.start && vertexIndex < group.start + group.count) {
            return materials[group.materialIndex ?? 0] ?? materials[0]
        }
    }
    return materials[0] ?? null
}

function bakeColors(part: Part, geometry: BufferGeometry): Float32Array {
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    const colors = new Float32Array(position.count * 3)
    const fallback = new Color(0xcccccc)
    const texel = new Color()
    const base = new Color()

    for (let i = 0; i < position.count; i++) {
        const material = materialAt(part, i)
        const std = material as MeshStandardMaterial | null
        base.copy(std?.color ?? fallback)
        if (std?.vertexColors && geometry.getAttribute('color')) {
            const attribute = geometry.getAttribute('color')
            base.r *= attribute.getX(i)
            base.g *= attribute.getY(i)
            base.b *= attribute.getZ(i)
        }

        const texture = std?.map
        const sampled = texture ? sampleTexture(texture) : null
        if (sampled && uv) {
            // glTF stores UV (0,0) at the top-left of the image, which is also
            // the origin of the 2D canvas used above.
            const u = uv.getX(i) - Math.floor(uv.getX(i))
            const v = uv.getY(i) - Math.floor(uv.getY(i))
            const px = Math.min(sampled.width - 1, Math.max(0, Math.floor(u * sampled.width)))
            const py = Math.min(sampled.height - 1, Math.max(0, Math.floor(v * sampled.height)))
            const offset = (py * sampled.width + px) * 4
            texel.setRGB(
                sampled.data[offset] / 255,
                sampled.data[offset + 1] / 255,
                sampled.data[offset + 2] / 255,
                SRGBColorSpace
            )
            base.multiply(texel)
        }

        colors[i * 3] = base.r
        colors[i * 3 + 1] = base.g
        colors[i * 3 + 2] = base.b
    }
    return colors
}

function registerParts(id: Exclude<ShapeId, 'mine'>, object: Object3D): void {
    const source = collectModelParts(object)
    if (source.length === 0) return

    const box = new Box3()
    for (const part of source) {
        part.geometry.computeBoundingBox()
        if (part.geometry.boundingBox) {
            box.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrix))
        }
    }
    if (box.isEmpty()) return

    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const planarScale = FOOTPRINTS[id] / Math.max(size.x, size.z, 0.001)
    const heightScale = HEIGHTS[id] / Math.max(size.y, 0.001)

    // Sit the model on y=0 and centre it on X/Z, matching the procedural
    // symbol convention used by placeSymbols(). Only Y is scaled separately.
    const normalize = new Matrix4()
        .makeScale(planarScale, heightScale, planarScale)
        .multiply(new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z))

    const parts: ModelPart[] = []
    for (const part of source) {
        const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()
        geometry.applyMatrix4(normalize.clone().multiply(part.matrix))
        const colors = bakeColors(part, geometry)
        // The shared material has vertexColors enabled. Without this attribute
        // WebGL supplies (0,0,0) and every model renders pure black.
        geometry.setAttribute('color', new BufferAttribute(colors, 3))
        parts.push({ geometry, colors })
    }
    partsByShape.set(id, parts)
}

export default class MarkerModels {
    // Loaded once per page. Chunks redraw afterwards so tiles opened early do
    // not keep the procedural fallback geometry.
    public static load(manager: LoadingManager): Promise<void> {
        if (ready) return Promise.resolve()
        if (pending) return pending
        const ids = Object.keys(MODEL_URLS) as Exclude<ShapeId, 'mine'>[]
        const loader = new GLTFLoader(manager)
        pending = new Promise<void>(resolve => {
            let remaining = ids.length
            const finish = (): void => {
                remaining--
                if (remaining === 0) {
                    ready = true
                    resolve()
                }
            }

            for (const id of ids) {
                loader.load(
                    MODEL_URLS[id],
                    gltf => {
                        prepareNatureModel(gltf.scene)
                        registerParts(id, gltf.scene)
                        finish()
                    },
                    undefined,
                    err => {
                        console.warn(`Marker model failed to load: ${id}`, err)
                        finish()
                    }
                )
            }
        })
        return pending
    }

    public static isReady(): boolean {
        return ready
    }

    public static getParts(id: ShapeId): ModelPart[] | null {
        return partsByShape.get(id) ?? null
    }
}
