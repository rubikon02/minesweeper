import Tile from './Tile'
import Flag from './Flag'

export default class Board {
    constructor(game) {
        this.game = game
        this.width = 20
        this.height = 20
        this.tileSize = 35
        this.bombsDensity = 0.13
        this.bombsCount = Math.floor(this.width * this.height * this.bombsDensity)

        this.tiles = []
        this.grid = []
        this.bombs = []
        this.bombsGenerated = false
        this.blockActions = false
        this.preloadedFlag = null

        Flag.preload(this.game.manager, flag => {
            this.preloadedFlag = flag
        })

        this.generateTiles()
    }

    generateTiles() {
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

    generateBombs(safeX, safeZ) {
        this.bombs = []
        this.bombsCount = Math.floor(this.width * this.height * this.bombsDensity)

        const isSafe = (x, z) => {
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

    setTileValues() {
        for (let bomb of this.bombs) {
            const tile = this.getTile(bomb.x, bomb.z)
            if (tile) {
                tile.set("bomb")
            }
        }

        for (let tile of this.tiles) {
            if (tile.value !== "bomb") {
                let neighbourBombs = 0
                for (let neighbour of tile.getNeighbours()) {
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

    getTile(x, z) {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) {
            return null
        }
        return this.grid[x] ? this.grid[x][z] : null
    }

    revealAllBombs() {
        for (let tile of this.tiles) {
            if (tile.value === "bomb" && !tile.isOpen()) {
                if (tile.flag.isVisible()) {
                    // Flagged bomb was correctly identified
                } else {
                    this.game.scene.remove(tile.mesh)
                    tile.mesh = tile.flatMesh
                    this.game.scene.add(tile.mesh)
                }
            }
        }
    }

    flagAllBombs() {
        for (let tile of this.tiles) {
            if (tile.value === "bomb" && !tile.flag.isVisible()) {
                tile.flag.show(true)
            }
        }
    }

    checkWin() {
        if (!this.bombsGenerated) return false

        for (let tile of this.tiles) {
            if (tile.value !== "bomb" && !tile.isOpen()) {
                return false
            }
        }
        return true
    }

    restart() {
        this.blockActions = false
        this.bombsGenerated = false
        this.bombs = []

        for (let tile of this.tiles) {
            tile.close()
        }
    }

    removeFlags() {
        for (let tile of this.tiles) {
            tile.flag.hide(true)
        }
    }

    closeAll() {
        for (let tile of this.tiles) {
            tile.close()
        }
    }
}