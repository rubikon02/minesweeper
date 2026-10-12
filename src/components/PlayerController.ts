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

    public walkingSpeed = 2.5
    public sprintingSpeed = 6.0
    public verticalSpeed = 2.0

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
        this.game.camera.position.set(0, 80, 240)
        this.game.camera.lookAt(new Vector3(0, 0, 0))
    }

    private initControls(): void {
        document.body.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement | null
            if (target && target.closest('#popup')) return
            if (this.game.board && this.game.board.blockActions) return

            if (!this.controls.isLocked) {
                this.controls.lock()
            }
        })

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

        if (this.keys["Space"] || this.keys["KeyE"]) {
            this.game.camera.position.y = Math.min(500, this.game.camera.position.y + this.verticalSpeed)
        }
        if (this.keys["KeyC"] || this.keys["KeyQ"]) {
            this.game.camera.position.y = Math.max(25, this.game.camera.position.y - this.verticalSpeed)
        }

        this.player.update(delta)
    }

    private addKeyListeners(): void {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            this.keys[e.code] = true

            if (e.code === "KeyR") {
                this.game.restart()
            }
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            this.keys[e.code] = false
        })

        document.addEventListener("mousedown", (e: MouseEvent) => {
            if (this.controls.isLocked && !this.game.board.blockActions) {
                if (e.button === 0) {
                    if (this.player.tileLookedAt) {
                        this.player.tileLookedAt.open()
                    }
                }
                if (e.button === 2) {
                    if (this.player.tileLookedAt) {
                        this.player.tileLookedAt.toggleFlag()
                    }
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
