import { Color } from 'three'

import { getShape } from './MarkerCatalog'
import { hashString, placeSymbols } from './placement'
import { primaryHex } from './colorways'
import { defaultCount } from './MarkerConfig'
import mulberry32 from '../../../utils/random'
import type { ColorwayId } from './colorways'
import type { MarkerValue, ShapeId } from './MarkerConfig'

const WHITE = new Color(0xffffff)
const BLACK = new Color(0x000000)

interface PreviewColors {
    primary: string
    light: string
    dark: string
    accent: string
}

function styleOf(hex: number, mix: number, target: Color): string {
    return new Color(hex).lerp(target, mix).getStyle()
}

function colorsFor(colorway: ColorwayId, value: MarkerValue): PreviewColors {
    const hex = primaryHex(colorway, value)
    return {
        primary: styleOf(hex, 0, BLACK),
        light: styleOf(hex, 0.5, WHITE),
        dark: styleOf(hex, 0.4, BLACK),
        accent: colorway === 'neon' ? '#ff3df2' : '#ffcc4d',
    }
}

function wedge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    start: number,
    end: number,
    color: string
): void {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, radius, start, end)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
}

function drawGlyph(
    ctx: CanvasRenderingContext2D,
    id: ShapeId,
    x: number,
    y: number,
    radius: number,
    colors: PreviewColors
): void {
    switch (id) {
        case 'lighthouse':
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fillStyle = colors.light
            ctx.fill()
            for (let i = 0; i < 4; i++) {
                wedge(ctx, x, y, radius, (i * Math.PI) / 2, (i * Math.PI) / 2 + Math.PI / 4, colors.primary)
            }
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.34, 0, Math.PI * 2)
            ctx.fillStyle = colors.accent
            ctx.fill()
            break

        case 'pine':
            ctx.beginPath()
            ctx.moveTo(x, y - radius)
            ctx.lineTo(x + radius * 0.82, y + radius * 0.7)
            ctx.lineTo(x - radius * 0.82, y + radius * 0.7)
            ctx.closePath()
            ctx.fillStyle = colors.primary
            ctx.fill()
            ctx.beginPath()
            ctx.moveTo(x, y - radius * 0.2)
            ctx.lineTo(x + radius * 0.55, y + radius)
            ctx.lineTo(x - radius * 0.55, y + radius)
            ctx.closePath()
            ctx.fillStyle = colors.dark
            ctx.fill()
            break

        case 'oak':
            ctx.fillStyle = colors.primary
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = colors.light
            ctx.beginPath()
            ctx.arc(x - radius * 0.4, y - radius * 0.3, radius * 0.45, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = colors.dark
            ctx.beginPath()
            ctx.arc(x + radius * 0.42, y + radius * 0.28, radius * 0.42, 0, Math.PI * 2)
            ctx.fill()
            break

        case 'chimney': {
            const w = radius * 0.9
            const h = radius * 1.7
            ctx.fillStyle = colors.light
            ctx.fillRect(x - w / 2, y - h / 2, w, h)
            ctx.fillStyle = colors.primary
            for (let i = 0; i < 4; i += 2) {
                ctx.fillRect(x - w / 2, y - h / 2 + (i * h) / 4, w, h / 4)
            }
            ctx.fillStyle = colors.dark
            ctx.fillRect(x - w / 2, y - h / 2, w, 2)
            break
        }

        case 'windmill':
            ctx.fillStyle = colors.primary
            for (let i = 0; i < 3; i++) {
                wedge(ctx, x, y, radius, (i * Math.PI * 2) / 3 - 0.24, (i * Math.PI * 2) / 3 + 0.24, colors.primary)
            }
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.26, 0, Math.PI * 2)
            ctx.fillStyle = colors.accent
            ctx.fill()
            break

        case 'tower':
        case 'pylon':
            ctx.strokeStyle = colors.dark
            ctx.lineWidth = Math.max(1.5, radius * 0.22)
            ctx.strokeRect(x - radius * 0.6, y - radius * 0.6, radius * 1.2, radius * 1.2)
            ctx.beginPath()
            ctx.moveTo(x - radius * 0.6, y - radius * 0.6)
            ctx.lineTo(x + radius * 0.6, y + radius * 0.6)
            ctx.moveTo(x + radius * 0.6, y - radius * 0.6)
            ctx.lineTo(x - radius * 0.6, y + radius * 0.6)
            ctx.stroke()
            if (id === 'pylon') {
                ctx.beginPath()
                ctx.moveTo(x - radius, y)
                ctx.lineTo(x + radius, y)
                ctx.strokeStyle = colors.primary
                ctx.stroke()
            }
            break

        case 'silo':
        case 'waterTower':
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2)
            ctx.fillStyle = colors.light
            ctx.fill()
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.62, 0, Math.PI * 2)
            ctx.fillStyle = colors.primary
            ctx.fill()
            ctx.fillStyle = colors.dark
            for (const [dx, dy] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
                ctx.fillRect(x + dx * radius, y + dy * radius, 1.5, 1.5)
            }
            break

        case 'village':
        case 'barn': {
            const w = radius * 1.5
            ctx.fillStyle = colors.light
            ctx.fillRect(x - w / 2, y - radius * 0.1, w, radius * 0.9)
            ctx.fillStyle = colors.primary
            ctx.beginPath()
            ctx.moveTo(x - w / 2 - 1, y - radius * 0.1)
            ctx.lineTo(x, y - radius * 0.95)
            ctx.lineTo(x + w / 2 + 1, y - radius * 0.1)
            ctx.closePath()
            ctx.fill()
            break
        }

        case 'mine':
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.46, 0, Math.PI * 2)
            ctx.fillStyle = '#050505'
            ctx.fill()
            break
    }
}

// The 2D icon uses the very same placement function as the 3D marker, so the
// preview shows the actual count and spacing the player will get on the tile.
export function drawPreview(
    canvas: HTMLCanvasElement,
    shapeId: ShapeId,
    value: MarkerValue
): void {
    const colorway: ColorwayId = 'classic'
    const count = defaultCount(value)
    const size = canvas.clientWidth || 56
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const shape = getShape(shapeId)
    const rng = mulberry32(hashString(`${shapeId}:${value}:${count}`))
    const placed = placeSymbols(count, shape.placement, shape.footprint, rng)
    const colors = colorsFor(colorway, value)
    const unit = size / 38

    for (const symbol of placed) {
        drawGlyph(
            ctx,
            shape.id,
            size / 2 + symbol.x * unit,
            size / 2 + symbol.z * unit,
            Math.max(2.5, shape.footprint * symbol.scale * 0.5 * unit),
            colors
        )
    }
}
