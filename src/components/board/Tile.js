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
    Mesh
} from 'three'

import Flag from './Flag'
import tileTexture from '../../assets/tiles.png'

// Cached unopened texture for convex top
let sharedTopTexture = null

export default class Tile {
    constructor(board, x, z) {
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

        // Set position for both meshes
        const posX = board.tileSize * this.x - board.width * board.tileSize / 2 + board.tileSize / 2
        const posZ = board.tileSize * this.z - board.height * board.tileSize / 2 + board.tileSize / 2

        this.convexMesh.position.set(posX, 0, posZ)
        this.flatMesh.position.set(posX, 0.05, posZ)

        this.flag = new Flag(this)
    }

    createConvexMesh() {
        this.angle = Math.PI / 3 // 60 deg
        this.slope = 1 - this.height / Math.tan(this.angle)

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

        let convexUvs = new Float32Array([
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
            sharedTopTexture.minFilter = LinearMipMapLinearFilter
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

        const convexMaterials = [
            this.sideMaterial,
            this.topMaterial
        ]

        this.convexMesh = new Mesh(convexGeometry, convexMaterials)
        this.convexMesh.parentObject = this
    }

    createFlatMesh() {
        this.texture = new TextureLoader().load(tileTexture)
        this.texture.magFilter = NearestFilter
        this.texture.minFilter = LinearMipMapLinearFilter
        this.texture.offset.set(0, 0)
        this.texture.repeat.set(0.0625, 1)

        const geometry = new PlaneGeometry(this.scale, this.scale)
        const material = new MeshPhongMaterial({
            color: "white",
            specular: 0x222222,
            shininess: 10,
            side: DoubleSide,
            map: this.texture,
        })

        this.flatMesh = new Mesh(geometry, material)
        this.flatMesh.rotation.x = Math.PI * 3 / 2
        this.flatMesh.parentObject = this
    }

    setHover(hovered) {
        if (!this.isOpen() && this.topMaterial) {
            this.topMaterial.emissive.setHex(hovered ? 0x2a384c : 0x000000)
            this.sideMaterial.color.set(hovered ? "#94a3b8" : "#64748b")
        }
    }

    set(name) {
        if (!isNaN(name)) {
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

    getNeighbours() {
        const neighbours = []
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

    toggleFlag() {
        if (!this.isOpen()) {
            this.flag.toggle()
        }
    }

    open(silent = false) {
        if (this.board.blockActions) return
        if (this.flag.isVisible() || this.isOpen()) return

        // Generate bombs safely on the first click
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
            const num = parseInt(this.value) || 0
            this.game.addPoints(num)
        }

        if (this.board.checkWin()) {
            this.game.gameWon()
        }
    }

    openNeighbours() {
        for (let neighbour of this.getNeighbours()) {
            if (!neighbour.isOpen() && !neighbour.flag.isVisible()) {
                neighbour.open(true)
            }
        }
    }

    close() {
        this.setHover(false)
        if (this.isOpen()) {
            this.game.scene.remove(this.mesh)
            this.mesh = this.convexMesh
            this.game.scene.add(this.mesh)
        }
        this.flag.hide(true)
        this.set("empty")
    }

    isOpen() {
        return this.mesh === this.flatMesh
    }
}