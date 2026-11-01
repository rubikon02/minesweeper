import {
    BufferGeometry,
    InstancedMesh,
    Material,
    Matrix4,
    Mesh,
    Object3D,
    Vector3
} from 'three'

// One part of a template model (a single mesh inside the GLB).
export interface Part {
    geometry: BufferGeometry
    material: Material | Material[]
    matrix: Matrix4
}

// One placed prop. It maps to the same instance index across every
// InstancedMesh used by its template, so visibility is one matrix write
// per part instead of cloning whole object trees.
export default class DecoInstance {
    private meshes: InstancedMesh[]
    private parts: Matrix4[]
    private index: number
    private position: Vector3
    private rotationY: number
    private scale: number
    private visible = true

    constructor(
        meshes: InstancedMesh[],
        parts: Matrix4[],
        index: number,
        position: Vector3,
        rotationY: number,
        scale: number
    ) {
        this.meshes = meshes
        this.parts = parts
        this.index = index
        this.position = position
        this.rotationY = rotationY
        this.scale = scale
        this.apply()
    }

    public setVisible(visible: boolean): void {
        if (visible === this.visible) return
        this.visible = visible
        this.apply()
    }

    private apply(): void {
        dummy.position.copy(this.position)
        dummy.rotation.set(0, this.rotationY, 0)
        dummy.scale.setScalar(this.visible ? this.scale : 0)
        dummy.updateMatrix()
        baseMatrix.copy(dummy.matrix)

        for (let i = 0; i < this.meshes.length; i++) {
            finalMatrix.multiplyMatrices(baseMatrix, this.parts[i])
            this.meshes[i].setMatrixAt(this.index, finalMatrix)
            this.meshes[i].instanceMatrix.needsUpdate = true
        }
    }
}

const dummy = new Object3D()
const baseMatrix = new Matrix4()
const finalMatrix = new Matrix4()

// Nature kit materials are fully metallic by default, which looks dark
// without an environment map. Props and markers share the same fix.
export function prepareNatureModel(object: Object3D): void {
    object.traverse(child => {
        const mesh = child as Mesh
        if (!mesh.isMesh || !mesh.material) return

        const fix = (m: Material): Material => {
            const std = m as unknown as { metalness?: number, roughness?: number }
            if ('metalness' in std) {
                std.metalness = 0
                std.roughness = 0.9
            }
            return m
        }

        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(fix)
            : fix(mesh.material)
        mesh.castShadow = false
        mesh.receiveShadow = false
    })
}

// Flatten a loaded model into parts relative to its root, so one template
// drives every instance and chunk-level coordinates stay local.
export function collectModelParts(object: Object3D): Part[] {
    object.updateMatrixWorld(true)
    const rootInverse = new Matrix4().copy(object.matrixWorld).invert()
    const parts: Part[] = []

    object.traverse(child => {
        const mesh = child as Mesh
        if (!mesh.isMesh || !mesh.geometry) return
        parts.push({
            geometry: mesh.geometry,
            material: mesh.material,
            matrix: new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld),
        })
    })

    return parts
}
