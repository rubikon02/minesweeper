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
    public savedWalkPos: { x: number; z: number } = { x: 0, z: 240 }

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
        this.savedWalkPos = { x: 0, z: 240 }
        this.game.camera.position.set(0, this.walkHeight, 240)
        this.game.camera.lookAt(new Vector3(0, this.walkHeight - 20, 100))
    }

    public toggleBirdEye(): void {
        this.isBirdEye = !this.isBirdEye

        if (this.isBirdEye) {
            // Save ground position
            this.savedWalkPos = {
                x: this.game.camera.position.x,
                z: this.game.camera.position.z,
            }
            // Elevate to fixed bird's-eye view looking down towards board center
            this.game.camera.position.set(0, this.birdEyeHeight + this.heightOffset, 220)
            this.game.camera.lookAt(new Vector3(0, 0, 0))
        } else {
            // Restore ground position with proper forward/downward pitch
            this.game.camera.position.set(this.savedWalkPos.x, this.walkHeight + this.heightOffset, this.savedWalkPos.z)
            this.game.camera.lookAt(new Vector3(this.savedWalkPos.x, this.walkHeight + this.heightOffset - 20, this.savedWalkPos.z - 100))
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

        // E raises the camera, Q lowers it. Clamp to a sane range.
        const raise = (this.keys["KeyE"] ? 1 : 0) - (this.keys["KeyQ"] ? 1 : 0)
        this.heightOffset += raise * this.verticalSpeed * delta
        this.heightOffset = Math.max(-3000, Math.min(3000, this.heightOffset))

        const baseHeight = (this.isBirdEye ? this.birdEyeHeight : this.walkHeight) + this.heightOffset
        this.game.camera.position.y = Math.max(this.minCamHeight, Math.min(this.maxCamHeight, baseHeight))

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
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            this.keys[e.code] = false
        })

        document.addEventListener("mousedown", (e: MouseEvent) => {
            const target = e.target as HTMLElement | null
            if (target && target.closest('#popup')) return
            if (this.game.board && this.game.board.blockActions) return

            // If not locked yet, only lock controls and do NOT interact (prevents missclick on focus)
            if (!this.controls.isLocked) {
                this.controls.lock()
                return
            }

            // Only interact when controls are already locked
            if (this.player.tileLookedAt) {
                if (e.button === 0) {
                    this.player.tileLookedAt.open()
                }
                if (e.button === 2) {
                    this.player.tileLookedAt.toggleFlag()
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
