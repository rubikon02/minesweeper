import {
    Raycaster,
    Vector2
} from "three"
import type Game from './Game'
import type Tile from './board/Tile'

export default class Player {
    public game: Game
    public raycaster: Raycaster
    public mouse: Vector2
    public tileLookedAt: Tile | null = null
    private crosshairEl: HTMLElement | null = null

    constructor(game: Game) {
        this.game = game
        this.raycaster = new Raycaster()
        this.mouse = new Vector2(0, 0)
        this.crosshairEl = document.getElementById("crosshair")
    }

    // Raycast the chunk terrain meshes (a handful of objects) and resolve
    // the hit point back to a grid coordinate.
    public getRaycastTarget(coords: Vector2 = this.mouse): Tile | null {
        const board = this.game.board
        if (!board || !board.chunkManager) return null

        const meshes = board.chunkManager.meshList
        if (meshes.length === 0) return null

        this.raycaster.setFromCamera(coords, this.game.camera)
        const intersects = this.raycaster.intersectObjects(meshes, false)
        // Chunks only exist around the player, so the distance cap is just a
        // guard against far-plane noise. It must stay above the highest
        // camera position (E can raise it to 4000).
        const maxDistance = 12000

        if (intersects.length > 0 && intersects[0].distance < maxDistance) {
            const point = intersects[0].point
            const gx = Math.floor(point.x / board.tileSize)
            const gz = Math.floor(point.z / board.tileSize)
            return board.getTile(gx, gz)
        }
        return null
    }

    public update(_delta: number): void {
        const board = this.game.board
        if (!board) return

        const targetTile = this.getRaycastTarget(this.mouse)
        const targeted = !!targetTile && board.isTileAccessible(targetTile.x, targetTile.z)

        if (this.tileLookedAt !== targetTile) {
            this.tileLookedAt = targetTile
        }

        if (!this.crosshairEl) {
            this.crosshairEl = document.getElementById("crosshair")
        }
        if (this.crosshairEl) {
            this.crosshairEl.classList.toggle("targeted", targeted)
        }
    }
}
