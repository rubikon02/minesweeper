import {
    BufferGeometry,
    InstancedMesh,
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
import { buildMarkerGeometry, getMarkerMaterial } from './Marker'
import { buildTerrainSurface } from './TerrainSurface'
import { CHUNK_SIZE, packKey } from '../../utils/coords'
import type Board from './Board'
import type { MarkerEntry } from './Marker'
import type DecoInstance from './InstancedProp'

// A chunk owns every mesh for a square block of tiles: the merged terrain,
// the merged fog cover, the merged tile markers and the decoration.
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

    private markerMesh: Mesh
    private markerEntries = new Map<number, MarkerEntry>()
    private pendingMarkers = new Map<number, Tile>()
    private markerDirty = false

    public decoByTile = new Map<number, DecoInstance[]>()
    private decoMeshes: InstancedMesh[] = []
    // Bomb mushrooms are marker state, so they are cleared with the marker
    // mesh rather than with the scenery props.
    private bombMeshes: InstancedMesh[] = []

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
        this.geometry = buildTerrainSurface(board.terrain, {
            originX: this.originX,
            originZ: this.originZ,
            cells: CHUNK_SIZE,
            step: ts,
        })
        this.maskData = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(255)
        this.maskTexture = this.buildMaskTexture()

        this.terrainMesh = new Mesh(this.geometry, board.terrain.material)
        this.group.add(this.terrainMesh)

        this.fogMaterial = this.buildFogMaterial()
        this.fogMesh = new Mesh(this.geometry, this.fogMaterial)
        // Lift the cloud cover slightly so it never z-fights the terrain.
        this.fogMesh.position.y = 0.4
        this.group.add(this.fogMesh)

        this.markerMesh = new Mesh(new BufferGeometry(), getMarkerMaterial())
        this.markerMesh.visible = false
        this.markerMesh.raycast = () => void 0
        this.markerMesh.frustumCulled = false
        this.group.add(this.markerMesh)

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

    // Add the marker for a tile once its fog cover is gone. During the fade
    // it waits in `pendingMarkers`, so a hidden tile never reveals early.
    public markMarker(tile: Tile): void {
        if (!tile.hasMarker()) return
        const idx = this.tileIndex(tile)
        if (idx < 0 || this.markerEntries.has(idx)) return

        if (this.maskData[idx] !== 0) {
            this.pendingMarkers.set(idx, tile)
            return
        }
        this.addMarker(idx, tile)
    }

    private tileIndex(tile: Tile): number {
        const lx = tile.x - this.cx * CHUNK_SIZE
        const lz = tile.z - this.cz * CHUNK_SIZE
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return -1
        return lz * CHUNK_SIZE + lx
    }

    private addMarker(idx: number, tile: Tile): void {
        this.markerEntries.set(idx, {
            value: tile.value,
            worldX: tile.worldX,
            worldZ: tile.worldZ,
        })
        this.markerDirty = true
    }

    private flushPendingMarker(idx: number): void {
        const tile = this.pendingMarkers.get(idx)
        if (!tile) return
        this.pendingMarkers.delete(idx)
        this.addMarker(idx, tile)
    }

    // Merge every marker in the chunk into one vertex-coloured geometry, and
    // rebuild the instanced bomb mushrooms for the same entries.
    private rebuildMarkers(): void {
        this.markerDirty = false
        this.markerMesh.geometry.dispose()

        const entries = Array.from(this.markerEntries.values())
        this.board.bombMushroom.populate(
            this,
            entries.filter(entry => entry.value === 'bomb')
        )

        if (entries.length === 0) {
            this.markerMesh.geometry = new BufferGeometry()
            this.markerMesh.visible = false
            return
        }

        const geometry = buildMarkerGeometry(
            entries,
            (x, z) => this.board.terrain.heightAtWorld(x, z),
            this.originX,
            this.originZ
        )
        this.markerMesh.geometry = geometry
        this.markerMesh.visible = true
    }

    // Ask the decoration manager to fill this chunk with props.
    public decorate(): void {
        this.board.decoration.populate(this)
    }

    public registerDecoMesh(mesh: InstancedMesh): void {
        this.decoMeshes.push(mesh)
        this.group.add(mesh)
    }

    public registerBombMesh(mesh: InstancedMesh): void {
        this.bombMeshes.push(mesh)
        this.group.add(mesh)
    }

    // The part geometry and materials are shared by every chunk, so only the
    // instance buffers belong to this chunk.
    private releaseMeshes(meshes: InstancedMesh[]): void {
        for (const mesh of meshes) {
            this.group.remove(mesh)
            mesh.dispose()
        }
    }

    public clearBombMushrooms(): void {
        this.releaseMeshes(this.bombMeshes)
        this.bombMeshes = []
    }

    // Let a late-loaded bomb model fill in bombs that are already revealed.
    public refreshMarkers(): void {
        this.markerDirty = true
    }

    public setDecoVisible(tile: Tile, visible: boolean): void {
        const list = this.decoByTile.get(packKey(tile.x, tile.z))
        if (!list) return
        for (const inst of list) {
            inst.setVisible(visible)
        }
    }

    public clearDecoration(): void {
        this.releaseMeshes(this.decoMeshes)
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
                this.setDecoVisible(tile, !tile.hasMarker())
            } else {
                this.setDecoVisible(tile, false)
                if (board.flagged.has(key)) {
                    tile.flag.setVisible(true)
                }
            }
        }

        // Chunks streamed in after a loss must match the already revealed map.
        if (board.bombsRevealed) {
            board.revealBombsInChunk(this)
        }
    }

    public reapplyState(): void {
        this.restoreState()
    }

    public update(delta: number): void {
        if (this.anim.size > 0) {
            let changed = false
            const speed = delta / 0.35 * 255
            for (const [idx, value] of this.anim) {
                const next = value - speed
                if (next <= 0) {
                    this.maskData[idx] = 0
                    this.anim.delete(idx)
                    this.flushPendingMarker(idx)
                } else {
                    this.maskData[idx] = next
                    this.anim.set(idx, next)
                }
                changed = true
            }
            if (changed) this.maskTexture.needsUpdate = true
        }

        if (this.markerDirty) this.rebuildMarkers()
    }

    public dispose(): void {
        // Flags live directly on the scene, so pull them out with the chunk.
        for (const tile of this.tiles) {
            if (tile.flag.isVisible()) tile.flag.setVisible(false)
        }
        this.board.game.scene.remove(this.group)
        this.clearDecoration()
        this.clearBombMushrooms()
        this.geometry.dispose()
        this.maskTexture.dispose()
        this.fogMaterial.dispose()
        this.markerMesh.geometry.dispose()
    }
}
