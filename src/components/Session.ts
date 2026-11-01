import type Board from './board/Board'
import type Tile from './board/Tile'

export interface SessionState {
    points: number
    time: number
    flagsPlaced: number
    opened: number
    over: boolean
}

export interface SessionView {
    renderSession(state: SessionState, scoreDelta: number): void
    showGameOver(state: SessionState): void
}

// One deep rules module: open, flag, scoring, timer, progress and game over.
// The view only receives snapshots; the rules never touch the DOM.
export default class Session {
    public board: Board
    public view: SessionView

    public points = 0
    public time = 0
    public flagsPlaced = 0
    public over = false

    private timerInterval: ReturnType<typeof setInterval> | null = null

    constructor(board: Board, view: SessionView) {
        this.board = board
        this.view = view
    }

    public getState(): SessionState {
        return {
            points: this.points,
            time: this.time,
            flagsPlaced: this.flagsPlaced,
            opened: this.board.opened.size,
            over: this.over,
        }
    }

    public open(tile: Tile): void {
        if (this.over) return
        if (!this.board.isTileAccessible(tile.x, tile.z)) return
        if (tile.flag.isVisible() || tile.isOpen()) return

        // The first click chooses a safe 3x3 area and starts the clock.
        if (!this.board.started) {
            this.board.ensureStarted(tile.x, tile.z)
            this.startTimer()
        }

        tile.computeValue()
        tile.reveal()

        if (tile.value === 'bomb') {
            this.award(-250)
            this.gameOver()
            return
        }

        if (tile.value === 'empty') {
            this.award(1)
            this.floodOpen(tile)
        } else {
            this.award(tile.value as number)
        }
    }

    public toggleFlag(tile: Tile): void {
        if (this.over) return
        if (!this.board.isTileAccessible(tile.x, tile.z)) return
        if (tile.isOpen()) return

        if (tile.flag.isVisible()) {
            tile.flag.setVisible(false)
            this.board.removeFlag(tile.x, tile.z)
            this.flagsPlaced = Math.max(0, this.flagsPlaced - 1)
            this.award(this.isBombTile(tile) ? -50 : 75)
        } else {
            tile.flag.setVisible(true)
            this.board.addFlag(tile.x, tile.z)
            this.flagsPlaced++
            this.award(this.isBombTile(tile) ? 50 : -75)
        }
        this.render(0)
    }

    public restart(): void {
        this.stopTimer()
        this.points = 0
        this.time = 0
        this.flagsPlaced = 0
        this.over = false
        this.render(0)
    }

    private isBombTile(tile: Tile): boolean {
        return tile.value === 'bomb' || this.board.isBomb(tile.x, tile.z)
    }

    private award(difference: number): void {
        this.points += difference
        this.render(difference)
    }

    // Expand through connected empty tiles, scoring as it goes.
    private floodOpen(origin: Tile): void {
        const stack: Tile[] = [origin]
        while (stack.length > 0) {
            const tile = stack.pop()!
            for (const neighbour of tile.getNeighbours()) {
                if (neighbour.isOpen() || neighbour.flag.isVisible()) continue
                neighbour.computeValue()
                neighbour.reveal()

                if (neighbour.value === 'empty') {
                    this.award(1)
                    stack.push(neighbour)
                } else if (neighbour.value !== 'bomb') {
                    this.award(neighbour.value as number)
                }
            }
        }
    }

    private gameOver(): void {
        this.over = true
        this.stopTimer()
        this.board.revealAllBombs()
        this.view.showGameOver(this.getState())
    }

    private startTimer(): void {
        if (this.timerInterval) return
        this.time = 0
        this.timerInterval = setInterval(() => {
            this.time++
            this.render(0)
        }, 1000)
    }

    private stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval)
            this.timerInterval = null
        }
    }

    private render(scoreDelta: number): void {
        this.view.renderSession(this.getState(), scoreDelta)
    }
}
