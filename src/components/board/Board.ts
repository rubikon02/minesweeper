import { Object3D } from 'three'
import Tile from './Tile'
import Flag from './Flag'
import Terrain from './Terrain'
import Decoration from './Decoration'
import type Game from '../Game'

export default class Board {
    public game: Game
    public width: number
    public height: number
    public tileSize: number
    public bombsDensity: number
    public bombsCount: number

    public terrain: Terrain
    public decoration: Decoration

    public tiles: Tile[] = []
    public grid: (Tile | null)[][] = []
    public bombs: { x: number; z: number }[] = []
    public bombsGenerated = false
    public blockActions = false
    public preloadedFlag: Object3D | null = null

    constructor(game: Game) {
        this.game = game
        this.width = 20
        this.height = 20
        this.tileSize = 35
        this.bombsDensity = 0.13
        this.bombsCount = Math.floor(this.width * this.height * this.bombsDensity)

        Flag.preload(this.game.manager, flag => {
            this.preloadedFlag = flag
        })

        this.terrain = new Terrain(this, Math.floor(Math.random() * 100000))
        this.generateTiles()
        this.decoration = new Decoration(this)
        this.decoration.regenerate(Math.floor(Math.random() * 100000))
    }

    public generateTiles(): void {
        this.grid = []
        for (let x = 0; x < this.width; x++) {
            this.grid[x] = []
            for (let z = 0; z < this.height; z++) {
                const tile = new Tile(this, x, z)
                this.tiles.push(tile)
                this.grid[x][z] = tile
                this.game.scene.add(tile.mesh)
            }
        }
    }

    public generateBombs(safeX: number, safeZ: number): void {
        this.bombs = []
        this.bombsCount = Math.floor(this.width * this.height * this.bombsDensity)

        const isSafe = (x: number, z: number): boolean => {
            return Math.abs(x - safeX) <= 1 && Math.abs(z - safeZ) <= 1
        }

        while (this.bombs.length < this.bombsCount) {
            const x = Math.floor(Math.random() * this.width)
            const z = Math.floor(Math.random() * this.height)

            if (isSafe(x, z)) continue
            if (this.bombs.some(b => b.x === x && b.z === z)) continue

            this.bombs.push({ x, z })
        }

        this.bombsGenerated = true
    }

    public setTileValues(): void {
        for (const bomb of this.bombs) {
            const tile = this.getTile(bomb.x, bomb.z)
            if (tile) {
                tile.set("bomb")
            }
        }

        for (const tile of this.tiles) {
            if (tile.value !== "bomb") {
                let neighbourBombs = 0
                for (const neighbour of tile.getNeighbours()) {
                    if (neighbour.value === "bomb") {
                        neighbourBombs++
                    }
                }
                if (neighbourBombs > 0) {
                    tile.set(neighbourBombs)
                } else {
                    tile.set("empty")
                }
            }
        }
    }

    public getTile(x: number, z: number): Tile | null {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) {
            return null
        }
        return this.grid[x] ? this.grid[x][z] : null
    }

    public revealAllBombs(): void {
        for (const tile of this.tiles) {
            if (tile.value === "bomb" && !tile.isOpen()) {
                if (!tile.flag.isVisible()) {
                    tile.reveal(true)
                }
            }
        }
    }

    public flagAllBombs(): void {
        for (const tile of this.tiles) {
            if (tile.value === "bomb" && !tile.flag.isVisible()) {
                tile.flag.show(true)
            }
        }
    }

    public checkWin(): boolean {
        if (!this.bombsGenerated) return false

        for (const tile of this.tiles) {
            if (tile.value !== "bomb" && !tile.isOpen()) {
                return false
            }
        }
        return true
    }

    public restart(): void {
        this.blockActions = false
        this.bombsGenerated = false
        this.bombs = []

        for (const tile of this.tiles) {
            tile.close()
        }

        this.decoration.regenerate(Math.floor(Math.random() * 100000))
    }

    // Tick the fog reveal animations.
    public update(delta: number): void {
        for (const tile of this.tiles) {
            tile.fog.update(delta)
        }
    }

    public removeFlags(): void {
        for (const tile of this.tiles) {
            tile.flag.hide(true)
        }
    }

    public closeAll(): void {
        for (const tile of this.tiles) {
            tile.close()
        }
    }
}
