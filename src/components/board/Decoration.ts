import {
    Mesh,
    MeshStandardMaterial,
    Object3D,
    InstancedMesh,
    Vector3
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import mulberry32 from '../../utils/random'
import { hash2, packKey } from '../../utils/coords'
import DecoInstance, { centerTemplate, collectModelParts, prepareNatureModel, templateFloor } from './InstancedProp'
import FieldDetails from './FieldDetails'
import type { Part } from './InstancedProp'
import treeA from '../../assets/nature/kenney_tree.glb'
import treeB from '../../assets/nature/kenney_treeLarge.glb'
import rockA from '../../assets/nature/kenney_rock.glb'
import rockB from '../../assets/nature/kenney_rockFlat.glb'
import bushA from '../../assets/nature/kenney_plant.glb'
import bushB from '../../assets/nature/kenney_twig.glb'
import mushroomA from '../../assets/nature/kenney_mushroom.glb'
import grassA from '../../assets/nature/kenney_grass.glb'
import type Board from './Board'
import type Chunk from './Chunk'
import type Tile from './Tile'

type Kind = 'tree' | 'rock' | 'bush' | 'mushroom' | 'grass' | 'lake' | 'grain'

interface ModelSource {
    kind: Kind
    url: string
}

// One coherent CC0 kit: Kenney's Nature Kit keeps the props consistent in
// style, palette and scale. Only the flat tile centres receive decorations.
const SOURCES: ModelSource[] = [
    { kind: 'tree', url: treeA },
    { kind: 'tree', url: treeB },
    { kind: 'rock', url: rockA },
    { kind: 'rock', url: rockB },
    { kind: 'bush', url: bushA },
    { kind: 'bush', url: bushB },
    { kind: 'mushroom', url: mushroomA },
    { kind: 'grass', url: grassA },
]

// Kenney's rocks ship with a warm brown base colour. A neutral grey keeps
// them readable against the grass without looking like dirt clumps.
function tintRocks(object: Object3D): void {
    object.traverse(child => {
        const mesh = child as Mesh
        if (!mesh.isMesh || !mesh.material) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials) {
            const standard = material as MeshStandardMaterial
            if (standard.color) standard.color.set(0x9aa0a6)
        }
    })
}

// Scatters nature models over the terrain using shared InstancedMeshes per
// chunk. Props stay hidden until the tile below them is revealed.
export default class Decoration {
    public board: Board
    public onReady: (() => void) | null = null

    private templates: { kind: Kind, object: Object3D }[] = []
    // Parts of each template, relative to the template root.
    private prototypes = new Map<Object3D, Part[]>()
    private floors = new Map<Object3D, number>()
    private loaded = false
    private seed = 1

    constructor(board: Board) {
        this.board = board
        // Flat detail props are generated, so they are ready before the GLBs.
        this.registerTemplate('lake', FieldDetails.lake())
        this.registerTemplate('grain', FieldDetails.grain())
        this.loadModels()
    }

    public isLoaded(): boolean {
        return this.loaded
    }

    public setSeed(seed: number): void {
        this.seed = seed
    }

    private loadModels(): void {
        const loader = new GLTFLoader(this.board.game.manager)
        let remaining = SOURCES.length

        const finish = (): void => {
            remaining--
            if (remaining === 0) {
                this.loaded = true
                if (this.onReady) this.onReady()
            }
        }

        for (const source of SOURCES) {
            loader.load(
                source.url,
                gltf => {
                    const object = gltf.scene
                    prepareNatureModel(object)
                    if (source.kind === 'rock') tintRocks(object)
                    this.registerTemplate(source.kind, object)
                    finish()
                },
                undefined,
                err => {
                    console.warn(`Failed to load ${source.url}`, err)
                    finish()
                }
            )
        }
    }

    private registerTemplate(kind: Kind, object: Object3D): void {
        const parts = centerTemplate(collectModelParts(object))
        if (parts.length > 0) {
            this.prototypes.set(object, parts)
            this.floors.set(object, templateFloor(parts))
            this.templates.push({ kind, object })
        }
    }

    private templatesOfKind(kind: Kind): Object3D[] {
        return this.templates.filter(t => t.kind === kind).map(t => t.object)
    }

