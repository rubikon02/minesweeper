import {
    BufferGeometry,
    BufferAttribute,
    Mesh
} from 'three'

import type Board from './Board'

// A coarse copy of the terrain that reaches out to the horizon, so the
// mountains never simply stop at the edge of the built chunks. It is built
// from the same height function at a low resolution and is recentred when
// the player travels far enough.
export default class Horizon extends Mesh {
    public board: Board

    private step: number
    private halfSpan: number
    private cells: number
    private lastX = Number.POSITIVE_INFINITY
    private lastZ = Number.POSITIVE_INFINITY

    constructor(board: Board) {
        super()
        this.board = board
        this.step = board.tileSize * 8
        this.cells = 34
        this.halfSpan = (this.cells / 2) * this.step

        this.material = board.terrain.material
        this.frustumCulled = false
        this.raycast = () => void 0
        // Sit just under the detailed terrain so overlaps never z-fight.
        this.position.y = -2

        this.rebuild(0, 0)
    }

    public update(playerX: number, playerZ: number): void {
        const threshold = this.step * 4
        if (Math.abs(playerX - this.lastX) > threshold || Math.abs(playerZ - this.lastZ) > threshold) {
            this.rebuild(playerX, playerZ)
        }
    }

    private rebuild(centerX: number, centerZ: number): void {
        const terrain = this.board.terrain
        const step = this.step
        const cells = this.cells

        const originX = Math.round(centerX / step) * step - this.halfSpan
        const originZ = Math.round(centerZ / step) * step - this.halfSpan

        const positions = new Float32Array(cells * cells * 18)
        const colors = new Float32Array(cells * cells * 18)
        const uvs = new Float32Array(cells * cells * 12)
        let pi = 0
        let ci = 0

        for (let i = 0; i < cells; i++) {
            for (let j = 0; j < cells; j++) {
                const x0 = originX + i * step
                const x1 = x0 + step
                const z0 = originZ + j * step
                const z1 = z0 + step

                const ha = terrain.heightAtWorld(x0, z0)
                const hb = terrain.heightAtWorld(x1, z0)
                const hc = terrain.heightAtWorld(x0, z1)
                const hd = terrain.heightAtWorld(x1, z1)

                positions[pi++] = x0; positions[pi++] = ha; positions[pi++] = z0
                positions[pi++] = x1; positions[pi++] = hd; positions[pi++] = z1
                positions[pi++] = x1; positions[pi++] = hb; positions[pi++] = z0
                positions[pi++] = x0; positions[pi++] = ha; positions[pi++] = z0
                positions[pi++] = x0; positions[pi++] = hc; positions[pi++] = z1
                positions[pi++] = x1; positions[pi++] = hd; positions[pi++] = z1

                const slope = (Math.max(ha, hb, hc, hd) - Math.min(ha, hb, hc, hd)) / step
                const color = terrain.colorFor((ha + hb + hc + hd) / 4, slope)
                for (let v = 0; v < 6; v++) {
                    colors[ci++] = color.r
                    colors[ci++] = color.g
                    colors[ci++] = color.b
                }
            }
        }

        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(positions, 3))
        geometry.setAttribute('color', new BufferAttribute(colors, 3))
        geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()

        if (this.geometry) this.geometry.dispose()
        this.geometry = geometry

        this.lastX = centerX
        this.lastZ = centerZ
    }

    // Called on restart so the horizon uses the new terrain seed.
    public reseed(): void {
        this.lastX = Number.POSITIVE_INFINITY
        this.lastZ = Number.POSITIVE_INFINITY
        this.rebuild(0, 0)
    }
}
