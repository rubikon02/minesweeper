import { Matrix4, Vector3 } from 'three'

import MarkerModels from './MarkerModels'
import type { ShapeId } from './MarkerConfig'
import type { Placement } from './placement'
import type { Palette } from './colorways'
import type MeshBuilder from './MeshBuilder'
import { LANDSCAPE_SHAPES } from './shapes/LandscapeShapes'
import { ALTERNATE_SHAPES } from './shapes/AlternateShapes'

// One placed copy of a motif. The chunk origin is already subtracted from
// `center`, so geometry stays precise even far from spawn.
export interface SymbolContext {
    builder: MeshBuilder
    center: Vector3
    worldX: number
    worldZ: number
    count: number
    rotation: number
    scale: number
    palette: Palette
    rng: () => number
    // Height difference from the symbol centre at a world-unit offset.
    // Lets every contact point follow the terrain instead of floating.
    groundOffset(dx: number, dz: number): number
}

export interface MarkerShape {
    id: ShapeId
    label: string
    placement: Placement
    // Diameter of one copy at scale 1. Drives both spacing and the 2D preview.
    footprint: number
    build(ctx: SymbolContext): void
}

const SHAPES = new Map<ShapeId, MarkerShape>()
for (const shape of [...LANDSCAPE_SHAPES, ...ALTERNATE_SHAPES]) {
    const proceduralBuild = shape.build
    SHAPES.set(shape.id, {
        ...shape,
        // Ready-made CC0 models carry the look; the old geometry is kept as a
        // fallback while assets load and if a file is missing.
        build: (ctx) => {
            const parts = MarkerModels.getParts(shape.id)
            if (!parts || parts.length === 0) {
                proceduralBuild(ctx)
                return
            }

            const transform = new Matrix4()
                .makeTranslation(ctx.center.x, ctx.center.y, ctx.center.z)
                .multiply(new Matrix4().makeRotationY(ctx.rotation))
                .multiply(new Matrix4().makeScale(ctx.scale, ctx.scale, ctx.scale))

            for (const part of parts) {
                ctx.builder.appendGeometry(
                    part.geometry,
                    part.colors,
                    transform,
                    (x, z) => ctx.groundOffset(x - ctx.center.x, z - ctx.center.z)
                )
            }
        },
    })
}

export function getShape(id: ShapeId): MarkerShape {
    return SHAPES.get(id) ?? LANDSCAPE_SHAPES[0]
}

export function allShapes(): MarkerShape[] {
    return [...LANDSCAPE_SHAPES, ...ALTERNATE_SHAPES]
}
