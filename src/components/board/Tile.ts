import {
    Vector3,
    BufferGeometry,
    BufferAttribute,
    MeshPhongMaterial,
    TextureLoader,
    Box3,
    NearestFilter,
    LinearMipMapLinearFilter,
    PlaneGeometry,
    DoubleSide,
    Mesh,
    Texture
} from 'three'

import Flag from './Flag'
import tileTexture from '../../assets/tiles.png'
import type Board from './Board'
import type Game from '../Game'

export interface TileMesh extends Mesh {
    parentObject?: Tile
}

let sharedTopTexture: Texture | null = null

export default class Tile {
    public board: Board
    public x: number
    public z: number
    public game: Game
    public height: number
    public scale: number
    public value: string | number
    public flag: Flag
    public size: Vector3

    public mesh!: TileMesh
    public convexMesh!: TileMesh
    public flatMesh!: TileMesh

    public topMaterial!: MeshPhongMaterial
    public sideMaterial!: MeshPhongMaterial
    public texture!: Texture

    private angle = Math.PI / 3
    private slope = 1 - 0.4 / Math.tan(Math.PI / 3)

    constructor(board: Board, x: number, z: number) {
        this.board = board
        this.x = x
        this.z = z
        this.game = this.board.game
        this.height = 0.4
        this.scale = this.board.tileSize

        this.value = "empty"

        this.createConvexMesh()
        this.createFlatMesh()

        this.mesh = this.convexMesh

        this.size = new Vector3()
        new Box3().setFromObject(this.mesh).getSize(this.size)

        const posX = board.tileSize * this.x - board.width * board.tileSize / 2 + board.tileSize / 2
        const posZ = board.tileSize * this.z - board.height * board.tileSize / 2 + board.tileSize / 2

        this.convexMesh.position.set(posX, 0, posZ)
        this.flatMesh.position.set(posX, 0.2, posZ)

        this.flag = new Flag(this)
    }

    private createConvexMesh(): void {
        let convexVertices = new Float32Array([
            // left
            -1, 0, -1,
            -1, 0, 1,
            -this.slope, this.height, -this.slope,

            -1, 0, 1,
            -this.slope, this.height, -this.slope,
            -this.slope, this.height, this.slope,

            // right
            this.slope, this.height, -this.slope,
            this.slope, this.height, this.slope,
            1, 0, -1,

            this.slope, this.height, this.slope,
            1, 0, -1,
            1, 0, 1,

            // back
            -this.slope, this.height, -this.slope,
            this.slope, this.height, -this.slope,
            -1, 0, -1,

            this.slope, this.height, -this.slope,
            -1, 0, -1,
            1, 0, -1,

            // front
            -1, 0, 1,
            1, 0, 1,
            -this.slope, this.height, this.slope,

            1, 0, 1,
            -this.slope, this.height, this.slope,
            this.slope, this.height, this.slope,

            // top
            this.slope, this.height, -this.slope,
            this.slope, this.height, this.slope,
            -this.slope, this.height, -this.slope,

            this.slope, this.height, this.slope,
            -this.slope, this.height, -this.slope,
            -this.slope, this.height, this.slope,
        ])
        convexVertices = convexVertices.map(el => el * this.scale / 2)

        const convexUvs = new Float32Array([
            // left
            1, 0,
            0, 0,
            1, 1,
            0, 0,
            1, 1,
            0, 1,

            // right
            0, 0,
            0, 1,
            this.height / Math.tan(this.angle), this.height / Math.tan(this.angle),
            0, 1,
            this.height / Math.tan(this.angle), this.height / Math.tan(this.angle),
            this.height / Math.tan(this.angle), 1 - this.height / Math.tan(this.angle),

            // back
            0, 0,
            0, 1,
            this.height / Math.tan(this.angle), this.height / Math.tan(this.angle),
            0, 1,
            this.height / Math.tan(this.angle), this.height / Math.tan(this.angle),
            1 - this.height / Math.tan(this.angle), 1 - this.height / Math.tan(this.angle),

            // front
            0, 0,
            1, 0,
            this.height / Math.tan(this.angle) / 2, this.height / Math.tan(this.angle) / 2,
            1, 0,
            this.height / Math.tan(this.angle) / 2, this.height / Math.tan(this.angle) / 2,
            1, 1,

            // top
            1, 1,
            1, 0,
            0, 1,
            1, 0,
            0, 1,
            0, 0,
        ])

        const convexGeometry = new BufferGeometry()
        convexGeometry.setAttribute("position", new BufferAttribute(convexVertices, 3))
        convexGeometry.setAttribute("uv", new BufferAttribute(convexUvs, 2))
        convexGeometry.computeVertexNormals()

        convexGeometry.addGroup(0, 24, 0)
        convexGeometry.addGroup(24, 6, 1)

        if (!sharedTopTexture) {
            sharedTopTexture = new TextureLoader().load(tileTexture)
            sharedTopTexture.magFilter = NearestFilter
            sharedTopTexture.minFilter = NearestFilter
            sharedTopTexture.generateMipmaps = false
            sharedTopTexture.offset.set(0, 0)
            sharedTopTexture.repeat.set(0.0625, 1)
        }

        this.sideMaterial = new MeshPhongMaterial({
            color: "#64748b",
            specular: 0x475569,
            shininess: 20,
            side: DoubleSide,
        })

        this.topMaterial = new MeshPhongMaterial({
            color: "white",
            specular: 0xffffff,
            shininess: 10,
            side: DoubleSide,
            map: sharedTopTexture,
            emissive: 0x000000,
        })

        this.convexMesh = new Mesh(convexGeometry, [this.sideMaterial, this.topMaterial]) as TileMesh
        this.convexMesh.parentObject = this
    }

    private createFlatMesh(): void {
        this.texture = new TextureLoader().load(tileTexture)
        this.texture.magFilter = NearestFilter
        this.texture.minFilter = NearestFilter
        this.texture.generateMipmaps = false
        this.texture.offset.set(0, 0)
        this.texture.repeat.set(0.0625, 1)

        const geometry = new PlaneGeometry(this.scale, this.scale)
        const material = new MeshPhongMaterial({
            color: "white",
            specular: 0x000000,
            shininess: 0,
            map: this.texture,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        })

        this.flatMesh = new Mesh(geometry, material) as TileMesh
        this.flatMesh.rotation.x = Math.PI * 3 / 2
        this.flatMesh.parentObject = this
    }

    public setHover(hovered: boolean): void {
        if (!this.isOpen() && this.topMaterial) {
            this.topMaterial.emissive.setHex(hovered ? 0x2a384c : 0x000000)
            this.sideMaterial.color.set(hovered ? "#94a3b8" : "#64748b")
        }
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

        this.setHover(false)
        this.game.scene.remove(this.mesh)
        this.mesh = this.flatMesh
        this.game.scene.add(this.mesh)

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

    public openNeighbours(): void {
        for (const neighbour of this.getNeighbours()) {
            if (!neighbour.isOpen() && !neighbour.flag.isVisible()) {
                neighbour.open(true)
            }
        }
    }

    public close(): void {
        this.setHover(false)
        if (this.isOpen()) {
            this.game.scene.remove(this.mesh)
            this.mesh = this.convexMesh
            this.game.scene.add(this.mesh)
        }
        this.flag.hide(true)
        this.set("empty")
    }

    public isOpen(): boolean {
        return this.mesh === this.flatMesh
    }
}
