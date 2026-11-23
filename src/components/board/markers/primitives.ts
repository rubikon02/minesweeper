import { Color, Vector3 } from 'three'

import type MeshBuilder from './MeshBuilder'
import type { Palette } from './colorways'

const UP = new Vector3(0, 1, 0)

function point(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z)
}

export function addBox(
    builder: MeshBuilder,
    center: Vector3,
    width: number,
    height: number,
    depth: number,
    color: Color
): void {
    const x0 = center.x - width / 2
    const x1 = center.x + width / 2
    const y0 = center.y - height / 2
    const y1 = center.y + height / 2
    const z0 = center.z - depth / 2
    const z1 = center.z + depth / 2

    builder.quad(point(x0, y1, z0), point(x1, y1, z0), point(x1, y1, z1), point(x0, y1, z1), color)
    builder.quad(point(x0, y0, z1), point(x1, y0, z1), point(x1, y0, z0), point(x0, y0, z0), color)
    builder.quad(point(x0, y0, z1), point(x1, y0, z1), point(x1, y1, z1), point(x0, y1, z1), color)
    builder.quad(point(x1, y0, z0), point(x0, y0, z0), point(x0, y1, z0), point(x1, y1, z0), color)
    builder.quad(point(x0, y0, z0), point(x0, y0, z1), point(x0, y1, z1), point(x0, y1, z0), color)
    builder.quad(point(x1, y0, z1), point(x1, y0, z0), point(x1, y1, z0), point(x1, y1, z1), color)
}

// A faceted strut between two arbitrary points. Used for trunks, lattice
// braces, windmill blades and mine spikes so they all share one silhouette.
export function addStrut(
    builder: MeshBuilder,
    from: Vector3,
    to: Vector3,
    bottomRadius: number,
    topRadius: number,
    sides: number,
    color: Color
): void {
    const direction = to.clone().sub(from)
    if (direction.lengthSq() < 0.0001) return
    direction.normalize()

    const hint = Math.abs(direction.y) > 0.9 ? new Vector3(1, 0, 0) : UP
    const side = new Vector3().crossVectors(direction, hint).normalize()
    const side2 = new Vector3().crossVectors(direction, side).normalize()

    for (let i = 0; i < sides; i++) {
        const a0 = (i * Math.PI * 2) / sides
        const a1 = ((i + 1) * Math.PI * 2) / sides
        const p0 = from.clone()
            .addScaledVector(side, Math.cos(a0) * bottomRadius)
            .addScaledVector(side2, Math.sin(a0) * bottomRadius)
        const p1 = from.clone()
            .addScaledVector(side, Math.cos(a1) * bottomRadius)
            .addScaledVector(side2, Math.sin(a1) * bottomRadius)
        const q0 = to.clone()
            .addScaledVector(side, Math.cos(a0) * topRadius)
            .addScaledVector(side2, Math.sin(a0) * topRadius)
        const q1 = to.clone()
            .addScaledVector(side, Math.cos(a1) * topRadius)
            .addScaledVector(side2, Math.sin(a1) * topRadius)
        builder.quad(p0, p1, q1, q0, color)
    }
}

export function addCylinder(
    builder: MeshBuilder,
    center: Vector3,
    radius: number,
    height: number,
    sides: number,
    color: Color,
    topColor: Color = color
): void {
    const bottom = point(center.x, center.y, center.z)
    const top = point(center.x, center.y + height, center.z)
    addStrut(builder, bottom, top, radius, radius, sides, color)

    const rim: Vector3[] = []
    for (let i = 0; i < sides; i++) {
        const angle = (i * Math.PI * 2) / sides
        rim.push(point(
            center.x + Math.cos(angle) * radius,
            center.y + height,
            center.z + Math.sin(angle) * radius
        ))
    }
    for (let i = 0; i < sides; i++) {
        builder.tri(top, rim[i], rim[(i + 1) % sides], topColor)
    }
}

export function addCone(
    builder: MeshBuilder,
    base: Vector3,
    radius: number,
    height: number,
    sides: number,
    color: Color,
    capBottom = false
): void {
    const tip = point(base.x, base.y + height, base.z)
    for (let i = 0; i < sides; i++) {
        const a0 = (i * Math.PI * 2) / sides
        const a1 = ((i + 1) * Math.PI * 2) / sides
        const p0 = point(base.x + Math.cos(a0) * radius, base.y, base.z + Math.sin(a0) * radius)
        const p1 = point(base.x + Math.cos(a1) * radius, base.y, base.z + Math.sin(a1) * radius)
        builder.tri(p0, p1, tip, color)
    }
    // An open cone reads as a hole when seen from above.
    if (capBottom) addDisc(builder, base, radius, sides, color)
}

