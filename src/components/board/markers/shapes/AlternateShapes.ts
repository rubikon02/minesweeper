import { Vector3 } from 'three'

import { addBox, addCone, addContact, addCylinder, addRoof, addStrut } from '../primitives'
import type { MarkerShape, SymbolContext } from '../MarkerCatalog'

function local(ctx: SymbolContext, x: number, y: number, z: number): Vector3 {
    const dx = x * ctx.scale
    const dz = z * ctx.scale
    return new Vector3(
        ctx.center.x + dx,
        ctx.center.y + ctx.groundOffset(dx, dz) + y * ctx.scale,
        ctx.center.z + dz
    )
}

function contact(ctx: SymbolContext, radius: number): void {
    addContact(ctx.builder, ctx.center, radius * ctx.scale, ctx.palette, ctx.groundOffset)
}

const waterTower: MarkerShape = {
    id: 'waterTower',
    label: 'Wieża ciśnień',
    placement: 'ring',
    footprint: 8,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 4.2)
        const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        for (const [sx, sz] of corners) {
            const base = local(ctx, sx * 3, 0, sz * 3)
            const top = local(ctx, sx * 1.8, 14, sz * 1.8)
            addStrut(builder, base, top, 0.4, 0.28, 4, palette.charcoal)
        }
        for (const y of [4, 9]) {
            for (let i = 0; i < 4; i++) {
                const [ax, az] = corners[i]
                const [bx, bz] = corners[(i + 1) % 4]
                const t = y / 14
                const spread = 3 + (1.8 - 3) * t
                addStrut(
                    builder,
                    local(ctx, ax * spread, y, az * spread),
                    local(ctx, bx * spread, y + 1.2, bz * spread),
                    0.18, 0.18, 4, palette.tinted(palette.metal, 0.35)
                )
            }
        }
        // Open-ended: the capped cone below is the only top surface.
        addStrut(builder, local(ctx, 0, 13.6, 0), local(ctx, 0, 19, 0), 3.2, 3.2, 10, palette.metal)
        addCone(builder, local(ctx, 0, 19, 0), 3.5, 2.8, 10, palette.tinted(palette.roof, 0.35), true)
        addDiscRim(builder, ctx, 16.4, 3.25)
    },
}

const barn: MarkerShape = {
    id: 'barn',
    label: 'Stodoła',
    placement: 'row',
    footprint: 8,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 4.5)
        addBox(builder, local(ctx, 0, 4, 0), 7, 8, 5.5, palette.tinted(palette.red, 0.3))
        addRoof(builder, local(ctx, 0, 8, 0), 8, 6.2, 2.6, palette.roof, palette.charcoal)
        addRoof(builder, local(ctx, 0, 10.6, 0), 5.6, 6.2, 2.2, palette.roof, palette.charcoal)
        addBox(builder, local(ctx, 0, 2.4, 2.8), 2.6, 4.8, 0.14, palette.white)
        addBox(builder, local(ctx, 0, 2.4, 2.9), 0.18, 4.8, 0.1, palette.charcoal)
        addBox(builder, local(ctx, 2.6, 5.6, 2.8), 1.2, 1.2, 0.14, palette.tinted(palette.primary, 0.5))
    },
}

const pylon: MarkerShape = {
    id: 'pylon',
    label: 'Słup energetyczny',
    placement: 'ring',
    footprint: 14,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 4)
        const base = local(ctx, 0, 0, 0)
        const top = local(ctx, 0, 24, 0)
        addStrut(builder, base, top, 1.4, 0.5, 4, palette.charcoal)

        for (const y of [8, 15, 21]) {
            const halfWidth = y === 8 ? 6 : y === 15 ? 7.5 : 5
            addStrut(
                builder,
                local(ctx, -halfWidth, y, 0),
                local(ctx, halfWidth, y, 0),
                0.3, 0.3, 4, palette.metal
            )
            for (const side of [-1, 1]) {
                addStrut(
                    builder,
                    local(ctx, side * (halfWidth - 1), y - 2.4, 0),
                    local(ctx, side * halfWidth, y, 0),
                    0.22, 0.22, 4, palette.tinted(palette.primary, 0.4)
                )
                addCylinder(builder, local(ctx, side * halfWidth, y - 1.1, 0), 0.45, 1.1, 5, palette.white)
            }
        }
        addCone(builder, local(ctx, 0, 23.6, 0), 0.7, 1.6, 5, palette.tinted(palette.primary, 0.5), true)
    },
}

// A thin band around a tank, drawn as a ring of quads so it keeps the same
// flat-shaded material as everything else.
function addDiscRim(builder: SymbolContext['builder'], ctx: SymbolContext, y: number, radius: number): void {
    const sides = 10
    for (let i = 0; i < sides; i++) {
        const a0 = (i * Math.PI * 2) / sides
        const a1 = ((i + 1) * Math.PI * 2) / sides
        const p0 = local(ctx, Math.cos(a0) * radius, y, Math.sin(a0) * radius)
        const p1 = local(ctx, Math.cos(a1) * radius, y, Math.sin(a1) * radius)
        const q0 = local(ctx, Math.cos(a0) * radius, y + 0.35, Math.sin(a0) * radius)
        const q1 = local(ctx, Math.cos(a1) * radius, y + 0.35, Math.sin(a1) * radius)
        builder.quad(p0, p1, q1, q0, ctx.palette.dark)
    }
}

export const ALTERNATE_SHAPES: MarkerShape[] = [waterTower, barn, pylon]
