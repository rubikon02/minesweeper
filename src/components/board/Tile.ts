import type Board from './Board'
import type Chunk from './Chunk'
import type Terrain from './Terrain'
import Flag from './Flag'

// A single logical tile. Tiles carry no geometry of their own any more:
// the chunk they belong to owns the merged terrain, fog and marker meshes.
// Tiles only track value, open state and the flag mesh.
export default class Tile {
    public board: Board
    public chunk: Chunk
    public terrain: Terrain
    public x: number
    public z: number
    public value: string | number = 'empty'

    public worldX: number
    public worldZ: number
    public surfaceY: number

    public flag: Flag

    private opened = false
    private computed = false

    constructor(chunk: Chunk, x: number, z: number) {
        this.chunk = chunk
        this.board = chunk.board
        this.terrain = this.board.terrain
        this.x = x
        this.z = z

        const ts = this.board.tileSize
        this.worldX = (x + 0.5) * ts
        this.worldZ = (z + 0.5) * ts
        this.surfaceY = this.terrain.surfaceY(x, z)

        this.flag = new Flag(this)
    }

    // True when this tile shows a bloom marker or a bomb pod.
    public hasMarker(): boolean {
        return this.value === 'bomb' || (typeof this.value === 'number' && this.value >= 1)
    }

    // Work out the tile value from the procedural bomb field. Cached so it
    // is only computed once per tile instance.
    public computeValue(): void {
        if (this.computed) return
        this.computed = true

        if (this.board.isBomb(this.x, this.z)) {
            this.value = 'bomb'
            return
        }

        let neighbours = 0
        for (let nx = this.x - 1; nx <= this.x + 1; nx++) {
            for (let nz = this.z - 1; nz <= this.z + 1; nz++) {
                if (nx === this.x && nz === this.z) continue
                if (this.board.isBomb(nx, nz)) neighbours++
            }
        }

        this.value = neighbours > 0 ? neighbours : 'empty'
    }

    public getNeighbours(): Tile[] {
        const neighbours: Tile[] = []
        for (let nx = this.x - 1; nx <= this.x + 1; nx++) {
            for (let nz = this.z - 1; nz <= this.z + 1; nz++) {
                if (nx === this.x && nz === this.z) continue
                const tile = this.board.getTile(nx, nz)
                if (tile) {
                    neighbours.push(tile)
                }
            }
        }
        return neighbours
    }

    // Show the terrain and clear the fog, without any scoring.
    // Instant clears the fog at once (used when all bombs are revealed).
    public reveal(instant = false): void {
        if (this.opened) return
        this.opened = true

        this.board.registerOpened(this.x, this.z)
        this.chunk.setRevealed(this.x, this.z, instant)

        // Props would cover the marker, so keep them hidden on marker tiles.
        if (this.hasMarker()) {
            this.chunk.markMarker(this)
            this.chunk.setDecoVisible(this, false)
        } else {
            this.chunk.setDecoVisible(this, true)
        }
    }

    // Restore the open state when a chunk is rebuilt (no scoring).
    public restoreOpen(): void {
        if (this.opened) return
        this.opened = true

        this.computeValue()
        this.chunk.setRevealed(this.x, this.z, true)

        if (this.hasMarker()) {
            this.chunk.markMarker(this)
            this.chunk.setDecoVisible(this, false)
        } else {
            this.chunk.setDecoVisible(this, true)
        }
    }

    public isOpen(): boolean {
        return this.opened
    }
}
