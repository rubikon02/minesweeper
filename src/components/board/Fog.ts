import {
    Texture,
    CanvasTexture,
    RepeatWrapping,
    SRGBColorSpace
} from 'three'

import mulberry32 from '../../utils/random'

// One shared cloud texture, drawn onto a canvas so we do not need to
// download anything extra. Every chunk's fog material uses the same map.
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

export function getCloudTexture(): Texture {
    if (!sharedCloudTexture) {
        sharedCloudTexture = createCloudTexture()
    }
    return sharedCloudTexture
}
