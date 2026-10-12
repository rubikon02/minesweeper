import {
    WebGLRenderer,
    PCFSoftShadowMap
} from 'three'

export default class Renderer extends WebGLRenderer {
    constructor() {
        super({ antialias: true, powerPreference: 'high-performance' })
        this.setClearColor(0x0f172a) // Modern slate dark theme
        this.shadowMap.enabled = false
        this.shadowMap.type = PCFSoftShadowMap

        this.updateSize()
        window.addEventListener('resize', () => this.updateSize())
    }

    updateSize() {
        this.setSize(window.innerWidth, window.innerHeight)
    }
}