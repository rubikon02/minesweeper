import {
    Mesh,
    MeshStandardMaterial,
    Group,
    BoxGeometry
} from 'three'

// A rocky base under the board so the terrain edges read as an island.
export default class Floor extends Group {
    constructor(boardWidth = 700, boardHeight = 700) {
        super()

        const padding = 20
        const depth = 90

        const baseGeo = new BoxGeometry(boardWidth + padding * 2, depth, boardHeight + padding * 2)
        const baseMat = new MeshStandardMaterial({
            color: 0x6b5a45,
            roughness: 1,
            metalness: 0
        })
        const base = new Mesh(baseGeo, baseMat)
        // Top face sits just below the lowest terrain height (Terrain.minHeight = 8).
        base.position.y = 7 - depth / 2
        this.add(base)

        // A wider, darker shelf far below to fill the horizon.
        const groundGeo = new BoxGeometry(6000, 10, 6000)
        const groundMat = new MeshStandardMaterial({
            color: 0x2f3b2a,
            roughness: 1,
            metalness: 0
        })
        const ground = new Mesh(groundGeo, groundMat)
        ground.position.y = 7 - depth - 6
        this.add(ground)
    }
}
