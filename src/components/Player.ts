import {
    Raycaster,
    Vector2
} from "three"
import type Game from './Game'
import type Tile from './board/Tile'
import type { TileMesh } from './board/Tile'

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

    public getRaycastTarget(coords: Vector2 = this.mouse): Tile | null {
        if (!this.game.board || !this.game.board.tiles) return null

        this.raycaster.setFromCamera(coords, this.game.camera)
        const tileMeshes = this.game.board.tiles.map(tile => tile.mesh)
        const intersects = this.raycaster.intersectObjects(tileMeshes, false)
        const maxDistance = (this.game.playerController && this.game.playerController.isBirdEye) ? 2000 : 900

        if (intersects.length > 0 && intersects[0].distance < maxDistance) {
            return (intersects[0].object as TileMesh).parentObject || null
        }
        return null
    }

    public update(_delta: number): void {
        if (!this.game.board || !this.game.board.tiles) return

        const targetTile = this.getRaycastTarget(this.mouse)

        if (this.tileLookedAt !== targetTile) {
            if (this.tileLookedAt && typeof this.tileLookedAt.setHover === 'function') {
                this.tileLookedAt.setHover(false)
            }
            if (targetTile && typeof targetTile.setHover === 'function') {
                targetTile.setHover(true)
            }
            this.tileLookedAt = targetTile

            if (!this.crosshairEl) {
                this.crosshairEl = document.getElementById("crosshair")
            }
            if (this.crosshairEl) {
                this.crosshairEl.classList.toggle("targeted", targetTile !== null)
            }
        }
    }
}
