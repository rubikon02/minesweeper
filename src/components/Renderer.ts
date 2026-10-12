import {
    WebGLRenderer,
    PCFSoftShadowMap
} from 'three'

export default class Renderer extends WebGLRenderer {
    constructor() {
        super({ antialias: true, powerPreference: 'high-performance' })
        this.setClearColor(0x0f172a)
        this.shadowMap.enabled = false
        this.shadowMap.type = PCFSoftShadowMap

        this.updateSize()
        window.addEventListener('resize', () => this.updateSize())
    }

    public updateSize(): void {
        this.setSize(window.innerWidth, window.innerHeight)
    }
}
