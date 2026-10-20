import {
    Vector3,
    BufferGeometry,
    BufferAttribute,
    Mesh,
    PlaneGeometry,
    MeshBasicMaterial,
    TextureLoader,
    NearestFilter,
    Texture
} from 'three'

import Flag from './Flag'
import Fog from './Fog'
import tileTexture from '../../assets/tiles.png'
import type Board from './Board'
import type Terrain from './Terrain'
import type Game from '../Game'

export interface TileMesh extends Mesh {
    parentObject?: Tile
}

// Base atlas texture, loaded once and cloned per tile so each tile can
// point at a different cell of the sprite sheet.
let baseTexture: Texture | null = null

export default class Tile {
    public board: Board
    public terrain: Terrain
    public x: number
    public z: number
    public game: Game
    public value: string | number

    public worldX: number
    public worldZ: number
    public surfaceY: number
    // Highest corner of the tile, used to place icons and clouds above it.
    public maxCornerY: number

    public flag: Flag
    public fog: Fog
    public size: Vector3

    // The sloped terrain surface. Always the raycast / click target.
    public mesh!: TileMesh
    // The number or bomb icon, drawn slightly above the surface.
    public numberMesh!: Mesh
    public texture!: Texture

    private opened = false

    constructor(board: Board, x: number, z: number) {
        this.board = board
        this.terrain = board.terrain
        this.x = x
        this.z = z
        this.game = this.board.game
        this.value = "empty"

        this.worldX = this.terrain.cornerWorldX(x) + board.tileSize / 2
        this.worldZ = this.terrain.cornerWorldZ(z) + board.tileSize / 2
        this.surfaceY = this.terrain.surfaceY(x, z)
        const corners = this.terrain.tileCorners(x, z)
        this.maxCornerY = Math.max(corners.a, corners.b, corners.c, corners.d)

        this.size = new Vector3(board.tileSize, 0, board.tileSize)

        this.createSurfaceMesh()
        this.createNumberMesh()
        this.mesh.position.set(this.worldX, 0, this.worldZ)

        this.flag = new Flag(this)
        this.fog = new Fog(this)
    }

    // Build a sloped quad from the four shared corner heights.
    private createSurfaceMesh(): void {
        const half = this.board.tileSize / 2
        const c = this.terrain.tileCorners(this.x, this.z)

        // Local corner positions: x/z in [-half, half], y = corner height.
        const a = [-half, c.a, -half] // (x,   z)
        const b = [half, c.b, -half]  // (x+1, z)
        const cc = [-half, c.c, half] // (x,   z+1)
        const d = [half, c.d, half]   // (x+1, z+1)

        // Two triangles, wound so the surface faces up.
        const positions = new Float32Array([
            ...a, ...d, ...b,
            ...a, ...cc, ...d,
        ])

        // Continuous UVs in tile units, so the texture tiles seamlessly
        // across neighbouring tiles instead of restarting on each one.
        const x0 = this.x
        const z0 = this.z
        const x1 = this.x + 1
        const z1 = this.z + 1
        const uvs = new Float32Array([
            x0, z0, x1, z1, x1, z0,
            x0, z0, x0, z1, x1, z1,
        ])

        // One flat colour for the whole tile, from height and slope.
        const slope = (Math.max(c.a, c.b, c.c, c.d) - Math.min(c.a, c.b, c.c, c.d)) / this.board.tileSize
        const color = this.terrain.colorFor(this.surfaceY, slope)
        const colors = new Float32Array([
            color.r, color.g, color.b,
            color.r, color.g, color.b,
            color.r, color.g, color.b,
            color.r, color.g, color.b,
        ])

        const geometry = new BufferGeometry()
        geometry.setAttribute("position", new BufferAttribute(positions, 3))
        geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
        geometry.setAttribute("color", new BufferAttribute(colors, 3))
        geometry.computeVertexNormals()

        this.mesh = new Mesh(geometry, this.terrain.material) as TileMesh
        this.mesh.parentObject = this
    }

