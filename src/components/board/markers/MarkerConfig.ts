// One fixed look: only the motif assigned to each tile value is configurable,
// and it is applied when a new run starts. Counts and colours are derived.

export const SHAPE_IDS = [
    'lighthouse', 'pine', 'oak', 'chimney', 'windmill', 'tower', 'silo',
    'village', 'mine', 'waterTower', 'barn', 'pylon'
] as const
export type ShapeId = typeof SHAPE_IDS[number]

export const MARKER_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 'bomb'] as const
export type MarkerValue = typeof MARKER_VALUES[number]

export interface MarkerSelection {
    shape: ShapeId
}

export interface MarkerConfig {
    version: 2
    perValue: Record<MarkerValue, MarkerSelection>
}

const ACTIVE_KEY = '3dmw.markerConfig.v1'

// How many copies a tile draws. Deriving it keeps the panel, the 2D preview
// and the 3D marker in agreement without a separate setting.
export function defaultCount(value: MarkerValue): number {
    return value === 'bomb' ? 1 : value
}

// Only used for a fresh save. Sensor towers read better repeated eight times
// than as a single lonely silhouette, so they take slot 8 by default.
const DEFAULT_SHAPES: Record<MarkerValue, ShapeId> = {
    1: 'lighthouse',
    2: 'pine',
    3: 'oak',
    4: 'chimney',
    5: 'windmill',
    6: 'silo',
    7: 'village',
    8: 'tower',
    bomb: 'mine',
}

export function createDefaultConfig(): MarkerConfig {
    const perValue = {} as Record<MarkerValue, MarkerSelection>
    for (const value of MARKER_VALUES) {
        perValue[value] = { shape: DEFAULT_SHAPES[value] }
    }
    return { version: 2, perValue }
}

export function cloneConfig(config: MarkerConfig): MarkerConfig {
    const perValue = {} as Record<MarkerValue, MarkerSelection>
    for (const value of MARKER_VALUES) {
        perValue[value] = { shape: config.perValue[value]?.shape ?? DEFAULT_SHAPES[value] }
    }
    return { version: 2, perValue }
}

// Older saves carried colourways and manual counts. Only the motif survives;
// everything else is derived from the tile value now.
export function normalizeConfig(config: MarkerConfig): MarkerConfig {
    return cloneConfig(config)
}

function isShapeId(value: unknown): value is ShapeId {
    return typeof value === 'string' && (SHAPE_IDS as readonly string[]).includes(value)
}

export function isValidConfig(value: unknown): value is MarkerConfig {
    if (!value || typeof value !== 'object') return false
    const config = value as Partial<MarkerConfig>
    const version = config.version as number | undefined
    if (version !== 1 && version !== 2) return false
    if (!config.perValue || typeof config.perValue !== 'object') return false

    for (const key of MARKER_VALUES) {
        const selection = config.perValue[key]
        if (!selection || typeof selection !== 'object') return false
        if (!isShapeId(selection.shape)) return false
    }
    return true
}

export function loadActiveConfig(): MarkerConfig {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY)
        if (raw) {
            const parsed: unknown = JSON.parse(raw)
            if (isValidConfig(parsed)) return normalizeConfig(parsed)
        }
    } catch {
        // A blocked or corrupt store simply falls back to the curated default.
    }
    return createDefaultConfig()
}

export function saveActiveConfig(config: MarkerConfig): void {
    try {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(config))
    } catch {
        // Settings still work for this run when storage is unavailable.
    }
}
