import {
    BufferGeometry,
    BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    DataTexture,
    RedFormat,
    UnsignedByteType,
    NearestFilter,
    ClampToEdgeWrapping,
    Group
} from 'three'

import Tile from './Tile'
import { getCloudTexture } from './Fog'
import { getIconMaterial, ICON_CELL, iconCell } from './icons'
import { CHUNK_SIZE, packKey } from '../../utils/coords'
import type Board from './Board'
import type { DecoInstance } from './Decoration'

interface IconEntry {
    cell: number
    x: number
    y: number
    z: number
}

// A chunk owns every mesh for a square block of tiles: the merged terrain,
// the merged fog cover, the merged number/bomb icons and the decoration.
// Tiles inside it stay lightweight.
export default class Chunk {
    public board: Board
    public cx: number
    public cz: number
    public originX: number
    public originZ: number
    public size: number

    public tiles: Tile[] = []
    public group: Group

    public terrainMesh: Mesh
    public fogMesh: Mesh

    private geometry: BufferGeometry
    private fogMaterial: MeshStandardMaterial
    private maskData: Uint8Array
    private maskTexture: DataTexture
    private anim = new Map<number, number>()

    private iconMesh: Mesh
    private iconEntries: IconEntry[] = []
    private iconDirty = false

    public decoByTile = new Map<number, DecoInstance[]>()
    private decoMeshes: Mesh[] = []

    constructor(board: Board, cx: number, cz: number) {
        this.board = board
        this.cx = cx
        this.cz = cz
        const ts = board.tileSize
        this.originX = cx * CHUNK_SIZE * ts
        this.originZ = cz * CHUNK_SIZE * ts
        this.size = CHUNK_SIZE * ts

        this.group = new Group()
        this.group.position.set(this.originX, 0, this.originZ)
        board.game.scene.add(this.group)

        this.createTiles()
        this.geometry = this.buildTerrainGeometry()
        this.maskData = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(255)
        this.maskTexture = this.buildMaskTexture()

        this.terrainMesh = new Mesh(this.geometry, board.terrain.material)
        this.group.add(this.terrainMesh)

        this.fogMaterial = this.buildFogMaterial()
        this.fogMesh = new Mesh(this.geometry, this.fogMaterial)
        // Lift the cloud cover slightly so it never z-fights the terrain.
        this.fogMesh.position.y = 0.4
        this.group.add(this.fogMesh)

        this.iconMesh = new Mesh(new BufferGeometry(), getIconMaterial())
        this.iconMesh.visible = false
        this.iconMesh.raycast = () => void 0
        this.iconMesh.frustumCulled = false
        this.group.add(this.iconMesh)

        // Scatter props, then apply the persisted reveal state.
        this.decorate()
        this.restoreState()
    }

    public getTile(gx: number, gz: number): Tile | null {
        const lx = gx - this.cx * CHUNK_SIZE
        const lz = gz - this.cz * CHUNK_SIZE
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return null
        return this.tiles[lx * CHUNK_SIZE + lz] || null
    }

