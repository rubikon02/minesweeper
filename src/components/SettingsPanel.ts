import { MARKER_VALUES, cloneConfig, loadActiveConfig, saveActiveConfig } from './board/markers/MarkerConfig'
import { getShape } from './board/markers/MarkerCatalog'
import { drawPreview } from './board/markers/preview'
import { defaultCount } from './board/markers/MarkerConfig'
import type { MarkerConfig, MarkerValue } from './board/markers/MarkerConfig'
import type Game from './Game'

interface DragState {
    source: MarkerValue
    pointerId: number
    startX: number
    startY: number
    active: boolean
    target: MarkerValue | null
    ghost: HTMLElement | null
}

function query<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector)
    if (!element) throw new Error(`SettingsPanel: missing ${selector}`)
    return element
}

function countLabel(count: number): string {
    if (count === 1) return '1 element'
    if (count >= 2 && count <= 4) return `${count} elementy`
    return `${count} elementów`
}

function valueLabel(value: MarkerValue): string {
    return value === 'bomb' ? 'bomba' : `${value}`
}

// dataset values are strings; converting here keeps Map keys numeric and
// prevents a silent no-op when updating the swapped rows.
function parseMarkerValue(raw: string | undefined): MarkerValue | null {
    if (!raw) return null
    if (raw === 'bomb') return 'bomb'
    const parsed = Number(raw)
    return MARKER_VALUES.some(value => value === parsed) ? parsed as MarkerValue : null
}

// Editing happens only before a run. In-game the same panel is a read-only
// summary with a single action: start a new game to change the arrangement.
export default class SettingsPanel {
    private game: Game
    private root!: HTMLElement
    private list!: HTMLElement
    private status!: HTMLElement
    private startButton!: HTMLButtonElement
    private changeButton!: HTMLButtonElement
    private hint!: HTMLElement
    private title!: HTMLElement
    private rows = new Map<MarkerValue, HTMLElement>()

    private draft: MarkerConfig
    private editable = false
    private drag: DragState | null = null
    private keyboardSource: MarkerValue | null = null
    private keyboardTarget: MarkerValue | null = null
    private statusTimer: number | null = null

    public isOpen = false

    constructor(game: Game) {
        this.game = game
        this.draft = cloneConfig(loadActiveConfig())
        this.build()
        this.bind()
    }

    private build(): void {
        const root = document.createElement('div')
        root.id = 'settings'
        root.className = 'settings-overlay'
        root.setAttribute('role', 'dialog')
        root.setAttribute('aria-modal', 'true')
        root.innerHTML = `
            <div class="settings-card">
                <div class="settings-head">
                    <div>
                        <div class="settings-eyebrow">MARKER STUDIO</div>
                        <h2 id="settings-title">Ustawienia markerów</h2>
                    </div>
                    <button id="settings-close" class="settings-icon-btn" title="Zamknij" aria-label="Zamknij">×</button>
                </div>
                <p id="settings-hint" class="settings-hint"></p>
                <div id="settings-list" class="settings-list"></div>
                <div class="settings-footer">
                    <span id="settings-status" class="settings-status"></span>
                    <div class="settings-actions">
                        <button id="settings-change" class="settings-btn secondary">Zmień przy nowej grze</button>
                        <button id="settings-start" class="settings-btn primary">Rozpocznij grę</button>
                    </div>
                </div>
            </div>
        `
        document.body.appendChild(root)

        this.root = root
        this.list = query<HTMLElement>(root, '#settings-list')
        this.status = query<HTMLElement>(root, '#settings-status')
        this.startButton = query<HTMLButtonElement>(root, '#settings-start')
        this.changeButton = query<HTMLButtonElement>(root, '#settings-change')
        this.hint = query<HTMLElement>(root, '#settings-hint')
        this.title = query<HTMLElement>(root, '#settings-title')

        for (const value of MARKER_VALUES) {
            const row = this.createRow(value)
            this.rows.set(value, row)
            this.list.appendChild(row)
        }
    }

    private createRow(value: MarkerValue): HTMLElement {
        const row = document.createElement('div')
        row.className = 'settings-row'
        row.dataset.value = String(value)
        row.tabIndex = 0
        row.innerHTML = `
            <span class="drag-handle" title="Przeciągnij, aby zamienić miejsca">::</span>
            <span class="value-badge"></span>
            <canvas class="marker-preview" width="44" height="44"></canvas>
            <div class="row-main">
                <div class="row-line">
                    <span class="row-name"></span>
                    <span class="row-count"></span>
                </div>
            </div>
        `

        query<HTMLElement>(row, '.value-badge').textContent = value === 'bomb' ? 'B' : String(value)
        query<HTMLElement>(row, '.drag-handle').addEventListener('pointerdown', (event) => this.startDrag(event, value))
        return row
    }

