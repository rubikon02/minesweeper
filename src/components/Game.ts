import {
    Scene,
    AmbientLight,
    HemisphereLight,
    DirectionalLight,
    Clock,
    PerspectiveCamera,
    LoadingManager,
    Fog,
    Color,
    CanvasTexture
} from 'three'
import Renderer from './Renderer'
import Horizon from './board/Horizon'
import Board from './board/Board'
import Player from './Player'
import PlayerController from './PlayerController'
import type Tile from './board/Tile'

// Simple vertical gradient used as the sky backdrop.
function createSkyTexture(): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#7fb2e5')
    gradient.addColorStop(0.5, '#bcd9ef')
    gradient.addColorStop(1, '#e7f0e3')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 2, 256)
    const texture = new CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
}

export default class Game {
    public container: HTMLElement
    public manager: LoadingManager
    public scene!: Scene
    public camera!: PerspectiveCamera
    public renderer!: Renderer
    public clock!: Clock
    public horizon!: Horizon
    public board!: Board
    public player!: Player
    public playerController!: PlayerController

    public points = 0
    public timer = 0
    public timerInterval: ReturnType<typeof setInterval> | null = null
    public flagsPlaced = 0

    constructor(container: HTMLElement) {
        this.container = container
        this.manager = new LoadingManager()

        this.createWorld()
        this.updateHUD()
        this.render()
    }

    public createWorld(): void {
        this.clock = new Clock()
        this.scene = new Scene()

        this.renderer = new Renderer()
        this.container.appendChild(this.renderer.domElement)

        const skyColor = new Color('#bcd9ef')
        this.scene.background = createSkyTexture()
        this.scene.fog = new Fog(skyColor, 1200, 3800)

        const hemiLight = new HemisphereLight(0xbcd9ef, 0x556b3f, 0.9)
        this.scene.add(hemiLight)

        const ambientLight = new AmbientLight(0xffffff, 0.35)
        this.scene.add(ambientLight)

        const dirLight = new DirectionalLight(0xfff3e0, 1.1)
        dirLight.position.set(150, 400, 200)
        this.scene.add(dirLight)

        const aspect = window.innerWidth / window.innerHeight
        // Far plane reaches past the horizon ring so it never clips.
        this.camera = new PerspectiveCamera(75, aspect, 1, 12000)
        this.scene.add(this.camera)

        this.board = new Board(this)
        this.horizon = new Horizon(this.board)
        // this.scene.add(this.horizon)

        this.player = new Player(this)
        this.playerController = new PlayerController(this)
    }

    public startTimer(): void {
        if (this.timerInterval) return
        this.timer = 0
        this.timerInterval = setInterval(() => {
            this.timer++
            const timeEl = document.getElementById("timeCount")
            if (timeEl) {
                timeEl.innerText = `${this.timer}s`
            }
        }, 1000)
    }

    public stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval)
            this.timerInterval = null
        }
    }

    public addPoints(difference: number): void {
        this.points += difference

        const pointsEl = document.getElementById("points")
        if (pointsEl) {
            pointsEl.innerText = this.points.toString()
        }

        const container = document.getElementById("pointsChangeContainer")
        if (container) {
            container.innerHTML = ""
            const badge = document.createElement("div")
            badge.id = "pointsChange"
            badge.innerText = (difference > 0 ? "+" : "") + difference
            badge.style.color = difference > 0 ? "#4ade80" : "#f87171"
            container.appendChild(badge)

            setTimeout(() => {
                badge.classList.add("hidden")
            }, 800)
        }
    }

    public onFlagPlaced(tile: Tile): void {
        this.flagsPlaced++
        this.board.addFlag(tile.x, tile.z)
        if (tile.value === "bomb" || this.board.isBomb(tile.x, tile.z)) {
            this.addPoints(50)
        } else {
            this.addPoints(-75)
        }
        this.updateHUD()
    }

    public onFlagRemoved(tile: Tile): void {
        this.flagsPlaced = Math.max(0, this.flagsPlaced - 1)
        this.board.removeFlag(tile.x, tile.z)
        if (tile.value === "bomb" || this.board.isBomb(tile.x, tile.z)) {
            this.addPoints(-50)
        } else {
            this.addPoints(75)
        }
        this.updateHUD()
    }

    public updateHUD(): void {
        const pointsEl = document.getElementById("points")
        if (pointsEl) {
            pointsEl.innerText = this.points.toString()
        }

        const minesEl = document.getElementById("minesCount")
        if (minesEl && this.board) {
            minesEl.innerText = `${this.board.opened.size}`
        }

        const timeEl = document.getElementById("timeCount")
        if (timeEl) {
            timeEl.innerText = `${this.timer}s`
        }
    }

    public gameOver(_explodedTile: Tile): void {
        this.stopTimer()
        this.board.blockActions = true
        this.board.revealAllBombs()

        if (this.playerController && this.playerController.controls) {
            this.playerController.controls.unlock()
        }

        this.showPopup("💥 GAME OVER", "You triggered a mine!", "#ef4444")
    }

    public showPopup(title: string, subtitle: string, accentColor: string): void {
        const existing = document.getElementById("popup")
        if (existing) existing.remove()

        const popup = document.createElement("div")
        popup.id = "popup"

        const card = document.createElement("div")
        card.id = "popup-content"

        const titleEl = document.createElement("h2")
        titleEl.id = "popup-title"
        titleEl.innerText = title
        titleEl.style.color = accentColor
        card.appendChild(titleEl)

        const subEl = document.createElement("p")
        subEl.id = "popup-subtitle"
        subEl.innerText = subtitle
        card.appendChild(subEl)

        const statsGrid = document.createElement("div")
        statsGrid.id = "popup-stats"
        statsGrid.innerHTML = `
            <div class="popup-stat-box">
                <span class="label">Final Score</span>
                <span class="value" style="color: ${this.points >= 0 ? '#4ade80' : '#f87171'}">${this.points}</span>
            </div>
            <div class="popup-stat-box">
                <span class="label">Time</span>
                <span class="value">${this.timer}s</span>
            </div>
            <div class="popup-stat-box">
                <span class="label">Tiles Cleared</span>
                <span class="value">${this.board.opened.size}</span>
            </div>
        `
        card.appendChild(statsGrid)

        const restartBtn = document.createElement("button")
        restartBtn.id = "popup-restart-btn"
        restartBtn.innerText = "Play Again (R)"
        restartBtn.onclick = () => this.restart()
        card.appendChild(restartBtn)

        popup.appendChild(card)
        document.body.appendChild(popup)
    }

    public restart(): void {
        const popup = document.getElementById("popup")
        if (popup) popup.remove()

        this.stopTimer()
        this.timer = 0
        this.points = 0
        this.flagsPlaced = 0

        this.board.restart()
        this.horizon.reseed()
        this.playerController.resetPosition()
        this.updateHUD()

        const changeContainer = document.getElementById("pointsChangeContainer")
        if (changeContainer) changeContainer.innerHTML = ""
    }

    public render(): void {
        const delta = this.clock.getDelta()
        this.playerController.update(delta)
        this.board.update(this.camera.position.x, this.camera.position.z, delta)
        this.horizon.update(this.camera.position.x, this.camera.position.z)
        this.renderer.render(this.scene, this.camera)
        requestAnimationFrame(this.render.bind(this))
    }
}
