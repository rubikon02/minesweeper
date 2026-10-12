import { Vector3 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

export default class PlayerController {
    constructor(game) {
        this.game = game
        this.renderer = this.game.renderer
        this.scene = this.game.scene
        this.player = this.game.player

        this.controls = new PointerLockControls(this.game.camera, document.body)

        this.walkingSpeed = 2.5
        this.sprintingSpeed = 6.0
        this.verticalSpeed = 2.0

        this.keys = {}

        this.resetPosition()
        this.initControls()
        this.addKeyListeners()

        this.updateSize()
        window.addEventListener('resize', () => this.updateSize())
    }

    resetPosition() {
        this.game.camera.position.set(0, 80, 240)
        this.game.camera.lookAt(new Vector3(0, 0, 0))
    }

    initControls() {
        document.body.addEventListener('click', e => {
            // Prevent locking if clicking on popup buttons or when game is finished
            if (e.target && e.target.closest('#popup')) return
            if (this.game.board && this.game.board.blockActions) return

            if (!this.controls.isLocked) {
                this.controls.lock()
            }
        })

        // Prevent right click context menu everywhere
        window.addEventListener('contextmenu', e => {
            e.preventDefault()
        })
    }

    update(delta) {
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

        // Vertical movement / elevation
        if (this.keys["Space"] || this.keys["KeyE"]) {
            this.game.camera.position.y = Math.min(500, this.game.camera.position.y + this.verticalSpeed)
        }
        if (this.keys["KeyC"] || this.keys["KeyQ"]) {
            this.game.camera.position.y = Math.max(25, this.game.camera.position.y - this.verticalSpeed)
        }

        this.player.update(delta)
    }

    addKeyListeners() {
        document.addEventListener("keydown", e => {
            this.keys[e.code] = true

            if (e.code === "KeyR") {
                this.game.restart()
            }
        })

        document.addEventListener("keyup", e => {
            this.keys[e.code] = false
        })

        document.addEventListener("mousedown", e => {
            if (this.controls.isLocked && !this.game.board.blockActions) {
                // LMB - Reveal
                if (e.button === 0) {
                    if (this.player.tileLookedAt) {
                        this.player.tileLookedAt.open()
                    }
                }
                // RMB - Toggle Flag
                if (e.button === 2) {
                    if (this.player.tileLookedAt) {
                        this.player.tileLookedAt.toggleFlag()
                    }
                }
            }
        })
    }

    updateSize() {
        if (!this.renderer || !this.renderer.domElement) return
        this.game.camera.aspect = window.innerWidth / window.innerHeight
        this.game.camera.updateProjectionMatrix()
    }
}