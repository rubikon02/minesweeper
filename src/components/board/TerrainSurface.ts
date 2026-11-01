import {
    BufferGeometry,
    BufferAttribute
} from 'three'

import type Terrain from './Terrain'

export interface TerrainSurfaceOptions {
    // World position of the surface's minimum corner.
    originX: number
    originZ: number
    // Number of cells along each axis.
    cells: number
    // World size of one cell. Origins and steps sit on tile-grid corners so
    // every sample is an exact corner height.
    step: number
}

// Build one merged terrain surface as a grid of quads. Chunk uses a dense
// grid, Horizon a coarse one; both share this triangulation, UV and colour
// scheme so the two copies cannot drift. Positions are local to the origin.
export function buildTerrainSurface(
    terrain: Terrain,
    { originX, originZ, cells, step }: TerrainSurfaceOptions
): BufferGeometry {
    const quads = cells * cells

    const positions = new Float32Array(quads * 18)
    const uvs = new Float32Array(quads * 12)
    const colors = new Float32Array(quads * 18)

    let pi = 0
    let ui = 0
    let ci = 0

    for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
            const x0 = originX + i * step
            const z0 = originZ + j * step
            const x1 = x0 + step
            const z1 = z0 + step

            const gx0 = x0 / terrain.tileSize
            const gz0 = z0 / terrain.tileSize
            const gx1 = x1 / terrain.tileSize
            const gz1 = z1 / terrain.tileSize

            const ha = terrain.heightAt(gx0, gz0)
            const hb = terrain.heightAt(gx1, gz0)
            const hc = terrain.heightAt(gx0, gz1)
            const hd = terrain.heightAt(gx1, gz1)

            // Triangles a,d,b then a,c,d.
            // a = (x0,z0) b = (x1,z0) c = (x0,z1) d = (x1,z1)
            positions[pi++] = x0 - originX; positions[pi++] = ha; positions[pi++] = z0 - originZ
            positions[pi++] = x1 - originX; positions[pi++] = hd; positions[pi++] = z1 - originZ
            positions[pi++] = x1 - originX; positions[pi++] = hb; positions[pi++] = z0 - originZ
            positions[pi++] = x0 - originX; positions[pi++] = ha; positions[pi++] = z0 - originZ
            positions[pi++] = x0 - originX; positions[pi++] = hc; positions[pi++] = z1 - originZ
            positions[pi++] = x1 - originX; positions[pi++] = hd; positions[pi++] = z1 - originZ

            // Continuous UVs in global tile units, so the detail texture
            // tiles seamlessly across chunk and horizon borders.
            uvs[ui++] = gx0; uvs[ui++] = gz0
            uvs[ui++] = gx1; uvs[ui++] = gz1
            uvs[ui++] = gx1; uvs[ui++] = gz0
            uvs[ui++] = gx0; uvs[ui++] = gz0
            uvs[ui++] = gx0; uvs[ui++] = gz1
            uvs[ui++] = gx1; uvs[ui++] = gz1

            const slope = (Math.max(ha, hb, hc, hd) - Math.min(ha, hb, hc, hd)) / step
            const color = terrain.colorFor((ha + hb + hc + hd) / 4, slope)
            for (let v = 0; v < 6; v++) {
                colors[ci++] = color.r
                colors[ci++] = color.g
                colors[ci++] = color.b
            }
        }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}
