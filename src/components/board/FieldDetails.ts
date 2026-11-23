import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector3
} from 'three'

import farmFurrowsUrl from '../../assets/textures/farm_furrows.jpg'

const DEEP_WATER = new Color(0x1f6fbd)
const SHALLOW_WATER = new Color(0x2f92d6)
const SHORE = new Color(0x82c7e2)

let grainTexture: Texture | null = null

function getGrainTexture(): Texture {
    if (!grainTexture) {
        const texture = new TextureLoader().load(farmFurrowsUrl)
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = 8
        grainTexture = texture
    }
    return grainTexture
}

function finish(positions: number[], colors: number[]): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

function finishTextured(positions: number[], uvs: number[]): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

// Flat details sit a hair above the terrain. Polygon offset alone cannot save
// a coplanar mesh at grazing angles, and an actual drop below the surface made
// the furrow texture blink in and out with camera distance.
function detailMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
        flatShading: true,
        roughness: 0.95,
        metalness: 0,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
    })
}

// Low-frequency sine waves give lakes soft, rounded irregularities.
function lakeOutline(angle: number): number {
    return 1
        + 0.07 * Math.sin(angle * 2 + 0.4)
        + 0.045 * Math.sin(angle * 3 - 0.8)
        + 0.025 * Math.sin(angle * 5 + 1.7)
}

// A superellipse reads as a rounded rectangle rather than a circular heap.
// The tiny wobble keeps the bed from looking like a plastic stencil.
function grainPoint(angle: number): { x: number, z: number } {
    const exponent = 1 / 3
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const wobble = 1 + 0.018 * Math.sin(angle * 4 + 0.8)
    return {
        x: Math.sign(c) * Math.pow(Math.abs(c), exponent) * wobble,
        z: Math.sign(s) * Math.pow(Math.abs(s), exponent) * wobble,
    }
}

// Small procedural props for revealed empty tiles. They are shared templates:
// Decoration instances them per chunk exactly like the downloaded nature kit.
export default class FieldDetails {
    public static lake(): Object3D {
        const positions: number[] = []
        const colors: number[] = []

        const push = (point: Vector3, color: Color): void => {
            positions.push(point.x, point.y, point.z)
            colors.push(color.r, color.g, color.b)
        }
        const tri = (
            a: Vector3, b: Vector3, c: Vector3,
            ca: Color, cb: Color = ca, cc: Color = ca
        ): void => {
            push(a, ca)
            push(b, cb)
            push(c, cc)
        }

        const segments = 48
        const outer: Vector3[] = []
        const inner: Vector3[] = []

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2
            const radius = 8 * lakeOutline(angle)
            const x = Math.cos(angle) * radius * 1.06
            const z = Math.sin(angle) * radius * 0.9
            outer.push(new Vector3(x, 0.02, z))
            inner.push(new Vector3(x * 0.9, 0.07, z * 0.9))
        }

        const center = new Vector3(0, 0.09, 0)
        for (let i = 0; i < segments; i++) {
            const next = (i + 1) % segments
            tri(center, inner[next], inner[i], DEEP_WATER, SHALLOW_WATER, SHALLOW_WATER)
            tri(inner[i], inner[next], outer[next], SHALLOW_WATER, SHALLOW_WATER, SHORE)
            tri(inner[i], outer[next], outer[i], SHALLOW_WATER, SHORE, SHORE)
        }

        const material = detailMaterial()
        material.vertexColors = true
        const group = new Group()
        group.add(new Mesh(finish(positions, colors), material))
        return group
    }

    public static grain(): Object3D {
        const positions: number[] = []
        const uvs: number[] = []

        const halfX = 11.5
        const halfZ = 7.5
        const y = 0.02
        const push = (x: number, z: number): void => {
            positions.push(x, y, z)
            uvs.push(x / (halfX * 2) + 0.5, z / (halfZ * 2) + 0.5)
        }
        const tri = (a: { x: number, z: number }, b: { x: number, z: number }, c: { x: number, z: number }): void => {
            push(a.x, a.z)
            push(b.x, b.z)
            push(c.x, c.z)
        }

        const segments = 64
        const rim: { x: number, z: number }[] = []
        for (let i = 0; i < segments; i++) {
            const point = grainPoint((i / segments) * Math.PI * 2)
            rim.push({ x: point.x * halfX, z: point.z * halfZ })
        }

        const center = { x: 0, z: 0 }
        for (let i = 0; i < segments; i++) {
            tri(center, rim[(i + 1) % segments], rim[i])
        }

        const material = detailMaterial()
        material.map = getGrainTexture()
        const group = new Group()
        group.add(new Mesh(finishTextured(positions, uvs), material))
        return group
    }
}
