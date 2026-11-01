import {
    Object3D,
    InstancedMesh,
    Vector3
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import mulberry32 from '../../utils/random'
import { packKey } from '../../utils/coords'
import DecoInstance, { collectModelParts, prepareNatureModel } from './InstancedProp'
import type { Part } from './InstancedProp'
import treeA from '../../assets/nature/tree_default.glb'
import treeB from '../../assets/nature/tree_pineDefaultA.glb'
import treeC from '../../assets/nature/tree_pineSmallA.glb'
import treeD from '../../assets/nature/tree_simple.glb'
import rockA from '../../assets/nature/rock_smallA.glb'
import rockB from '../../assets/nature/rock_smallC.glb'
import rockC from '../../assets/nature/rock_largeA.glb'
import bushA from '../../assets/nature/plant_bush.glb'
import bushB from '../../assets/nature/plant_bushSmall.glb'
import plantA from '../../assets/nature/plant_flatTall.glb'
import grassA from '../../assets/nature/grass.glb'
import type Board from './Board'
import type Chunk from './Chunk'
import type Tile from './Tile'

type Kind = 'tree' | 'rock' | 'bush' | 'grass'

interface ModelSource {
    kind: Kind
    url: string
}

const SOURCES: ModelSource[] = [
    { kind: 'tree', url: treeA },
    { kind: 'tree', url: treeB },
    { kind: 'tree', url: treeC },
    { kind: 'tree', url: treeD },
    { kind: 'rock', url: rockA },
    { kind: 'rock', url: rockB },
    { kind: 'rock', url: rockC },
    { kind: 'bush', url: bushA },
    { kind: 'bush', url: bushB },
    { kind: 'bush', url: plantA },
    { kind: 'grass', url: grassA },
]

// Scatters nature models over the terrain using shared InstancedMeshes per
// chunk. Props stay hidden until the tile below them is revealed.
export default class Decoration {
    public board: Board
    public onReady: (() => void) | null = null

    private templates: { kind: Kind, object: Object3D }[] = []
    // Parts of each template, relative to the template root.
    private prototypes = new Map<Object3D, Part[]>()
    private loaded = false
    private seed = 1

    constructor(board: Board) {
        this.board = board
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
        const parts = collectModelParts(object)
        if (parts.length > 0) {
            this.prototypes.set(object, parts)
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
            const count = 1 + Math.floor(rng() * 2)
            for (let i = 0; i < count; i++) {
                const kind = this.pickKind(tile, rng)
                if (!kind) continue

                const options = this.templatesOfKind(kind)
                if (options.length === 0) continue

                const template = options[Math.floor(rng() * options.length)]
                if (!this.prototypes.has(template)) continue

                const scale = this.scaleFor(kind, rng)
                const rotationY = rng() * Math.PI * 2

                const offset = ts * 0.8
                const px = tile.worldX + (rng() - 0.5) * offset
                const pz = tile.worldZ + (rng() - 0.5) * offset
                const py = this.board.terrain.heightAtWorld(px, pz) - 0.3

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
        if (roll < 0.12 && tile.surfaceY > 90) return 'tree'
        if (roll < 0.4) return 'rock'
        if (roll < 0.7) return 'bush'
        return 'grass'
    }

    private scaleFor(kind: Kind, rng: () => number): number {
        switch (kind) {
            case 'tree':
                return 7 + rng() * 4
            case 'rock':
                return 16 + rng() * 10
            case 'bush':
                return 18 + rng() * 10
            case 'grass':
            default:
                return 9 + rng() * 7
        }
    }
}
