import { BufferAttribute, BufferGeometry, Color, Matrix4, Vector3 } from 'three'

// Collects triangles with a colour per vertex. Kept non-indexed so flat
// shading gives every facet its own hard edge, matching the terrain style.
export default class MeshBuilder {
    private positions: number[] = []
    private colors: number[] = []

    public tri(a: Vector3, b: Vector3, c: Vector3, color: Color): void {
        this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
        for (let i = 0; i < 3; i++) {
            this.colors.push(color.r, color.g, color.b)
        }
    }

    private triColors(a: Vector3, b: Vector3, c: Vector3, colors: Float32Array, offset: number): void {
        this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
        this.colors.push(
            colors[offset], colors[offset + 1], colors[offset + 2],
            colors[offset + 3], colors[offset + 4], colors[offset + 5],
            colors[offset + 6], colors[offset + 7], colors[offset + 8]
        )
    }

    public quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color): void {
        this.tri(a, b, c, color)
        this.tri(a, c, d, color)
    }

    // Append a loaded model part. `lift` bends every vertex onto the terrain
    // after the symbol transform, so a wide base does not float on a slope.
    public appendGeometry(
        geometry: BufferGeometry,
        colors: Color | Float32Array,
        matrix: Matrix4,
        lift?: (x: number, z: number) => number
    ): void {
        const position = geometry.getAttribute('position')
        if (!position) return
        const a = new Vector3()
        const b = new Vector3()
        const c = new Vector3()

        for (let i = 0; i < position.count; i += 3) {
            a.fromBufferAttribute(position, i).applyMatrix4(matrix)
            b.fromBufferAttribute(position, i + 1).applyMatrix4(matrix)
            c.fromBufferAttribute(position, i + 2).applyMatrix4(matrix)
            if (lift) {
                a.y += lift(a.x, a.z)
                b.y += lift(b.x, b.z)
                c.y += lift(c.x, c.z)
            }
            if (colors instanceof Float32Array) {
                this.triColors(a, b, c, colors, i * 3)
            } else {
                this.tri(a, b, c, colors)
            }
        }
    }

    public build(): BufferGeometry {
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()
        return geometry
    }
}
