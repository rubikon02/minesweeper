import {
    Mesh,
    PlaneGeometry,
    MeshStandardMaterial,
    Group,
    BoxGeometry,
    GridHelper
} from 'three'

export default class Floor extends Group {
    constructor(boardWidth = 700, boardHeight = 700) {
        super()

        // Large ground plane
        const groundGeo = new PlaneGeometry(4000, 4000)
        const groundMat = new MeshStandardMaterial({
            color: 0x0b1120, // Deep slate dark
            roughness: 0.9,
            metalness: 0.1
        })
        const ground = new Mesh(groundGeo, groundMat)
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -2
        this.add(ground)

        // Grid helper on ground
        const grid = new GridHelper(4000, 80, 0x1e293b, 0x0f172a)
        grid.position.y = -1.8
        this.add(grid)

        // Platform base directly under the minesweeper board
        const borderPadding = 24
        const platformWidth = boardWidth + borderPadding * 2
        const platformHeight = boardHeight + borderPadding * 2
        const platformGeo = new BoxGeometry(platformWidth, 4, platformHeight)
        const platformMat = new MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.6,
            metalness: 0.3
        })
        const platform = new Mesh(platformGeo, platformMat)
        platform.position.y = -2
        this.add(platform)
    }
}