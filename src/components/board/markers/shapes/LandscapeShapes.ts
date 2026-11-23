import { Color, Vector3 } from 'three'

import {
    addBox, addCone, addContact, addCylinder, addDisc, addRoof, addSphere, addStrut
} from '../primitives'
import type { MarkerShape, SymbolContext } from '../MarkerCatalog'

// Every builder works in chunk-local coordinates. `ctx.groundOffset` bends
// each contact point onto the terrain, so a wide base never hangs in the air
// on a slope.
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

const lighthouse: MarkerShape = {
    id: 'lighthouse',
    label: 'Latarnia morska',
    placement: 'center',
    footprint: 10,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 3.6)
        addCylinder(builder, local(ctx, 0, 0, 0), 3, 1.6, 10, palette.stone, palette.stone)

        let y = 1.6
        let radius = 2.5
        for (let i = 0; i < 4; i++) {
            addStrut(builder, local(ctx, 0, y, 0), local(ctx, 0, y + 3.2, 0), radius, radius - 0.16, 10,
                i % 2 === 0 ? palette.white : palette.red)
            y += 3.2
            radius -= 0.16
        }

        // Gallery deck, railing posts and a closed handrail ring.
        addDisc(builder, local(ctx, 0, y, 0), 3.1, 10, palette.stone)
        const posts = 8
        for (let i = 0; i < posts; i++) {
            const angle = (i * Math.PI * 2) / posts
            const px = Math.cos(angle) * 2.8
            const pz = Math.sin(angle) * 2.8
            addStrut(builder, local(ctx, px, y, pz), local(ctx, px, y + 1.5, pz), 0.12, 0.12, 4, palette.charcoal)
            const next = ((i + 1) * Math.PI * 2) / posts
            addStrut(
                builder,
                local(ctx, px, y + 1.5, pz),
                local(ctx, Math.cos(next) * 2.8, y + 1.5, Math.sin(next) * 2.8),
                0.1, 0.1, 4, palette.charcoal
            )
        }

        // Open-ended so the capped roof above is the only disc at this height.
        addStrut(builder, local(ctx, 0, y, 0), local(ctx, 0, y + 3, 0), 1.7, 1.7, 8,
            palette.tinted(palette.primary, 0.45))
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2
            const px = Math.cos(angle) * 1.7
            const pz = Math.sin(angle) * 1.7
            addStrut(builder, local(ctx, px, y + 0.2, pz), local(ctx, px, y + 3, pz), 0.1, 0.1, 4, palette.charcoal)
        }
        // Capped roof: an open cone used to leave a visible hole from above.
        addCone(builder, local(ctx, 0, y + 3, 0), 2.15, 2.2, 10, palette.red, true)
        addCylinder(builder, local(ctx, 0, y + 5.2, 0), 0.22, 0.8, 6, palette.charcoal)
        addCone(builder, local(ctx, 0, y + 6, 0), 0.4, 0.7, 6, palette.accent, true)
    },
}

const pine: MarkerShape = {
    id: 'pine',
    label: 'Iglaki',
    placement: 'cluster',
    footprint: 6,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 4.3)
        addStrut(builder, local(ctx, 0, 0, 0), local(ctx, 0, 7, 0), 0.75, 0.45, 5, palette.wood)
        addCone(builder, local(ctx, 0, 2.5, 0), 4.2, 7, 7, palette.tinted(palette.pine, 0.16))
        addCone(builder, local(ctx, 0, 6.5, 0), 3.4, 6.5, 7, palette.tinted(palette.pine, 0.1))
        addCone(builder, local(ctx, 0, 10.5, 0), 2.5, 6, 7, palette.tinted(palette.pine, 0.22), true)
    },
}

const oak: MarkerShape = {
    id: 'oak',
    label: 'Liściaste',
    placement: 'cluster',
    footprint: 8,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 5)
        addStrut(builder, local(ctx, 0, 0, 0), local(ctx, 0, 8, 0), 0.9, 0.6, 6, palette.wood)
        addCylinder(builder, local(ctx, 0, 7, 0), 4.2, 6, 7, palette.tinted(palette.leaf, 0.16))
        addCylinder(builder, local(ctx, -2.8, 6.2, 0.8), 2.9, 5, 6, palette.tinted(palette.leaf, 0.26))
        addCylinder(builder, local(ctx, 2.7, 6.8, -0.9), 3.1, 5.2, 6, palette.tinted(palette.leaf, 0.08))
        addCylinder(builder, local(ctx, 0.4, 9.4, 2.4), 2.6, 4.6, 6, palette.tinted(palette.leaf, 0.2))
    },
}

const chimney: MarkerShape = {
    id: 'chimney',
    label: 'Kominy',
    placement: 'row',
    footprint: 5,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 2.9)
        addBox(builder, local(ctx, 0, 1, 0), 3.8, 2, 3.8, palette.stone)

        let y = 2
        for (let i = 0; i < 4; i++) {
            addBox(
                builder,
                local(ctx, 0, y + 2.3, 0),
                3,
                4.6,
                3,
                i % 2 === 0 ? palette.red : palette.white
            )
            y += 4.6
        }
        addBox(builder, local(ctx, 0, y + 0.35, 0), 3.5, 0.7, 3.5, palette.charcoal)
        addBox(builder, local(ctx, 0, y - 1.2, 1.56), 3.1, 0.7, 0.1, palette.tinted(palette.primary, 0.5))
        addCylinder(builder, local(ctx, 1.9, y - 1.4, 0.7), 1, 1.4, 6, palette.metal)
        addCylinder(builder, local(ctx, 3, y + 0.2, 1.4), 0.8, 1.2, 6, palette.metal)
    },
}