export function addDisc(
    builder: MeshBuilder,
    center: Vector3,
    radius: number,
    sides: number,
    color: Color,
    groundOffset?: (dx: number, dz: number) => number
): void {
    for (let i = 0; i < sides; i++) {
        const a0 = (i * Math.PI * 2) / sides
        const a1 = ((i + 1) * Math.PI * 2) / sides
        const dx0 = Math.cos(a0) * radius
        const dz0 = Math.sin(a0) * radius
        const dx1 = Math.cos(a1) * radius
        const dz1 = Math.sin(a1) * radius
        builder.tri(
            center,
            point(center.x + dx0, center.y + (groundOffset?.(dx0, dz0) ?? 0), center.z + dz0),
            point(center.x + dx1, center.y + (groundOffset?.(dx1, dz1) ?? 0), center.z + dz1),
            color
        )
    }
}

// Low-poly sphere used for the mine: a plain ball reads much better at a
// distance than a cluster of spikes and antenna-like stems.
export function addSphere(
    builder: MeshBuilder,
    center: Vector3,
    radius: number,
    rings: number,
    segments: number,
    color: Color
): void {
    const vertex = (ring: number, segment: number): Vector3 => {
        const phi = (ring * Math.PI) / rings
        const theta = (segment * Math.PI * 2) / segments
        const radial = Math.sin(phi) * radius
        return point(
            center.x + Math.cos(theta) * radial,
            center.y + Math.cos(phi) * radius,
            center.z + Math.sin(theta) * radial
        )
    }

    const top = point(center.x, center.y + radius, center.z)
    const bottom = point(center.x, center.y - radius, center.z)

    for (let ring = 0; ring < rings; ring++) {
        for (let segment = 0; segment < segments; segment++) {
            const p0 = vertex(ring, segment)
            const p1 = vertex(ring, segment + 1)
            const q0 = vertex(ring + 1, segment)
            const q1 = vertex(ring + 1, segment + 1)

            if (ring === 0) {
                // p0/p1 collapse onto the pole, so cap with the next ring.
                builder.tri(top, q1, q0, color)
            } else if (ring === rings - 1) {
                // q0/q1 collapse onto the pole, so cap from this ring.
                builder.tri(p0, p1, bottom, color)
            } else {
                builder.quad(p0, p1, q1, q0, color)
            }
        }
    }
}

// Gabled roof with the ridge running along Z. The end triangles close the
// silhouette so buildings read correctly from above, not just from the side.
export function addRoof(
    builder: MeshBuilder,
    base: Vector3,
    width: number,
    depth: number,
    height: number,
    color: Color,
    endColor: Color = color
): void {
    const left = base.x - width / 2
    const right = base.x + width / 2
    const front = base.z - depth / 2
    const back = base.z + depth / 2
    const ridgeY = base.y + height

    // The ridge must follow `base.x`: chunks are built in world-origin-local
    // coordinates, so a literal x=0 would pull far-away roofs back to spawn.
    builder.quad(
        point(left, base.y, front),
        point(base.x, ridgeY, front),
        point(base.x, ridgeY, back),
        point(left, base.y, back),
        color
    )
    builder.quad(
        point(base.x, ridgeY, front),
        point(right, base.y, front),
        point(right, base.y, back),
        point(base.x, ridgeY, back),
        color
    )
    builder.tri(point(left, base.y, front), point(right, base.y, front), point(base.x, ridgeY, front), endColor)
    builder.tri(point(right, base.y, back), point(left, base.y, back), point(base.x, ridgeY, back), endColor)
}

// A dark footprint anchors each symbol to the slope instead of letting it
// read as a floating cut-out. Its rim follows the same height sampler as the
// rest of the symbol, so no daylight shows under an object on a hillside.
export function addContact(
    builder: MeshBuilder,
    base: Vector3,
    radius: number,
    palette: Palette,
    groundOffset?: (dx: number, dz: number) => number
): void {
    addDisc(
        builder,
        point(base.x, base.y - 0.45, base.z),
        radius,
        10,
        palette.charcoal,
        groundOffset
    )
}
