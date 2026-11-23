// Deterministic layouts for the repeated symbols on one tile. Every shape
// supports every count 1..8, so drag-swapping a motif between numbers simply
// changes how many copies are drawn.

export type Placement = 'center' | 'ring' | 'row' | 'cluster'

export interface PlacedSymbol {
    x: number
    z: number
    rotation: number
    scale: number
}

export function hashString(text: string): number {
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

// Larger counts get smaller symbols. Without this, eight windmills would
// spill over the 35-unit tile and swallow their neighbours.
export function scaleForCount(count: number): number {
    if (count <= 1) return 1.15
    if (count <= 3) return 1
    if (count <= 5) return 0.9
    if (count <= 7) return 0.75
    return 0.65
}

const MAX_REACH = 16

export function placeSymbols(
    count: number,
    placement: Placement,
    footprint: number,
    rng: () => number
): PlacedSymbol[] {
    const total = Math.max(1, Math.min(8, Math.round(count)))
    const scale = scaleForCount(total)
    const size = footprint * scale
    const symbols: PlacedSymbol[] = []

    if (total === 1) {
        symbols.push({ x: 0, z: 0, rotation: rng() * Math.PI * 2, scale })
        return symbols
    }

    if (placement === 'row') {
        const columns = total <= 4 ? total : Math.ceil(total / 2)
        const rows = Math.ceil(total / columns)
        let spacing = size * 1.15
        if (columns > 1) {
            spacing = Math.min(spacing, (MAX_REACH * 2 - size) / (columns - 1))
        }
        for (let i = 0; i < total; i++) {
            const column = i % columns
            const row = Math.floor(i / columns)
            symbols.push({
                x: (column - (columns - 1) / 2) * spacing + (rng() - 0.5) * 0.4,
                z: (row - (rows - 1) / 2) * spacing + (rng() - 0.5) * 0.4,
                rotation: rng() * Math.PI * 2,
                scale,
            })
        }
        return symbols
    }

    // A "center" motif with more than one copy uses the same spread as a
    // cluster; sending every copy to the origin would silently drop the
    // configured count.
    if (placement === 'cluster' || placement === 'center') {
        const radius = Math.max(2, MAX_REACH - size * 0.5)
        const golden = Math.PI * (3 - Math.sqrt(5))
        for (let i = 0; i < total; i++) {
            const angle = i * golden + rng() * 0.3
            const distance = Math.sqrt((i + 0.5) / total) * radius + (rng() - 0.5) * 0.6
            symbols.push({
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                rotation: rng() * Math.PI * 2,
                scale: scale * (0.9 + rng() * 0.15),
            })
        }
        return symbols
    }

    // Ring: one even circle, clamped so the outer edge stays on the tile.
    const idealSpacing = size * 1.1
    const idealRadius = idealSpacing / (2 * Math.sin(Math.PI / total))
    const radius = Math.min(idealRadius, MAX_REACH - size * 0.45)
    for (let i = 0; i < total; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / total + (rng() - 0.5) * 0.16
        const distance = radius + (rng() - 0.5) * 0.6
        symbols.push({
            x: Math.cos(angle) * distance,
            z: Math.sin(angle) * distance,
            rotation: rng() * Math.PI * 2,
            scale,
        })
    }
    return symbols
}
