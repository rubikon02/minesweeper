import {
    Group,
    Object3D,
    Mesh,
    MeshStandardMaterial,
    Material
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import mulberry32 from '../../utils/random'
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
import flowerA from '../../assets/nature/flower_redA.glb'
import type Board from './Board'
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
    { kind: 'grass', url: flowerA },
]

// Scatters nature models over the terrain. Everything is placed once and
// simply hidden by the fog until a tile is revealed.
export default class Decoration {
    public board: Board
    public group: Group

    private templates: { kind: Kind, object: Object3D }[] = []
    private loaded = false
    private seed = 1
    // Models belonging to each tile, hidden until that tile is revealed.
    private byTile = new Map<Tile, Object3D[]>()

    constructor(board: Board) {
        this.board = board
        this.group = new Group()
        this.board.game.scene.add(this.group)

        this.loadModels()
    }

    private loadModels(): void {
        const loader = new GLTFLoader(this.board.game.manager)
        let remaining = SOURCES.length

        for (const source of SOURCES) {
            loader.load(
                source.url,
                gltf => {
                    const object = gltf.scene
                    // Nature kit materials are fully metallic by default,
                    // which looks dark without an environment map.
                    object.traverse(child => {
                        const mesh = child as Mesh
                        if (mesh.isMesh && mesh.material) {
                            const fix = (m: Material) => {
                                const std = m as MeshStandardMaterial
                                if ('metalness' in std) {
                                    std.metalness = 0
                                    std.roughness = 0.9
                                }
                                return m
                            }
                            if (Array.isArray(mesh.material)) {
                                mesh.material = mesh.material.map(fix)
                            } else {
                                mesh.material = fix(mesh.material)
                            }
                            mesh.castShadow = false
                            mesh.receiveShadow = false
                        }
                    })
                    this.templates.push({ kind: source.kind, object })
                    remaining--
                    if (remaining === 0) {
                        this.loaded = true
                        this.populate()
                    }
                },
                undefined,
                err => {
                    console.warn(`Failed to load ${source.url}`, err)
                    remaining--
                    if (remaining === 0) {
                        this.loaded = true
                        this.populate()
                    }
                }
            )
        }
    }

    private templatesOfKind(kind: Kind): Object3D[] {
        return this.templates.filter(t => t.kind === kind).map(t => t.object)
    }

    // Clear all models and place a fresh set using the given seed.
    public regenerate(seed: number): void {
        this.seed = seed
        if (this.loaded) {
            this.populate()
        }
    }

    private clear(): void {
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0])
        }
        this.byTile.clear()
    }

    private populate(): void {
        this.clear()
        const rng = mulberry32(this.seed)
        const tileSize = this.board.tileSize

        const pickKind = (tile: Tile): Kind | null => {
            const roll = rng()
            // Trees only on the higher ground.
            if (roll < 0.12 && tile.surfaceY > 90) return 'tree'
            if (roll < 0.4) return 'rock'
            if (roll < 0.7) return 'bush'
            return 'grass'
        }

        const placeOne = (tile: Tile, kind: Kind, spread: number): void => {
            const options = this.templatesOfKind(kind)
            if (options.length === 0) return

            const template = options[Math.floor(rng() * options.length)]
            const instance = template.clone()

            const scale = this.scaleFor(kind, rng)
            instance.scale.setScalar(scale)
            instance.rotation.y = rng() * Math.PI * 2

            const offset = tileSize * spread
            const px = tile.worldX + (rng() - 0.5) * offset
            const pz = tile.worldZ + (rng() - 0.5) * offset
            instance.position.set(
                px,
                // Exact ground height under the model, sunk in slightly.
                this.board.terrain.heightAtWorld(px, pz) - 0.3,
                pz
            )

            this.group.add(instance)
            // Hidden until the tile below it is revealed.
            instance.visible = false
            const list = this.byTile.get(tile)
            if (list) {
                list.push(instance)
            } else {
                this.byTile.set(tile, [instance])
            }
        }

        for (const tile of this.board.tiles) {
            // Most tiles get a couple of small props; a few get more.
            const count = 2 + Math.floor(rng() * 3)
            for (let i = 0; i < count; i++) {
                const kind = pickKind(tile)
                if (!kind) continue
                placeOne(tile, kind, 0.8)
            }
        }
    }

    // Show or hide every model sitting on one tile.
    public show(tile: Tile): void {
        const list = this.byTile.get(tile)
        if (!list) return
        for (const instance of list) {
            instance.visible = true
        }
    }

    public hide(tile: Tile): void {
        const list = this.byTile.get(tile)
        if (!list) return
        for (const instance of list) {
            instance.visible = false
        }
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
