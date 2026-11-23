import { Euler, Vector3, Scene } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type Game from './Game'
import type Renderer from './Renderer'
import type Player from './Player'

const forwardAxis = new Vector3()
const rightAxis = new Vector3()
const yawEuler = new Euler(0, 0, 0, 'YXZ')

export default class PlayerController {
    public game: Game
    public renderer: Renderer
    public scene: Scene
    public player: Player
    public controls: PointerLockControls

    // World units per second. PointerLockControls.moveForward takes a
    // per-frame distance, so movement used to change with the frame rate.
    public walkingSpeed = 90
    public sprintingSpeed = 140
    public readonly maxStep = 6

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
        // lookAt changes the quaternion; PointerLockControls reads the local
        // matrix directly, so refresh it before the first movement step.
        this.game.camera.updateMatrix()
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
            cam.updateMatrix()
        } else {
            // Restore ground position with a proper downward pitch toward
            // the nearby walkable tiles.
            cam.position.set(this.savedWalkPos.x, this.walkHeight + this.heightOffset, this.savedWalkPos.z)
            this.aimAtNearbyGround(this.savedWalkPos.x, this.savedWalkPos.z)
            cam.updateMatrix()
        }
    }

    private initControls(): void {
        window.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault()
        })
    }

    public update(delta: number): void {
        if (!this.controls.isLocked) return

        // A long frame after a tab switch must not teleport the player.
        const stepTime = Math.min(Math.max(delta, 0), 0.05)
        const speed = (this.keys["ShiftLeft"] || this.keys["ShiftRight"])
            ? this.sprintingSpeed
            : this.walkingSpeed

        const cam = this.game.camera
        // PointerLockControls.moveForward/moveRight read camera.matrix, which
        // the renderer only refreshes at the end of the frame. Derive the
        // directions from the live quaternion so a fast mouse turn is not one
        // frame behind the movement.
        yawEuler.setFromQuaternion(cam.quaternion, 'YXZ')
        forwardAxis.set(-Math.sin(yawEuler.y), 0, -Math.cos(yawEuler.y))
        rightAxis.crossVectors(forwardAxis, cam.up).normalize()

        let dx = 0
        let dz = 0
        const push = (axis: Vector3, amount: number): void => {
            dx += axis.x * amount
            dz += axis.z * amount
        }
        if (this.keys["KeyW"] || this.keys["ArrowUp"]) push(forwardAxis, speed * stepTime)
        if (this.keys["KeyS"] || this.keys["ArrowDown"]) push(forwardAxis, -speed * stepTime)
        if (this.keys["KeyD"] || this.keys["ArrowRight"]) push(rightAxis, speed * stepTime)
        if (this.keys["KeyA"] || this.keys["ArrowLeft"]) push(rightAxis, -speed * stepTime)

        if (dx !== 0 || dz !== 0) {
            const board = this.game.board
            const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / this.maxStep))
            const sx = dx / steps
            const sz = dz / steps

            // Clamp every small step separately and keep the last valid
            // position. Rewinding to the start of the frame made the camera
            // visibly jump back whenever a tile edge was crossed.
            for (let i = 0; i < steps; i++) {
                const nx = cam.position.x + sx
                const nz = cam.position.z + sz
                if (this.isBirdEye || board.isWorldAccessible(nx, nz)) {
                    cam.position.x = nx
                    cam.position.z = nz
                    continue
                }
                if (this.isBirdEye || board.isWorldAccessible(nx, cam.position.z)) cam.position.x = nx
                if (this.isBirdEye || board.isWorldAccessible(cam.position.x, nz)) cam.position.z = nz
            }
        }

        // E raises the camera, Q lowers it. The floor follows the terrain so
        // the camera can never end up underneath the map on a mountain.
        const raise = (this.keys["KeyE"] ? 1 : 0) - (this.keys["KeyQ"] ? 1 : 0)
        this.heightOffset += raise * this.verticalSpeed * stepTime
        this.heightOffset = Math.max(-3000, Math.min(3000, this.heightOffset))

        const base = this.isBirdEye ? this.birdEyeHeight : this.walkHeight
        const ground = this.game.board.terrain.heightAtWorld(cam.position.x, cam.position.z)
        const floor = ground + (this.isBirdEye ? 120 : this.minCamHeight + 25)
        let height = base + this.heightOffset
        if (height < floor) {
            height = floor
            // Keep the manual offset in sync, otherwise Q keeps fighting the
            // clamp and E appears to do nothing until the offset recovers.
            this.heightOffset = height - base
        }
        cam.position.y = Math.min(this.maxCamHeight, height)
        cam.updateMatrix()

        this.player.update(delta)
    }

    private addKeyListeners(): void {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            // The settings overlay owns input while it is visible.
            if (this.game.settingsPanel?.isOpen) {
                this.keys[e.code] = false
                return
            }

            this.keys[e.code] = true

            if (e.code === "Space") {
                e.preventDefault()
                if (!e.repeat) this.toggleBirdEye()
            }

            if (e.code === "KeyR" && !e.repeat) {
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
            // A focused button turns the next Space press into a click, which
            // used to restart the run (and teleport the camera) mid-walk.
            const button = target?.closest('button') as HTMLElement | null
            if (button) button.blur()
            if (target && target.closest('#popup')) return
            if (target && target.closest('#settings')) return
            if (target && target.closest('#settingsBtn')) return
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
