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
import Session from './Session'
import type { SessionState, SessionView } from './Session'

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

export default class Game implements SessionView {
    public container: HTMLElement
    public manager: LoadingManager
    public scene!: Scene
    public camera!: PerspectiveCamera
    public renderer!: Renderer
    public clock!: Clock
    public horizon!: Horizon
    public board!: Board
    public session!: Session
    public player!: Player
    public playerController!: PlayerController

    constructor(container: HTMLElement) {
        this.container = container
        this.manager = new LoadingManager()

        this.createWorld()
        this.renderSession(this.session.getState(), 0)
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

        this.session = new Session(this.board, this)

        this.player = new Player(this)
        this.playerController = new PlayerController(this)
    }

    public renderSession(state: SessionState, scoreDelta: number): void {
        const pointsEl = document.getElementById("points")
        if (pointsEl) {
            pointsEl.innerText = state.points.toString()
        }

        const minesEl = document.getElementById("minesCount")
        if (minesEl) {
            minesEl.innerText = `${state.opened}`
        }

        const timeEl = document.getElementById("timeCount")
        if (timeEl) {
            timeEl.innerText = `${state.time}s`
        }

        if (scoreDelta === 0) return

        const container = document.getElementById("pointsChangeContainer")
        if (container) {
            container.innerHTML = ""
            const badge = document.createElement("div")
            badge.id = "pointsChange"
            badge.innerText = (scoreDelta > 0 ? "+" : "") + scoreDelta
            badge.style.color = scoreDelta > 0 ? "#4ade80" : "#f87171"
            container.appendChild(badge)

            setTimeout(() => {
                badge.classList.add("hidden")
            }, 800)
        }
    }

    public showGameOver(_state: SessionState): void {
        if (this.playerController && this.playerController.controls) {
            this.playerController.controls.unlock()
        }

        this.showPopup("💥 GAME OVER", "You triggered a mine!", "#ef4444")
    }

    public showPopup(title: string, subtitle: string, accentColor: string): void {
        const existing = document.getElementById("popup")
        if (existing) existing.remove()

        const state = this.session.getState()

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
                <span class="value" style="color: ${state.points >= 0 ? '#4ade80' : '#f87171'}">${state.points}</span>
            </div>
            <div class="popup-stat-box">
                <span class="label">Time</span>
                <span class="value">${state.time}s</span>
            </div>
            <div class="popup-stat-box">
                <span class="label">Tiles Cleared</span>
                <span class="value">${state.opened}</span>
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

        this.board.restart()
        this.horizon.reseed()
        this.playerController.resetPosition()
        this.session.restart()

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
