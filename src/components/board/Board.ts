import type { Object3D } from 'three'
import Flag from './Flag'
import Terrain from './Terrain'
import Decoration from './Decoration'
import ChunkManager from './ChunkManager'
import { hash2, packKey, ACCESS_MARGIN } from '../../utils/coords'
import type Game from '../Game'
import type Tile from './Tile'

// The board is endless. Nothing is stored per tile except what the player
// has touched: which tiles are open, which are flagged, and the safe area
// chosen by the first click. Everything else is derived from the seed.
export default class Board {
    public game: Game
    public tileSize: number
    public bombsDensity: number

    public terrain: Terrain
    public decoration: Decoration
    public chunkManager: ChunkManager

    public opened = new Set<number>()
    public flagged = new Set<number>()
    public safeZone = new Set<number>()
    // Tiles the player may stand on / interact with: the opened tiles
    // dilated by the access margin. Grows as tiles are uncovered.
    public accessible = new Set<number>()

    public started = false
    public seed: number

    public preloadedFlag: Object3D | null = null

    // Running centroid of opened tiles, used to aim the bird's-eye camera.
    private sumX = 0
    private sumZ = 0
    private openedCount = 0

    constructor(game: Game) {
        this.game = game
        this.tileSize = 35
        this.bombsDensity = 0.13
        this.seed = Math.floor(Math.random() * 1000000000)

        Flag.preload(this.game.manager, flag => {
            this.preloadedFlag = flag
        })

        this.terrain = new Terrain(this, this.seed)
        this.decoration = new Decoration(this)
        this.decoration.setSeed(this.seed)
        this.decoration.onReady = () => this.chunkManager.rebuildDecorations()

        this.chunkManager = new ChunkManager(this)

        this.seedStart()
        this.chunkManager.update(this.tileSize * 0.5, this.tileSize * 0.5, 0)
    }

    // Give the player a small walkable patch at spawn before anything is
    // uncovered, so the first click is possible.
    private seedStart(): void {
        for (let dx = -ACCESS_MARGIN; dx <= ACCESS_MARGIN; dx++) {
            for (let dz = -ACCESS_MARGIN; dz <= ACCESS_MARGIN; dz++) {
                this.accessible.add(packKey(dx, dz))
            }
        }
    }

    // Deterministic bomb field. Seeded hash plus the first-click safe zone.
    public isBomb(gx: number, gz: number): boolean {
        if (!this.started) return false
        if (this.safeZone.has(packKey(gx, gz))) return false
        return hash2(gx, gz, this.seed) < this.bombsDensity
    }

    // The first open picks a 3x3 safe area. The Session starts the timer.
    public ensureStarted(x: number, z: number): void {
        if (this.started) return
        this.started = true
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.safeZone.add(packKey(x + dx, z + dz))
            }
        }
    }

    // Record an uncovered tile and broaden the accessible area around it.
    public registerOpened(x: number, z: number): void {
        const key = packKey(x, z)
        if (this.opened.has(key)) return
        this.opened.add(key)
        this.sumX += x
        this.sumZ += z
        this.openedCount++

        for (let dx = -ACCESS_MARGIN; dx <= ACCESS_MARGIN; dx++) {
            for (let dz = -ACCESS_MARGIN; dz <= ACCESS_MARGIN; dz++) {
                this.accessible.add(packKey(x + dx, z + dz))
            }
        }
    }

    public addFlag(x: number, z: number): void {
        this.flagged.add(packKey(x, z))
    }

    public removeFlag(x: number, z: number): void {
        this.flagged.delete(packKey(x, z))
    }

    public isTileAccessible(x: number, z: number): boolean {
        return this.accessible.has(packKey(x, z))
    }

    public isWorldAccessible(worldX: number, worldZ: number): boolean {
        return this.isTileAccessible(
            Math.floor(worldX / this.tileSize),
            Math.floor(worldZ / this.tileSize)
        )
    }

    public getTile(x: number, z: number): Tile | null {
        return this.chunkManager.getTile(x, z)
    }

    // Reveal every bomb inside the chunks the player can currently see.
    public revealAllBombs(): void {
        for (const chunk of this.chunkManager.chunks.values()) {
            for (const tile of chunk.tiles) {
                if (tile.isOpen()) continue
                tile.computeValue()
                if (tile.value === 'bomb') {
                    tile.reveal(true)
                }
            }
        }
    }

    public getCentroid(): { x: number, z: number } | null {
        if (this.openedCount === 0) return null
        return {
            x: (this.sumX / this.openedCount + 0.5) * this.tileSize,
            z: (this.sumZ / this.openedCount + 0.5) * this.tileSize,
        }
    }

    public update(playerX: number, playerZ: number, delta: number): void {
        this.chunkManager.update(playerX, playerZ, delta)
    }

    public restart(): void {
        this.started = false

        this.opened.clear()
        this.flagged.clear()
        this.safeZone.clear()
        this.accessible.clear()

        this.sumX = 0
        this.sumZ = 0
        this.openedCount = 0

        this.seed = Math.floor(Math.random() * 1000000000)
        this.terrain.reseed(this.seed)
        this.decoration.setSeed(this.seed)

        this.seedStart()
        this.chunkManager.clear()
        this.chunkManager.update(this.tileSize * 0.5, this.tileSize * 0.5, 0)
    }
}
