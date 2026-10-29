import type { Mesh } from 'three'
import Chunk from './Chunk'
import { CHUNK_SIZE, CHUNK_RADIUS, chunkKey } from '../../utils/coords'
import type Board from './Board'
import type Tile from './Tile'

// Streams chunks in and out around the player. Chunks beyond the radius are
// disposed, so GPU memory stays bounded no matter how far the player walks.
export default class ChunkManager {
    public board: Board
    public chunks = new Map<number, Chunk>()
    // Terrain meshes, kept in a flat list for the player raycast.
    public meshList: Mesh[] = []

    private lastCx = Number.NaN
    private lastCz = Number.NaN

    constructor(board: Board) {
        this.board = board
    }

    public getChunk(cx: number, cz: number): Chunk | null {
        return this.chunks.get(chunkKey(cx, cz)) || null
    }

    public getTile(gx: number, gz: number): Tile | null {
        const chunk = this.getChunk(
            Math.floor(gx / CHUNK_SIZE),
            Math.floor(gz / CHUNK_SIZE)
        )
        return chunk ? chunk.getTile(gx, gz) : null
    }

    public update(playerX: number, playerZ: number, delta: number): void {
        const chunkWorld = CHUNK_SIZE * this.board.tileSize
        const cx = Math.floor(playerX / chunkWorld)
        const cz = Math.floor(playerZ / chunkWorld)

        if (cx !== this.lastCx || cz !== this.lastCz) {
            this.lastCx = cx
            this.lastCz = cz
            this.buildAround(cx, cz)
        }

        for (const chunk of this.chunks.values()) {
            chunk.update(delta)
        }
    }

    private buildAround(cx: number, cz: number): void {
        for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
            for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
                const key = chunkKey(cx + dx, cz + dz)
                if (!this.chunks.has(key)) {
                    this.chunks.set(key, new Chunk(this.board, cx + dx, cz + dz))
                }
            }
        }

        for (const [key, chunk] of this.chunks) {
            if (
                Math.abs(chunk.cx - cx) > CHUNK_RADIUS + 1 ||
                Math.abs(chunk.cz - cz) > CHUNK_RADIUS + 1
            ) {
                chunk.dispose()
                this.chunks.delete(key)
            }
        }

        this.refreshMeshList()
    }

    public refreshMeshList(): void {
        this.meshList = []
        for (const chunk of this.chunks.values()) {
            this.meshList.push(chunk.terrainMesh)
        }
    }

    // Rebuild every chunk's props, e.g. once the GLB models finish loading.
    public rebuildDecorations(): void {
        for (const chunk of this.chunks.values()) {
            chunk.clearDecoration()
            chunk.decorate()
            chunk.reapplyState()
        }
    }

    public clear(): void {
        for (const chunk of this.chunks.values()) {
            chunk.dispose()
        }
        this.chunks.clear()
        this.meshList = []
        this.lastCx = Number.NaN
        this.lastCz = Number.NaN
    }
}
