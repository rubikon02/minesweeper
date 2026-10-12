import { PerspectiveCamera } from 'three'


export default class Camera extends PerspectiveCamera {
    constructor(fov) {
        super(fov, window.innerWidth / window.innerHeight, 0.1, 10000)

        this.updateSize()
        window.addEventListener('resize', () => this.updateSize())
    }

    updateSize() {
        this.aspect = window.innerWidth / window.innerHeight
        this.updateProjectionMatrix()
    }
}