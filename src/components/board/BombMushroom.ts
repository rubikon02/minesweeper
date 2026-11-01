import {
    Box3,
    InstancedMesh,
    Object3D,
    Vector3
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import mulberry32 from '../../utils/random'
import mushroomUrl from '../../assets/nature/mushroom_bomb.glb'
import DecoInstance, { collectModelParts, prepareNatureModel } from './InstancedProp'
import type { Part } from './InstancedProp'
import type Board from './Board'
import type Chunk from './Chunk'
import type { MarkerEntry } from './Marker'

// World height of the bomb marker. A tile is 35 units wide, so this is a
// landmark-scale object: clearly larger than any bloom plant, which keeps a
// bomb tile from reading as a number tile.
const HEIGHT = 26

// The bomb marker is an instanced model rather than merged marker geometry:
// it carries its own materials, so it cannot join the vertex-coloured marker
// mesh. Bombs are revealed only at game over, so the extra draw calls only
// exist after a loss.
export default class BombMushroom {
    public board: Board
    public onReady: (() => void) | null = null

    private parts: Part[] = []
    private scale = 1
    // Distance from the model root down to its lowest vertex, already scaled,
    // so the mushroom sits on the terrain whatever the authored pivot is.
    private footOffset = 0
    private loaded = false

    constructor(board: Board) {
        this.board = board
        this.load()
    }

    private load(): void {
        const loader = new GLTFLoader(this.board.game.manager)

        loader.load(
            mushroomUrl,
            gltf => {
                // The GLB already converts its Z-up geometry to Y-up in the
                // node hierarchy, so no extra rotation is needed here.
                const object = gltf.scene
                prepareNatureModel(object)
                this.measure(object)
                this.parts = collectModelParts(object)

                this.loaded = true
                if (this.onReady) this.onReady()
            },
            undefined,
            err => {
                // No fallback by design: a failed load leaves bomb tiles
                // without a marker rather than mixing two marker styles.
                console.warn(`Failed to load ${mushroomUrl}`, err)
            }
        )
    }

    private measure(object: Object3D): void {
        const box = new Box3().setFromObject(object)
        const height = box.max.y - box.min.y
        this.scale = height > 0 ? HEIGHT / height : 1
        this.footOffset = -box.min.y * this.scale
    }

    // Rebuild the bombs of one chunk. Positions are local to the chunk origin
    // so precision stays high far from spawn.
    public populate(chunk: Chunk, entries: MarkerEntry[]): void {
        chunk.clearBombMushrooms()
        if (!this.loaded || entries.length === 0 || this.parts.length === 0) return

        const meshes = this.parts.map(part => {
            const mesh = new InstancedMesh(part.geometry, part.material, entries.length)
            mesh.raycast = () => void 0
            chunk.registerBombMesh(mesh)
            return mesh
        })

        const partMatrices = this.parts.map(part => part.matrix)
        const terrain = this.board.terrain

        entries.forEach((entry, index) => {
            const seed = (
                Math.imul(Math.floor(entry.worldX), 73856093) ^
                Math.imul(Math.floor(entry.worldZ), 19349663) ^
                0x9e3779b9
            ) >>> 0
            const rng = mulberry32(seed)
            const baseY = terrain.heightAtWorld(entry.worldX, entry.worldZ)

            new DecoInstance(
                meshes,
                partMatrices,
                index,
                new Vector3(
                    entry.worldX - chunk.originX,
                    baseY + this.footOffset,
                    entry.worldZ - chunk.originZ
                ),
                rng() * Math.PI * 2,
                this.scale
            )
        })

        for (const mesh of meshes) {
            mesh.computeBoundingSphere()
        }
    }
}
