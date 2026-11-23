import { Color } from 'three'

import type { MarkerValue } from './MarkerConfig'
import type Terrain from '../Terrain'

// Kept internal: the panel no longer exposes a palette choice, but the
// palette still gives each value a distinct accent in the 2D preview.
export type ColorwayId = 'classic' | 'industrial' | 'rural' | 'arctic' | 'sunset' | 'mono' | 'neon'

// Hand-picked primaries. Deriving them from hue arithmetic makes eight tiles
// look like a colour chart, so each number keeps its own curated value.
const PRIMARIES: Record<ColorwayId, Record<MarkerValue, number>> = {
    classic: {
        1: 0x2f7fff, 2: 0x2fa63a, 3: 0xe4443a, 4: 0x243a8f,
        5: 0x7c2333, 6: 0x1f8f8f, 7: 0x34343d, 8: 0xa9b0ba,
        bomb: 0xd0442a,
    },
    industrial: {
        1: 0xe2e8f0, 2: 0x94a3b8, 3: 0xea580c, 4: 0xdc2626,
        5: 0xf59e0b, 6: 0x64748b, 7: 0xb45309, 8: 0xf8fafc,
        bomb: 0xef4444,
    },
    rural: {
        1: 0xf2c14e, 2: 0x4d7c0f, 3: 0x166534, 4: 0xb45309,
        5: 0xca8a04, 6: 0x365314, 7: 0x9a3412, 8: 0x65a30d,
        bomb: 0xb91c1c,
    },
    arctic: {
        1: 0x38bdf8, 2: 0x67e8f9, 3: 0x818cf8, 4: 0x60a5fa,
        5: 0xa5f3fc, 6: 0x93c5fd, 7: 0x94a3b8, 8: 0xe0f2fe,
        bomb: 0xf87171,
    },
    sunset: {
        1: 0xfb7185, 2: 0xf97316, 3: 0xe11d48, 4: 0xa855f7,
        5: 0xf59e0b, 6: 0xec4899, 7: 0x7c3aed, 8: 0xfda4af,
        bomb: 0xef4444,
    },
    mono: {
        1: 0xf8fafc, 2: 0xcbd5e1, 3: 0x94a3b8, 4: 0x64748b,
        5: 0x475569, 6: 0x334155, 7: 0x1e293b, 8: 0x0f172a,
        bomb: 0xef4444,
    },
    neon: {
        1: 0x22d3ee, 2: 0x4ade80, 3: 0xf472b6, 4: 0xa78bfa,
        5: 0xfacc15, 6: 0x34d399, 7: 0x818cf8, 8: 0x67e8f9,
        bomb: 0xff3df2,
    },
}

const ACCENTS: Record<ColorwayId, number> = {
    classic: 0xffcc4d,
    industrial: 0xff7a1a,
    rural: 0xf2c14e,
    arctic: 0x7dd3fc,
    sunset: 0xff7ab6,
    mono: 0xf8fafc,
    neon: 0xff3df2,
}

const WHITE = new Color(0xffffff)
const BLACK = new Color(0x000000)

// Materials that should stay believable whatever the number colour is.
const CREAM = new Color(0xf7edc9)
const WOOD = new Color(0x6b4a2f)
const STONE = new Color(0x8d9199)
const CHARCOAL = new Color(0x241d17)

// Real-world paints stay constant across colourways. The number colour is a
// deliberate accent on top, never a replacement for white plaster or brick.
const PAINT_WHITE = new Color(0xe9e7df)
const SIGNAL_RED = new Color(0xb23a2e)
const PINE_GREEN = new Color(0x2f6b3d)
const LEAF_GREEN = new Color(0x537f35)
const GALVANISED = new Color(0x99a2a8)
const ROOF_GREY = new Color(0x4b5056)

export interface Palette {
    primary: Color
    light: Color
    dark: Color
    accent: Color
    cream: Color
    wood: Color
    stone: Color
    charcoal: Color
    white: Color
    red: Color
    pine: Color
    leaf: Color
    metal: Color
    roof: Color
    // Keeps a material believable while still carrying the tile's colour.
    tinted(base: Color, amount?: number): Color
}

export function primaryHex(colorway: ColorwayId, value: MarkerValue): number {
    return PRIMARIES[colorway][value]
}

// Sample the same grass / rock / snow ramp the terrain uses, so a white silo
// on snow can be darkened before it disappears into the background.
export function groundColorAt(terrain: Terrain, worldX: number, worldZ: number, tileSize: number): Color {
    const step = tileSize / 3
    const heightX = Math.abs(
        terrain.heightAtWorld(worldX + step, worldZ) -
        terrain.heightAtWorld(worldX - step, worldZ)
    )
    const heightZ = Math.abs(
        terrain.heightAtWorld(worldX, worldZ + step) -
        terrain.heightAtWorld(worldX, worldZ - step)
    )
    const slope = Math.hypot(heightX, heightZ) / (2 * step)
    return terrain.colorFor(terrain.heightAtWorld(worldX, worldZ), slope)
}

export function buildPalette(
    colorway: ColorwayId,
    value: MarkerValue,
    ground: Color,
    lightnessJitter = 0
): Palette {
    const primary = new Color(primaryHex(colorway, value))
    const luminance = ground.r * 0.2126 + ground.g * 0.7152 + ground.b * 0.0722
    if (luminance > 0.62) {
        primary.lerp(BLACK, 0.3)
    } else if (luminance < 0.22) {
        primary.lerp(WHITE, 0.28)
    }
    if (lightnessJitter !== 0) primary.offsetHSL(0, 0, lightnessJitter)

    return {
        primary,
        light: primary.clone().lerp(WHITE, 0.55),
        dark: primary.clone().lerp(BLACK, 0.45),
        accent: new Color(ACCENTS[colorway]),
        cream: CREAM,
        wood: WOOD,
        stone: STONE,
        charcoal: CHARCOAL,
        white: PAINT_WHITE,
        red: SIGNAL_RED,
        pine: PINE_GREEN,
        leaf: LEAF_GREEN,
        metal: GALVANISED,
        roof: ROOF_GREY,
        tinted: (base, amount = 0.2) => base.clone().lerp(primary, amount),
    }
}