    private createTiles(): void {
        this.tiles = new Array(CHUNK_SIZE * CHUNK_SIZE)
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const gx = this.cx * CHUNK_SIZE + lx
                const gz = this.cz * CHUNK_SIZE + lz
                this.tiles[lx * CHUNK_SIZE + lz] = new Tile(this, gx, gz)
            }
        }
    }

    // Build one merged surface for the whole chunk. Vertext positions are
    // local to the chunk origin so precision stays high far from spawn.
    private buildTerrainGeometry(): BufferGeometry {
        const ts = this.board.tileSize
        const terrain = this.board.terrain
        const quads = CHUNK_SIZE * CHUNK_SIZE

        const positions = new Float32Array(quads * 18)
        const uvs = new Float32Array(quads * 12)
        const colors = new Float32Array(quads * 18)

        let pi = 0
        let ui = 0
        let ci = 0

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const gx = this.cx * CHUNK_SIZE + lx
                const gz = this.cz * CHUNK_SIZE + lz

                const c = terrain.tileCorners(gx, gz)

                const x0 = gx * ts - this.originX
                const x1 = x0 + ts
                const z0 = gz * ts - this.originZ
                const z1 = z0 + ts

                // Triangles a,d,b then a,c,d (same winding as before).
                // a = (x0,z0) b = (x1,z0) c = (x0,z1) d = (x1,z1)
                positions[pi++] = x0; positions[pi++] = c.a; positions[pi++] = z0
                positions[pi++] = x1; positions[pi++] = c.d; positions[pi++] = z1
                positions[pi++] = x1; positions[pi++] = c.b; positions[pi++] = z0
                positions[pi++] = x0; positions[pi++] = c.a; positions[pi++] = z0
                positions[pi++] = x0; positions[pi++] = c.c; positions[pi++] = z1
                positions[pi++] = x1; positions[pi++] = c.d; positions[pi++] = z1

                // Continuous UVs in global tile units, so the texture tiles
                // seamlessly across chunk borders.
                const u0 = gx
                const u1 = gx + 1
                const v0 = gz
                const v1 = gz + 1
                uvs[ui++] = u0; uvs[ui++] = v0
                uvs[ui++] = u1; uvs[ui++] = v1
                uvs[ui++] = u1; uvs[ui++] = v0
                uvs[ui++] = u0; uvs[ui++] = v0
                uvs[ui++] = u0; uvs[ui++] = v1
                uvs[ui++] = u1; uvs[ui++] = v1

                const slope = (Math.max(c.a, c.b, c.c, c.d) - Math.min(c.a, c.b, c.c, c.d)) / ts
                const color = terrain.colorFor(terrain.surfaceY(gx, gz), slope)
                for (let v = 0; v < 6; v++) {
                    colors[ci++] = color.r
                    colors[ci++] = color.g
                    colors[ci++] = color.b
                }
            }
        }

        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(positions, 3))
        geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
        geometry.setAttribute('color', new BufferAttribute(colors, 3))
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()
        return geometry
    }

    private buildMaskTexture(): DataTexture {
        const texture = new DataTexture(
            this.maskData,
            CHUNK_SIZE,
            CHUNK_SIZE,
            RedFormat,
            UnsignedByteType
        )
        texture.magFilter = NearestFilter
        texture.minFilter = NearestFilter
        texture.wrapS = ClampToEdgeWrapping
        texture.wrapT = ClampToEdgeWrapping
        texture.needsUpdate = true
        return texture
    }

    // Fog material samples the per-chunk reveal mask. A texel of 1 hides the
    // tile, 0 shows the terrain through it.
    private buildFogMaterial(): MeshStandardMaterial {
        const material = new MeshStandardMaterial({
            color: 0xffffff,
            map: getCloudTexture(),
            roughness: 1,
            metalness: 0,
            transparent: true,
            depthWrite: false,
        })
        // Pull the cover slightly toward the camera in depth space so it
        // reliably wins the depth test against the coplanar terrain at any
        // distance (a fixed lift alone z-fights far away).
        material.polygonOffset = true
        material.polygonOffsetFactor = -1
        material.polygonOffsetUnits = -1

        const maskTexture = this.maskTexture
        const size = this.size

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uMask = { value: maskTexture }
            shader.uniforms.uMaskSize = { value: size }

            shader.vertexShader = 'varying vec2 vMaskLocal;\n' + shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\n    vMaskLocal = transformed.xz;'
            )

            shader.fragmentShader =
                'uniform sampler2D uMask;\nuniform float uMaskSize;\nvarying vec2 vMaskLocal;\n' +
                shader.fragmentShader.replace(
                    '#include <opaque_fragment>',
                    'float maskVal = texture2D(uMask, vMaskLocal / uMaskSize).r;\n' +
                    '    diffuseColor.a *= maskVal;\n' +
                    '#include <opaque_fragment>'
                )
        }

        return material
    }

    // Reveal one tile in the fog. `instant` skips the fade animation.
    public setRevealed(gx: number, gz: number, instant: boolean): void {
        const lx = gx - this.cx * CHUNK_SIZE
        const lz = gz - this.cz * CHUNK_SIZE
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return
        // DataTexture is row-major (width first): index = y * width + x,
        // where x is the local X tile and y the local Z tile.
        const idx = lz * CHUNK_SIZE + lx

        if (instant) {
            this.maskData[idx] = 0
            this.anim.delete(idx)
            this.maskTexture.needsUpdate = true
        } else if (this.maskData[idx] !== 0) {
            this.anim.set(idx, 255)
        }
    }

    public markIcon(tile: Tile): void {
        const cell = iconCell(tile.value)
        if (cell < 0) return
        const x = tile.worldX - this.originX
        const z = tile.worldZ - this.originZ
        this.iconEntries.push({ cell, x, y: tile.maxCornerY + 1.5, z })
        this.iconDirty = true
    }

    private rebuildIcons(): void {
        this.iconDirty = false
        const entries = this.iconEntries
        this.iconMesh.geometry.dispose()

        if (entries.length === 0) {
            this.iconMesh.geometry = new BufferGeometry()
            this.iconMesh.visible = false
            return
        }

        const half = this.board.tileSize * 0.36
        const positions = new Float32Array(entries.length * 18)
        const uvs = new Float32Array(entries.length * 12)

        let pi = 0
        let ui = 0
        for (const e of entries) {
            const u0 = e.cell * ICON_CELL
            const u1 = u0 + ICON_CELL
            const x0 = e.x - half
            const x1 = e.x + half
            const z0 = e.z - half
            const z1 = e.z + half
            const y = e.y

            // p0(-,-) p3(-,+) p2(+,+) p1(+,-)
            positions[pi++] = x0; positions[pi++] = y; positions[pi++] = z0
            positions[pi++] = x0; positions[pi++] = y; positions[pi++] = z1
            positions[pi++] = x1; positions[pi++] = y; positions[pi++] = z1
            positions[pi++] = x0; positions[pi++] = y; positions[pi++] = z0
            positions[pi++] = x1; positions[pi++] = y; positions[pi++] = z1
            positions[pi++] = x1; positions[pi++] = y; positions[pi++] = z0

            uvs[ui++] = u0; uvs[ui++] = 0
            uvs[ui++] = u0; uvs[ui++] = 1
            uvs[ui++] = u1; uvs[ui++] = 1
            uvs[ui++] = u0; uvs[ui++] = 0
            uvs[ui++] = u1; uvs[ui++] = 1
            uvs[ui++] = u1; uvs[ui++] = 0
        }

        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(positions, 3))
        geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
        geometry.computeBoundingSphere()
        this.iconMesh.geometry = geometry
        this.iconMesh.visible = true
    }

    // Ask the decoration manager to fill this chunk with props.
    public decorate(): void {
        this.board.decoration.populate(this)
    }

    public registerDecoMesh(mesh: Mesh): void {
        this.decoMeshes.push(mesh)
        this.group.add(mesh)
    }

    public setDecoVisible(tile: Tile, visible: boolean): void {
        const list = this.decoByTile.get(packKey(tile.x, tile.z))
        if (!list) return
        for (const inst of list) {
            inst.setVisible(visible)
        }
    }

    public clearDecoration(): void {
        for (const mesh of this.decoMeshes) {
            this.group.remove(mesh)
            const inst = mesh as unknown as { dispose?: () => void }
            if (inst.dispose) inst.dispose()
        }
        this.decoMeshes = []
        this.decoByTile.clear()
    }

    // Re-apply the persisted open / flag state for a freshly built chunk.
    private restoreState(): void {
        const board = this.board
        for (const tile of this.tiles) {
            const key = packKey(tile.x, tile.z)
            if (board.opened.has(key)) {
                tile.restoreOpen()
                this.setDecoVisible(tile, !tile.hasIcon())
            } else {
                this.setDecoVisible(tile, false)
                if (board.flagged.has(key)) {
                    tile.flag.show(true)
                }
            }
        }
    }

    public reapplyState(): void {
        this.restoreState()
    }

    public update(delta: number): void {
        if (this.iconDirty) this.rebuildIcons()

        if (this.anim.size === 0) return

        let changed = false
        const speed = delta / 0.35 * 255
        for (const [idx, value] of this.anim) {
            const next = value - speed
            if (next <= 0) {
                this.maskData[idx] = 0
                this.anim.delete(idx)
            } else {
                this.maskData[idx] = next
                this.anim.set(idx, next)
            }
            changed = true
        }
        if (changed) this.maskTexture.needsUpdate = true
    }

    public dispose(): void {
        // Flags live directly on the scene, so pull them out with the chunk.
        for (const tile of this.tiles) {
            if (tile.flag.isVisible()) tile.flag.hide(true)
        }
        this.board.game.scene.remove(this.group)
        this.clearDecoration()
        this.geometry.dispose()
        this.maskTexture.dispose()
        this.fogMaterial.dispose()
        this.iconMesh.geometry.dispose()
    }
}
