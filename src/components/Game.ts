import {
    Scene,
    AmbientLight,
    DirectionalLight,
    Clock,
    PerspectiveCamera,
    LoadingManager
} from 'three'
import Renderer from './Renderer'
import Floor from './board/Floor'
import Board from './board/Board'
import Player from './Player'
import PlayerController from './PlayerController'
import type Tile from './board/Tile'

export default class Game {
    public container: HTMLElement
    public manager: LoadingManager
    public scene!: Scene
    public camera!: PerspectiveCamera
    public renderer!: Renderer
    public clock!: Clock
    public floor!: Floor
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

        const ambientLight = new AmbientLight(0xffffff, 0.85)
        this.scene.add(ambientLight)

        const dirLight = new DirectionalLight(0xffffff, 0.7)
        dirLight.position.set(150, 400, 200)
        this.scene.add(dirLight)

        const aspect = window.innerWidth / window.innerHeight
        this.camera = new PerspectiveCamera(75, aspect, 0.1, 5000)
        this.scene.add(this.camera)

        this.floor = new Floor(700, 700)
        this.scene.add(this.floor)

        this.board = new Board(this)

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
        if (tile.value === "bomb") {
            this.addPoints(50)
        } else {
            this.addPoints(-75)
        }
        this.updateHUD()

        if (this.board.checkWin()) {
            this.gameWon()
        }
    }

    public onFlagRemoved(tile: Tile): void {
        this.flagsPlaced = Math.max(0, this.flagsPlaced - 1)
        if (tile.value === "bomb") {
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
            const remaining = Math.max(0, this.board.bombsCount - this.flagsPlaced)
            minesEl.innerText = `${remaining} / ${this.board.bombsCount}`
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

    public gameWon(): void {
        this.stopTimer()
        this.board.blockActions = true
        this.board.flagAllBombs()
        this.addPoints(500)

        if (this.playerController && this.playerController.controls) {
            this.playerController.controls.unlock()
        }

        this.showPopup("🎉 VICTORY!", "You safely cleared the entire minefield!", "#22c55e")
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
                <span class="label">Flags Placed</span>
                <span class="value">${this.flagsPlaced} / ${this.board.bombsCount}</span>
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
        this.playerController.resetPosition()
        this.updateHUD()

        const changeContainer = document.getElementById("pointsChangeContainer")
        if (changeContainer) changeContainer.innerHTML = ""
    }

    public render(): void {
        const delta = this.clock.getDelta()
        this.playerController.update(delta)
        this.renderer.render(this.scene, this.camera)
        requestAnimationFrame(this.render.bind(this))
    }
}