    private createNumberMesh(): void {
        if (!baseTexture) {
            baseTexture = new TextureLoader().load(tileTexture)
            baseTexture.magFilter = NearestFilter
            baseTexture.minFilter = NearestFilter
            baseTexture.generateMipmaps = false
        }

        this.texture = baseTexture.clone()
        this.texture.needsUpdate = true
        this.texture.magFilter = NearestFilter
        this.texture.minFilter = NearestFilter
        this.texture.generateMipmaps = false
        this.texture.offset.set(0, 0)
        this.texture.repeat.set(0.0625, 1)

        const geometry = new PlaneGeometry(this.board.tileSize * 0.72, this.board.tileSize * 0.72)
        const material = new MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            alphaTest: 0.4,
            depthWrite: false,
        })

        this.numberMesh = new Mesh(geometry, material)
        // Flat above the highest corner, so the sloped terrain or texture
        // can never clip into the icon.
        this.numberMesh.rotation.x = -Math.PI / 2
        this.numberMesh.position.set(0, this.maxCornerY + 1.5, 0)
        this.numberMesh.visible = false
        this.numberMesh.raycast = () => void 0
        this.mesh.add(this.numberMesh)
    }

    public setHover(hovered: boolean): void {
        if (this.opened) return
        this.fog.setHover(hovered)
    }

    public set(name: string | number): void {
        if (typeof name === 'string' && !isNaN(Number(name))) {
            name = parseInt(name)
        }
        this.value = name

        let num = 0
        if (name === "bomb") {
            num = 1
        } else if (typeof name === "number") {
            if (name >= 1 && name <= 8) {
                num = name + 2
            }
        }
        this.texture.offset.x = 0.0625 * num
        this.updateNumberVisibility()
    }

    // True when this tile shows a number or a bomb icon.
    private hasIcon(): boolean {
        return this.value === "bomb" || (typeof this.value === "number" && this.value >= 1)
    }

    // The number / bomb icon is only shown once the tile is revealed.
    private updateNumberVisibility(): void {
        if (!this.numberMesh) return
        this.numberMesh.visible = this.opened && this.hasIcon()
    }

    public getNeighbours(): Tile[] {
        const neighbours: Tile[] = []
        for (let nx = this.x - 1; nx <= this.x + 1; nx++) {
            for (let nz = this.z - 1; nz <= this.z + 1; nz++) {
                if (nx === this.x && nz === this.z) continue
                const tile = this.board.getTile(nx, nz)
                if (tile) {
                    neighbours.push(tile)
                }
            }
        }
        return neighbours
    }

    public toggleFlag(): void {
        if (!this.isOpen()) {
            this.flag.toggle()
        }
    }

    public open(silent = false): void {
        if (this.board.blockActions) return
        if (this.flag.isVisible() || this.isOpen()) return

        if (!this.board.bombsGenerated) {
            this.board.generateBombs(this.x, this.z)
            this.board.setTileValues()
            this.game.startTimer()
        }

        this.reveal()

        if (this.value === "bomb") {
            this.game.addPoints(-250)
            this.game.gameOver(this)
            return
        }

        if (this.value === "empty") {
            this.game.addPoints(1)
            this.openNeighbours()
        } else {
            const num = typeof this.value === 'number' ? this.value : parseInt(this.value) || 0
            this.game.addPoints(num)
        }

        if (this.board.checkWin()) {
            this.game.gameWon()
        }
    }

    // Show the terrain and clear the fog, without any scoring.
    // Instant clears the fog at once (used when all bombs are revealed).
    public reveal(instant = false): void {
        if (this.opened) return
        this.setHover(false)
        this.opened = true
        if (instant) {
            this.fog.hideInstant()
        } else {
            this.fog.reveal()
        }
        this.updateNumberVisibility()
        // Props would cover the number, so keep them hidden on icon tiles.
        if (this.hasIcon()) {
            this.board.decoration?.hide(this)
        } else {
            this.board.decoration?.show(this)
        }
    }

    public openNeighbours(): void {
        for (const neighbour of this.getNeighbours()) {
            if (!neighbour.isOpen() && !neighbour.flag.isVisible()) {
                neighbour.open(true)
            }
        }
    }

    public close(): void {
        this.setHover(false)
        this.opened = false
        this.updateNumberVisibility()
        this.flag.hide(true)
        this.fog.reset()
        this.board.decoration?.hide(this)
        this.set("empty")
    }

    public isOpen(): boolean {
        return this.opened
    }
}
