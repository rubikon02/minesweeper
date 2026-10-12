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

    // Player height: raised to 85 so player comfortably overlooks the tiles
    public readonly walkHeight = 85
    public readonly birdEyeHeight = 540

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
            this.game.camera.position.set(0, this.birdEyeHeight, 220)
            this.game.camera.lookAt(new Vector3(0, 0, 0))
        } else {
            // Restore ground position with proper forward/downward pitch
            this.game.camera.position.set(this.savedWalkPos.x, this.walkHeight, this.savedWalkPos.z)
            this.game.camera.lookAt(new Vector3(this.savedWalkPos.x, this.walkHeight - 20, this.savedWalkPos.z - 100))
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

        // Strict fixed elevation for each mode: no flying up/down, C does nothing
        this.game.camera.position.y = this.isBirdEye ? this.birdEyeHeight : this.walkHeight

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
