import { Mesh } from 'three'

import { buildTerrainSurface } from './TerrainSurface'
import type Board from './Board'

// A coarse copy of the terrain that reaches out to the horizon, so the
// mountains never simply stop at the edge of the built chunks. It is built
// from the same height function at a low resolution and is recentred when
// the player travels far enough.
export default class Horizon extends Mesh {
    public board: Board

    private step: number
    private halfSpan: number
    private cells: number
    private lastX = Number.POSITIVE_INFINITY
    private lastZ = Number.POSITIVE_INFINITY

    constructor(board: Board) {
        super()
        this.board = board
        this.step = board.tileSize * 8
        this.cells = 34
        this.halfSpan = (this.cells / 2) * this.step

        this.material = board.terrain.material
        this.frustumCulled = false
        this.raycast = () => void 0
        // Sit just under the detailed terrain so overlaps never z-fight.
        this.position.y = -2

        this.rebuild(0, 0)
    }

    public update(playerX: number, playerZ: number): void {
        const threshold = this.step * 4
        if (Math.abs(playerX - this.lastX) > threshold || Math.abs(playerZ - this.lastZ) > threshold) {
            this.rebuild(playerX, playerZ)
        }
    }

    private rebuild(centerX: number, centerZ: number): void {
        const step = this.step

        const originX = Math.round(centerX / step) * step - this.halfSpan
        const originZ = Math.round(centerZ / step) * step - this.halfSpan

        const geometry = buildTerrainSurface(this.board.terrain, {
            originX,
            originZ,
            cells: this.cells,
            step,
        })

        // The builder emits vertices local to its origin; the horizon mesh
        // carries the world offset itself, just like a chunk group does.
        this.position.x = originX
        this.position.z = originZ

        if (this.geometry) this.geometry.dispose()
        this.geometry = geometry

        this.lastX = centerX
        this.lastZ = centerZ
    }

    // Called on restart so the horizon uses the new terrain seed.
    public reseed(): void {
        this.lastX = Number.POSITIVE_INFINITY
        this.lastZ = Number.POSITIVE_INFINITY
        this.rebuild(0, 0)
    }
}