const windmill: MarkerShape = {
    id: 'windmill',
    label: 'Wiatraki',
    placement: 'ring',
    footprint: 16,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 3.4)
        addStrut(builder, local(ctx, 0, 0, 0), local(ctx, 0, 16, 0), 2.5, 1.3, 10, palette.white)
        addCone(builder, local(ctx, 0, 16, 0), 1.9, 2.4, 10, palette.roof, true)

        const hub = local(ctx, 0, 13.4, 2.1)
        addStrut(builder, hub, local(ctx, 0, 13.4, 2.9), 0.9, 0.7, 6, palette.charcoal)

        for (let i = 0; i < 4; i++) {
            const angle = ctx.rotation + (i * Math.PI) / 2
            const dx = Math.cos(angle)
            const dy = Math.sin(angle)
            addStrut(
                builder,
                hub,
                local(ctx, dx * 7, 13.4 + dy * 7, 2.5),
                0.32, 0.14, 4, palette.wood
            )
            // Broad white sails, offset sideways from the slim wooden spar.
            const sx = -dy * 0.9
            const sy = dx * 0.9
            builder.quad(
                local(ctx, dx * 1.6 + sx, 13.4 + dy * 1.6 + sy, 2.6),
                local(ctx, dx * 6.6 + sx, 13.4 + dy * 6.6 + sy, 2.6),
                local(ctx, dx * 6.6 - sx, 13.4 + dy * 6.6 - sy, 2.6),
                local(ctx, dx * 1.6 - sx, 13.4 + dy * 1.6 - sy, 2.6),
                palette.white
            )
        }
        addDisc(builder, local(ctx, 0, 13.4, 2.9), 0.95, 8, palette.tinted(palette.primary, 0.55))
    },
}

const tower: MarkerShape = {
    id: 'tower',
    label: 'Anteny',
    placement: 'ring',
    footprint: 6,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 3.3)
        const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]

        const legPoint = (sx: number, sz: number, t: number): Vector3 => {
            const spread = 2.4 + (0.8 - 2.4) * t
            return local(ctx, sx * spread, 20 * t, sz * spread)
        }

        for (const [sx, sz] of corners) {
            addStrut(builder, legPoint(sx, sz, 0), legPoint(sx, sz, 1), 0.45, 0.24, 4, palette.charcoal)
        }
        for (const level of [0.2, 0.42, 0.64, 0.86]) {
            for (let i = 0; i < 4; i++) {
                const [ax, az] = corners[i]
                const [bx, bz] = corners[(i + 1) % 4]
                addStrut(
                    builder,
                    legPoint(ax, az, level),
                    legPoint(bx, bz, level + 0.12),
                    0.18, 0.18, 4, palette.tinted(palette.metal, 0.4)
                )
            }
        }

        addBox(builder, local(ctx, 0, 20.2, 0), 3.8, 0.6, 3.8, palette.charcoal)
        addStrut(builder, local(ctx, 0, 20.5, 0), local(ctx, 0, 25.5, 0), 0.26, 0.08, 4, palette.metal)
        addCone(builder, local(ctx, 0, 25.2, 0), 0.55, 1.2, 5, palette.tinted(palette.primary, 0.5), true)
    },
}

const silo: MarkerShape = {
    id: 'silo',
    label: 'Silosy',
    placement: 'ring',
    footprint: 6,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 3.6)
        // The capped cone is the roof; leaving this body open avoids two
        // coplanar discs at the join.
        addStrut(builder, local(ctx, 0, 0, 0), local(ctx, 0, 14, 0), 3, 3, 10, palette.metal)

        for (const y of [3.2, 7, 10.8]) {
            addDisc(builder, local(ctx, 0, y, 0), 3.12, 10, palette.stone)
        }
        addCone(builder, local(ctx, 0, 14, 0), 3.2, 3.2, 10, palette.tinted(palette.primary, 0.5), true)

        addStrut(builder, local(ctx, 3.2, 0.6, -0.4), local(ctx, 3.2, 13, -0.4), 0.14, 0.14, 4, palette.wood)
        addStrut(builder, local(ctx, 3.2, 0.6, 0.4), local(ctx, 3.2, 13, 0.4), 0.14, 0.14, 4, palette.wood)
    },
}

const village: MarkerShape = {
    id: 'village',
    label: 'Wioska',
    placement: 'row',
    footprint: 7,
    build: (ctx) => {
        const { builder, palette } = ctx
        contact(ctx, 3.7)
        // Houses stay aligned: a village should look planned from above.
        addBox(builder, local(ctx, 0, 3, 0), 5, 6, 4.2, palette.white)
        addRoof(builder, local(ctx, 0, 6, 0), 6, 5.2, 3, palette.tinted(palette.roof, 0.35), palette.roof)
        addBox(builder, local(ctx, 0, 1.7, 2.14), 1.2, 3.4, 0.12, palette.wood)
        addBox(builder, local(ctx, 1.6, 4, 2.14), 1, 1, 0.12, palette.tinted(palette.primary, 0.5))
    },
}

const MINE_BLACK = new Color(0x050505)

const mine: MarkerShape = {
    id: 'mine',
    label: 'Mina',
    placement: 'center',
    footprint: 18,
    build: (ctx) => {
        addSphere(ctx.builder, local(ctx, 0, 4.4, 0), 4.4, 8, 16, MINE_BLACK)
    },
}

export const LANDSCAPE_SHAPES: MarkerShape[] = [
    lighthouse, pine, oak, chimney, windmill, tower, silo, village, mine
]