    private bind(): void {
        query<HTMLButtonElement>(this.root, '#settings-close').addEventListener('click', () => this.close())
        this.startButton.addEventListener('click', () => {
            if (this.editable) this.start()
            else this.close()
        })
        this.changeButton.addEventListener('click', () => this.openEditable())

        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openReadOnly())
        document.addEventListener('keydown', this.onKeyDown)
        document.addEventListener('pointermove', this.onPointerMove)
        document.addEventListener('pointerup', this.onPointerUp)
        document.addEventListener('pointercancel', this.onPointerUp)
    }

    public openEditable(): void {
        this.editable = true
        this.draft = cloneConfig(this.game.board?.markerConfig ?? loadActiveConfig())
        this.show()
    }

    public openReadOnly(): void {
        if (this.game.session?.over) {
            this.openEditable()
            return
        }
        this.editable = false
        this.draft = cloneConfig(this.game.board.markerConfig)
        this.show()
    }

    private show(): void {
        this.cleanupDrag()
        this.keyboardSource = null
        this.keyboardTarget = null
        this.root.style.display = 'flex'
        this.isOpen = true
        this.root.classList.toggle('read-only', !this.editable)
        this.game.playerController?.controls.unlock()
        this.renderRows()
        this.updateMode()
        this.flash('')
    }

    private hide(): void {
        this.cleanupDrag()
        this.root.style.display = 'none'
        this.isOpen = false
    }

    private updateMode(): void {
        if (this.editable) {
            this.title.textContent = 'Ustawienia markerów'
            this.hint.textContent = 'Przeciągnij wiersz, aby zamienić motywy. Liczba obiektów jest ustawiana automatycznie według wartości pola.'
            this.startButton.textContent = 'Rozpocznij grę'
            this.changeButton.hidden = true
        } else {
            this.title.textContent = 'Aktualne markery'
            this.hint.textContent = 'Ustawienia są blokowane w trakcie gry. Zmień je przy nowej grze – wynik i czas zostaną wyzerowane.'
            this.startButton.textContent = 'Zamknij'
            this.changeButton.hidden = false
        }
    }

    private renderRows(): void {
        for (const value of MARKER_VALUES) this.updateRow(value)
    }

    private updateRow(value: MarkerValue): void {
        const row = this.rows.get(value)
        if (!row) return
        const selection = this.draft.perValue[value]
        query<HTMLElement>(row, '.row-name').textContent = getShape(selection.shape).label
        query<HTMLElement>(row, '.row-count').textContent = countLabel(defaultCount(value))
        row.classList.toggle('is-bomb', value === 'bomb')
        row.classList.toggle('locked', !this.editable)

        drawPreview(query<HTMLCanvasElement>(row, '.marker-preview'), selection.shape, value)
    }

    private start(): void {
        const config = cloneConfig(this.draft)
        this.hide()
        this.game.startWithConfig(config)
    }

    private close(): void {
        if (this.editable) {
            this.start()
            return
        }
        this.hide()
        this.game.playerController.controls.lock()
    }

    private swapAssignments(a: MarkerValue, b: MarkerValue): void {
        if (a === b) return
        const first = this.draft.perValue[a]
        const second = this.draft.perValue[b]
        const shape = first.shape
        first.shape = second.shape
        second.shape = shape

        saveActiveConfig(this.draft)
        this.updateRow(a)
        this.updateRow(b)
        this.flash(`Zamieniono ${valueLabel(a)} i ${valueLabel(b)}`)
    }

    private startDrag(event: PointerEvent, value: MarkerValue): void {
        if (!this.editable) return
        event.preventDefault()
        const handle = event.currentTarget as HTMLElement
        // Pointer capture is best-effort: synthetic events and some browsers
        // reject it, but document-level listeners still finish the drag.
        try {
            handle.setPointerCapture(event.pointerId)
        } catch {
            // Ignore; the drag remains usable through document listeners.
        }
        this.drag = {
            source: value,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            target: null,
            ghost: null,
        }
    }

    private onPointerMove = (event: PointerEvent): void => {
        const drag = this.drag
        if (!drag || event.pointerId !== drag.pointerId) return

        if (!drag.active) {
            const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
            if (distance < 5) return
            drag.active = true
            const sourceRow = this.rows.get(drag.source)!
            sourceRow.classList.add('dragging')
            document.body.classList.add('settings-dragging')

            const ghost = sourceRow.cloneNode(true) as HTMLElement
            ghost.classList.add('settings-ghost')
            ghost.style.width = `${sourceRow.getBoundingClientRect().width}px`
            // Canvas contents are not cloned, so repaint the preview.
            drawPreview(
                query<HTMLCanvasElement>(ghost, '.marker-preview'),
                this.draft.perValue[drag.source].shape,
                drag.source
            )
            document.body.appendChild(ghost)
            drag.ghost = ghost
        }

        if (drag.ghost) {
            drag.ghost.style.left = `${event.clientX + 14}px`
            drag.ghost.style.top = `${event.clientY - 20}px`
        }

        this.autoScrollList(event.clientY)
        const hovered = document.elementFromPoint(event.clientX, event.clientY)
        const targetRow = hovered?.closest<HTMLElement>('.settings-row')
        const target = parseMarkerValue(targetRow?.dataset.value)
        if (drag.target !== target) {
            this.clearDropTarget()
            drag.target = target
            if (target !== null && target !== drag.source) targetRow?.classList.add('drop-target')
        }
    }

    // Keep every destination row reachable without pausing the drag.
    private autoScrollList(clientY: number): void {
        const rect = this.list.getBoundingClientRect()
        const edge = 40
        if (clientY < rect.top + edge) {
            this.list.scrollTop -= 14
        } else if (clientY > rect.bottom - edge) {
            this.list.scrollTop += 14
        }
    }

    private onPointerUp = (event: PointerEvent): void => {
        const drag = this.drag
        if (!drag || event.pointerId !== drag.pointerId) return
        const { source, target, active } = drag
        this.cleanupDrag()

        if (!active || !target || target === source) return
        this.swapAssignments(source, target)
    }

    private cleanupDrag(): void {
        this.clearDropTarget()
        this.rows.forEach(row => row.classList.remove('dragging'))
        document.body.classList.remove('settings-dragging')
        if (this.drag?.ghost) this.drag.ghost.remove()
        this.drag = null
    }

    private clearDropTarget(): void {
        this.rows.forEach(row => row.classList.remove('drop-target', 'keyboard-target'))
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        if (!this.isOpen) {
            if (event.code === 'KeyO') {
                event.preventDefault()
                if (this.game.session?.over) this.openEditable()
                else this.openReadOnly()
            }
            return
        }

        if (event.code === 'Escape') {
            event.preventDefault()
            if (this.drag) this.cleanupDrag()
            else this.close()
            return
        }
        if (!this.editable) return

        const active = document.activeElement as HTMLElement | null
        if (active && ['INPUT', 'SELECT', 'BUTTON'].includes(active.tagName)) return

        if (event.code === 'KeyO') {
            event.preventDefault()
            this.start()
            return
        }

        if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
            event.preventDefault()
            const current = this.keyboardTarget ?? MARKER_VALUES[0]
            const index = MARKER_VALUES.indexOf(current)
            const next = Math.max(0, Math.min(MARKER_VALUES.length - 1, index + (event.code === 'ArrowUp' ? -1 : 1)))
            this.keyboardTarget = MARKER_VALUES[next]
            this.clearDropTarget()
            this.rows.get(this.keyboardTarget)?.classList.add('keyboard-target')
            return
        }

        if (event.code === 'Space') {
            event.preventDefault()
            if (this.keyboardSource === null) {
                this.keyboardSource = this.keyboardTarget ?? MARKER_VALUES[0]
                this.rows.get(this.keyboardSource)?.classList.add('dragging')
                this.flash(`Wybrano ${valueLabel(this.keyboardSource)} – strzałkami wybierz cel, Space zamień`)
                return
            }
            const source = this.keyboardSource
            const target = this.keyboardTarget ?? source
            this.keyboardSource = null
            this.keyboardTarget = null
            this.rows.forEach(row => row.classList.remove('dragging'))
            this.clearDropTarget()
            this.swapAssignments(source, target)
        }
    }

    private flash(message: string): void {
        this.status.textContent = message
        if (this.statusTimer !== null) window.clearTimeout(this.statusTimer)
        if (message) {
            this.statusTimer = window.setTimeout(() => {
                this.status.textContent = ''
                this.statusTimer = null
            }, 2600)
        }
    }
}
