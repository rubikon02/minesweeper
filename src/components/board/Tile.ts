import type Board from './Board'
import type Chunk from './Chunk'
import type Terrain from './Terrain'
import type Game from '../Game'
import Flag from './Flag'

// A single logical tile. Tiles carry no geometry of their own any more:
// the chunk they belong to owns the merged terrain, fog and icon meshes.
// Tiles only track value, open state and the flag mesh.
export default class Tile {
    public board: Board
    public chunk: Chunk
    public terrain: Terrain
    public game: Game
    public x: number
    public z: number
    public value: string | number = 'empty'

    public worldX: number
    public worldZ: number
    public surfaceY: number
    // Highest corner of the tile, used to place icons above it.
    public maxCornerY: number

    public flag: Flag

    private opened = false
    private computed = false

    constructor(chunk: Chunk, x: number, z: number) {
        this.chunk = chunk
        this.board = chunk.board
        this.terrain = this.board.terrain
        this.game = this.board.game
        this.x = x
        this.z = z

        const ts = this.board.tileSize
        this.worldX = (x + 0.5) * ts
        this.worldZ = (z + 0.5) * ts
        this.surfaceY = this.terrain.surfaceY(x, z)
        const corners = this.terrain.tileCorners(x, z)
        this.maxCornerY = Math.max(corners.a, corners.b, corners.c, corners.d)

        this.flag = new Flag(this)
    }

    // True when this tile shows a number or a bomb icon.
    public hasIcon(): boolean {
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

    public toggleFlag(): void {
        if (!this.isOpen()) {
            this.flag.toggle()
        }
    }

    public open(_silent = false): void {
        if (this.board.blockActions) return
        if (this.flag.isVisible() || this.isOpen()) return

        // The first click chooses a safe 3x3 area and starts the clock.
        this.board.ensureStarted(this.x, this.z)

        this.computeValue()
        this.reveal()

        if (this.value === 'bomb') {
            this.game.addPoints(-250)
            this.game.gameOver(this)
            return
        }

        if (this.value === 'empty') {
            this.game.addPoints(1)
            this.floodOpen()
        } else {
            this.game.addPoints(this.value as number)
        }
    }

    // Expand through connected empty tiles, scoring as it goes.
    private floodOpen(): void {
        const stack: Tile[] = [this]
        while (stack.length > 0) {
            const tile = stack.pop()!
            for (const neighbour of tile.getNeighbours()) {
                if (neighbour.isOpen() || neighbour.flag.isVisible()) continue
                neighbour.computeValue()
                neighbour.reveal()

                if (neighbour.value === 'empty') {
                    this.game.addPoints(1)
                    stack.push(neighbour)
                } else if (neighbour.value !== 'bomb') {
                    this.game.addPoints(neighbour.value as number)
                }
            }
        }
    }

    // Show the terrain and clear the fog, without any scoring.
    // Instant clears the fog at once (used when all bombs are revealed).
    public reveal(instant = false): void {
        if (this.opened) return
        this.opened = true

        this.board.registerOpened(this.x, this.z)
        this.chunk.setRevealed(this.x, this.z, instant)

        // Props would cover the number, so keep them hidden on icon tiles.
        if (this.hasIcon()) {
            this.chunk.markIcon(this)
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

        if (this.hasIcon()) {
            this.chunk.markIcon(this)
            this.chunk.setDecoVisible(this, false)
        } else {
            this.chunk.setDecoVisible(this, true)
        }
    }

    public isOpen(): boolean {
        return this.opened
    }
}
