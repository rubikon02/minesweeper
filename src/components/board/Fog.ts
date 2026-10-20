import {
    Mesh,
    MeshStandardMaterial,
    Texture,
    CanvasTexture,
    RepeatWrapping,
    SRGBColorSpace
} from 'three'

import mulberry32 from '../../utils/random'
import type Tile from './Tile'

// One shared cloud texture, drawn onto a canvas so we do not need to
// download anything extra.
let sharedCloudTexture: Texture | null = null

function createCloudTexture(): Texture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const rng = mulberry32(4242)

    // Soft blue-grey base so the cloud has some depth.
    const base = ctx.createLinearGradient(0, 0, 0, size)
    base.addColorStop(0, '#ffffff')
    base.addColorStop(0.5, '#f4f8fd')
    base.addColorStop(1, '#e4edf7')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    // Brighter white puffs on top.
    for (let i = 0; i < 110; i++) {
        const cx = rng() * size
        const cy = rng() * size
        const r = size * (0.08 + rng() * 0.22)
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        gradient.addColorStop(0, 'rgba(255,255,255,1)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
    }

    // A few darker creases for volume.
    for (let i = 0; i < 26; i++) {
        const cx = rng() * size
        const cy = rng() * size
        const r = size * (0.06 + rng() * 0.14)
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        gradient.addColorStop(0, 'rgba(158,180,205,0.28)')
        gradient.addColorStop(1, 'rgba(158,180,205,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    // Cloud pattern spans a couple of tiles, hiding the repetition.
    texture.repeat.set(0.5, 0.5)
    texture.needsUpdate = true
    return texture
}

// Fog covers a hidden tile by drawing a cloud texture over its surface.
// The cover mesh reuses the tile geometry, so it follows the terrain
// shape and neighbouring tiles form one continuous cloud slope.
export default class Fog {
    public tile: Tile
    public mesh: Mesh
    public visible: boolean

    private material: MeshStandardMaterial
    private progress = 0
    private hovered = false

    private static readonly REVEAL_TIME = 0.35
    // Small lift above the terrain to avoid z-fighting.
    private static readonly LIFT = 0.4

    constructor(tile: Tile) {
        this.tile = tile

        if (!sharedCloudTexture) {
            sharedCloudTexture = createCloudTexture()
        }

        this.material = new MeshStandardMaterial({
            color: 0xffffff,
            map: sharedCloudTexture,
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 1,
        })

        this.mesh = new Mesh(tile.mesh.geometry, this.material)
        this.mesh.position.set(tile.worldX, Fog.LIFT, tile.worldZ)
        // Fog is only visual; never let it capture the click ray.
        this.mesh.raycast = () => void 0

        tile.game.scene.add(this.mesh)
        this.visible = true
    }

    public setHover(hovered: boolean): void {
        if (this.hovered === hovered) return
        this.hovered = hovered
        this.material.color.set(hovered ? 0xffffff : 0xe8eef7)
    }

    // Animate the cover away.
    public reveal(): void {
        this.progress = 0.0001
        this.visible = true
        this.mesh.visible = true
    }

    // Clear the cover instantly (win / reveal all bombs).
    public hideInstant(): void {
        this.progress = 0
        this.visible = false
        this.mesh.visible = false
    }

    // Bring the cover back instantly (restart).
    public reset(): void {
        this.progress = 0
        this.visible = true
        this.mesh.visible = true
        this.material.opacity = 1
        this.setHover(false)
    }

    public update(delta: number): void {
        if (!this.visible || this.progress <= 0) return

        this.progress = Math.min(1, this.progress + delta / Fog.REVEAL_TIME)
        const eased = this.progress * this.progress

        this.material.opacity = 1 - eased
        this.mesh.position.y = Fog.LIFT + 8 * eased

        if (this.progress >= 1) {
            this.visible = false
            this.mesh.visible = false
        }
    }
}
