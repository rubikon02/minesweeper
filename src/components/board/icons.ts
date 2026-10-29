import {
    MeshBasicMaterial,
    Texture,
    TextureLoader,
    NearestFilter
} from 'three'

import tileTexture from '../../assets/tiles.png'

// Shared icon atlas and material. The atlas column for a value is baked
// into each merged icon geometry, so a single material serves all chunks.
let atlas: Texture | null = null
let material: MeshBasicMaterial | null = null

export function getIconMaterial(): MeshBasicMaterial {
    if (!atlas) {
        atlas = new TextureLoader().load(tileTexture)
        atlas.magFilter = NearestFilter
        atlas.minFilter = NearestFilter
        atlas.generateMipmaps = false
    }
    if (!material) {
        material = new MeshBasicMaterial({
            map: atlas,
            transparent: true,
            alphaTest: 0.4,
            depthWrite: false,
        })
    }
    return material
}

// Atlas spread for one icon cell (16 columns).
export const ICON_CELL = 0.0625

// Which atlas column shows this value: bomb = 1, number n = n + 2.
// Returns -1 when the value has no icon.
export function iconCell(value: string | number): number {
    if (value === 'bomb') return 1
    if (typeof value === 'number' && value >= 1 && value <= 8) return value + 2
    return -1
}
