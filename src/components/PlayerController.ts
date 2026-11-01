import { Vector3, Scene } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type Game from './Game'
import type Renderer from './Renderer'
import type Player from './Player'

export default class PlayerController {
    public game: Game
    public renderer: Renderer
    public scene: Scene
    public player: Player
    public controls: PointerLockControls

    // Movement speeds: walking ~half speed, sprint moderately faster
    public walkingSpeed = 1.3
    public sprintingSpeed = 1.9

    // Player height: raised so the player comfortably overlooks the tall mountains.
    public readonly walkHeight = 380
    public readonly birdEyeHeight = 1500

    // Extra height the player dials in with E / Q.
    public heightOffset = 0
    public readonly verticalSpeed = 250
    public readonly minCamHeight = 30
    public readonly maxCamHeight = 4000

    public isBirdEye = false
    public savedWalkPos: { x: number; z: number } = { x: 0, z: 0 }

    public keys: Record<string, boolean> = {}

    constructor(game: Game) {
        this.game = game
        this.renderer = this.game.renderer
        this.scene = this.game.scene
        this.player = this.game.player

        this.controls = new PointerLockControls(this.game.camera, document.body)

        this.resetPosition()
        this.initControls()
        this.addKeyListeners()

        this.updateSize()
        window.addEventListener('resize', () => this.updateSize())
    }

    public resetPosition(): void {
        this.isBirdEye = false
        this.heightOffset = 0
        const ts = this.game.board.tileSize
        const cx = ts * 0.5
        this.savedWalkPos = { x: cx, z: cx }
        this.game.camera.position.set(cx, this.walkHeight, cx)
        this.aimAtNearbyGround(cx, cx)
    }

    // Point the camera at the ground a couple of tiles ahead. The camera sits
    // high above the terrain, so a shallow pitch would aim past the walkable
    // area and leave nothing to click.
    private aimAtNearbyGround(x: number, z: number): void {
        const board = this.game.board
        const ts = board.tileSize
        const targetZ = z - ts * 2
        const targetY = board.terrain.surfaceY(
            Math.floor(x / ts),
            Math.floor(targetZ / ts)
        )
        this.game.camera.lookAt(new Vector3(x, targetY, targetZ))
    }

    public toggleBirdEye(): void {
        this.isBirdEye = !this.isBirdEye

        const board = this.game.board
        const centroid = board ? board.getCentroid() : null
        const cam = this.game.camera

        if (this.isBirdEye) {
            // Save ground position
            this.savedWalkPos = {
                x: cam.position.x,
                z: cam.position.z,
            }
            // Elevate and aim at the middle of the uncovered region.
            const tx = centroid ? centroid.x : cam.position.x
            const tz = centroid ? centroid.z : cam.position.z
            cam.position.set(tx, this.birdEyeHeight + this.heightOffset, tz + 220)
            cam.lookAt(new Vector3(tx, 0, tz))
        } else {
            // Restore ground position with a proper downward pitch toward
            // the nearby walkable tiles.
            cam.position.set(this.savedWalkPos.x, this.walkHeight + this.heightOffset, this.savedWalkPos.z)
            this.aimAtNearbyGround(this.savedWalkPos.x, this.savedWalkPos.z)
        }
    }

    private initControls(): void {
        window.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault()
        })
    }

    public update(delta: number): void {
        if (!this.controls.isLocked) return

        const speed = (this.keys["ShiftLeft"] || this.keys["ShiftRight"])
            ? this.sprintingSpeed
            : this.walkingSpeed

        const cam = this.game.camera
        const oldX = cam.position.x
        const oldZ = cam.position.z

        if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
            this.controls.moveForward(speed)
        }
        if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
            this.controls.moveForward(-speed)
        }
        if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
            this.controls.moveRight(-speed)
        }
        if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
            this.controls.moveRight(speed)
        }

        // Keep the player near the uncovered area. Try the full move, then
        // each axis on its own, so sliding along the edge still works.
        // In bird's-eye mode the camera is free to move.
        if (!this.isBirdEye) {
            const board = this.game.board
            const nx = cam.position.x
            const nz = cam.position.z
            if (!board.isWorldAccessible(nx, nz)) {
                if (board.isWorldAccessible(nx, oldZ)) {
                    cam.position.z = oldZ
                } else if (board.isWorldAccessible(oldX, nz)) {
                    cam.position.x = oldX
                } else {
                    cam.position.x = oldX
                    cam.position.z = oldZ
                }
            }
        }

        // E raises the camera, Q lowers it. Clamp to a sane range.
        const raise = (this.keys["KeyE"] ? 1 : 0) - (this.keys["KeyQ"] ? 1 : 0)
        this.heightOffset += raise * this.verticalSpeed * delta
        this.heightOffset = Math.max(-3000, Math.min(3000, this.heightOffset))

        const baseHeight = (this.isBirdEye ? this.birdEyeHeight : this.walkHeight) + this.heightOffset
        cam.position.y = Math.max(this.minCamHeight, Math.min(this.maxCamHeight, baseHeight))

        this.player.update(delta)
    }

    private addKeyListeners(): void {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            this.keys[e.code] = true

            if (e.code === "Space") {
                e.preventDefault()
                if (!e.repeat) {
                    this.toggleBirdEye()
                }
            }

            if (e.code === "KeyR") {
                this.game.restart()
            }

            if (e.code === "Escape" && this.game.session.over) {
                this.game.closePopup()
            }
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            this.keys[e.code] = false
        })

        document.addEventListener("mousedown", (e: MouseEvent) => {
            const target = e.target as HTMLElement | null
            if (target && target.closest('#popup')) return
            if (target && target.closest('#floating-restart-btn')) return

            // After a loss, allow looking around the revealed map but keep
            // tile opening and flagging disabled.
            if (this.game.session.over) {
                if (!this.controls.isLocked) {
                    this.controls.lock()
                }
                return
            }

            // If not locked yet, only lock controls and do NOT interact (prevents missclick on focus)
            if (!this.controls.isLocked) {
                this.controls.lock()
                return
            }

            // Only interact with tiles inside the walkable area.
            if (this.player.tileLookedAt) {
                const tile = this.player.tileLookedAt
                if (e.button === 0) {
                    this.game.session.open(tile)
                }
                if (e.button === 2) {
                    this.game.session.toggleFlag(tile)
                }
            }
        })
    }

    public updateSize(): void {
        if (!this.renderer || !this.renderer.domElement) return
        this.game.camera.aspect = window.innerWidth / window.innerHeight
        this.game.camera.updateProjectionMatrix()
    }
}
