import {
    Raycaster,
    Vector2,
    LineBasicMaterial,
    BufferGeometry,
    BufferAttribute,
    Line
} from "three"

export default class Player {
    constructor(game) {
        this.game = game
        this.scene = this.game.scene
        this.raycaster = new Raycaster()
        this.mouse = new Vector2(0, 0) // Center of screen
        this.tileLookedAt = null

        this.createCrosshair()
    }

    createCrosshair() {
        const material = new LineBasicMaterial({
            color: 0xff4444,
            linewidth: 2,
        })
        const size = 0.005
        const geometry = new BufferGeometry()

        const vertices = new Float32Array([
            0, size, 0,
            0, -size, 0,
            0, 0, 0,
            size, 0, 0,
            -size, 0, 0,
        ])
        geometry.setAttribute("position", new BufferAttribute(vertices, 3))
        const crosshair = new Line(geometry, material)
        crosshair.position.set(0, 0, -0.3)

        this.game.camera.add(crosshair)
    }

    update(delta) {
        if (!this.game.board || !this.game.board.tiles) return

        this.raycaster.setFromCamera(this.mouse, this.game.camera)

        const tileMeshes = this.game.board.tiles.map(tile => tile.mesh)
        const intersects = this.raycaster.intersectObjects(tileMeshes, false)

        let targetTile = null
        if (intersects.length > 0 && intersects[0].distance < 450) {
            targetTile = intersects[0].object.parentObject || null
        }

        if (this.tileLookedAt !== targetTile) {
            if (this.tileLookedAt && typeof this.tileLookedAt.setHover === 'function') {
                this.tileLookedAt.setHover(false)
            }
            if (targetTile && typeof targetTile.setHover === 'function') {
                targetTile.setHover(true)
            }
            this.tileLookedAt = targetTile
        }
    }
}