    // Build every prop for one chunk as InstancedMeshes.
    public populate(chunk: Chunk): void {
        chunk.clearDecoration()
        if (!this.loaded) return

        const ts = this.board.tileSize
        const chunkSeed = (this.seed ^ Math.imul(chunk.cx, 73856093) ^ Math.imul(chunk.cz, 19349663)) >>> 0
        const rng = mulberry32(chunkSeed)

        const collected = new Map<Object3D, { tile: Tile, position: Vector3, rotationY: number, scale: number }[]>()

        for (const tile of chunk.tiles) {
            // A tile with a lake or a grain patch gets just that one detail,
            // so it never overlaps the random nature props.
            const detail = this.fieldDetail(tile)
            const count = detail ? 1 : 1 + Math.floor(rng() * 2)
            for (let i = 0; i < count; i++) {
                const kind = detail ?? this.pickKind(tile, rng)
                if (!kind) continue

                const options = this.templatesOfKind(kind)
                if (options.length === 0) continue

                const template = options[Math.floor(rng() * options.length)]
                if (!this.prototypes.has(template)) continue

                const scale = this.scaleFor(kind, rng)
                const flatDetail = kind === 'lake' || kind === 'grain'
                // Rectangular beds stay aligned with the tile grid; a random
                // angle would push their corners onto the sloped border.
                const rotationY = kind === 'grain'
                    ? (rng() < 0.5 ? 0 : Math.PI / 2)
                    : flatDetail ? 0 : rng() * Math.PI * 2

                const offset = ts * 0.8
                const jitterX = (rng() - 0.5) * offset
                const jitterZ = (rng() - 0.5) * offset
                // Centred templates plus a flat-centre placement keep wide
                // props from spilling over the sloped edge of the tile.
                const centred = kind === 'rock' || kind === 'lake' || kind === 'grain'
                const rawX = centred ? tile.worldX : tile.worldX + jitterX
                const rawZ = centred ? tile.worldZ : tile.worldZ + jitterZ
                const flat = centred
                    ? { x: tile.worldX, z: tile.worldZ }
                    : this.board.terrain.clampToFlat(rawX, rawZ, scale * 0.25)
                const px = flat.x
                const pz = flat.z
                const floor = this.floors.get(template) ?? 0
                // Flat details must sit above the terrain, not under it: a
                // buried patch vanished at some camera angles and distances.
                // Nature props still sink by their template floor.
                const py = flatDetail
                    ? this.board.terrain.heightAtWorld(px, pz) + 0.08
                    : this.board.terrain.heightAtWorld(px, pz) - floor * scale - 0.25

                const list = collected.get(template)
                // Positions are local to the chunk (the chunk group carries
                // the world offset), so geometry precision stays high.
                const entry = {
                    tile,
                    position: new Vector3(px - chunk.originX, py, pz - chunk.originZ),
                    rotationY,
                    scale
                }
                if (list) {
                    list.push(entry)
                } else {
                    collected.set(template, [entry])
                }
            }
        }

        for (const [template, items] of collected) {
            const parts = this.prototypes.get(template)
            if (!parts || items.length === 0) continue

            const meshes = parts.map(part => {
                const mesh = new InstancedMesh(part.geometry, part.material, items.length)
                chunk.registerDecoMesh(mesh)
                return mesh
            })

            const partMatrices = parts.map(p => p.matrix)
            items.forEach((item, index) => {
                const instance = new DecoInstance(
                    meshes,
                    partMatrices,
                    index,
                    item.position,
                    item.rotationY,
                    item.scale
                )

                const key = packKey(item.tile.x, item.tile.z)
                const list = chunk.decoByTile.get(key)
                if (list) {
                    list.push(instance)
                } else {
                    chunk.decoByTile.set(key, [instance])
                }
            })

            for (const mesh of meshes) {
                mesh.computeBoundingSphere()
            }
        }
    }

    private pickKind(tile: Tile, rng: () => number): Kind | null {
        const roll = rng()
        // Trees only on the higher ground.
        if (roll < 0.1 && tile.surfaceY > 90) return 'tree'
        if (roll < 0.34) return 'rock'
        if (roll < 0.52) return 'bush'
        if (roll < 0.62) return 'mushroom'
        return 'grass'
    }

    // Lakes and grain patches only appear on gently rolling, non-snowy tiles.
    // The hash keeps the same tiles decorated after a chunk is rebuilt.
    private fieldDetail(tile: Tile): Kind | null {
        if (tile.surfaceY > 150) return null

        const corners = tile.terrain.tileCorners(tile.x, tile.z)
        const heights = [corners.a, corners.b, corners.c, corners.d]
        if (Math.max(...heights) - Math.min(...heights) > 46) return null

        const roll = hash2(tile.x, tile.z, this.seed ^ 0x5f3759df)
        if (roll < 0.055) return 'lake'
        if (roll < 0.15) return 'grain'
        return null
    }

    private scaleFor(kind: Kind, rng: () => number): number {
        switch (kind) {
            case 'lake':
                return 0.75 + rng() * 0.15
            case 'grain':
                return 0.78 + rng() * 0.12
            case 'tree':
                return 6 + rng() * 4
            case 'rock':
                return 6 + rng() * 4
            case 'bush':
                return 13 + rng() * 7
            case 'mushroom':
                return 9 + rng() * 5
            case 'grass':
            default:
                return 8 + rng() * 5
        }
    }
}
