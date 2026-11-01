import {
    DoubleSide,
    Group,
    CylinderGeometry,
    ConeGeometry,
    MeshStandardMaterial,
    Mesh,
    Object3D,
    Material,
    LoadingManager
} from 'three'

import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import obj from '../../assets/flag.obj'
import mtl from '../../assets/flag.mtl'
import type Tile from './Tile'
import type Board from './Board'

export default class Flag {
    public tile: Tile
    public board: Board
    public x: number
    public z: number
    public mesh: Object3D | null = null

    constructor(tile: Tile) {
        this.tile = tile
        this.board = this.tile.board
        this.x = this.tile.x
        this.z = this.tile.z
    }

    public static preload(manager: LoadingManager, callback: (flag: Object3D) => void): void {
        const mtlLoader = new MTLLoader(manager)
        mtlLoader.load(
            mtl,
            materials => {
                materials.preload()
                const objLoader = new OBJLoader(manager)
                objLoader.setMaterials(materials)
                objLoader.load(
                    obj,
                    flag => {
                        callback(flag)
                    },
                    undefined,
                    err => {
                        console.warn("Failed to load flag.obj, fallback will be used", err)
                    }
                )
            },
            undefined,
            err => {
                console.warn("Failed to load flag.mtl, fallback will be used", err)
            }
        )
    }

    private createFallbackMesh(): Group {
        const group = new Group()

        const poleGeo = new CylinderGeometry(0.6, 0.6, 18, 8)
        const poleMat = new MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 })
        const pole = new Mesh(poleGeo, poleMat)
        pole.position.y = 9
        group.add(pole)

        const flagGeo = new ConeGeometry(5, 8, 3)
        const flagMat = new MeshStandardMaterial({ color: 0xef4444, side: DoubleSide, roughness: 0.4 })
        const flag = new Mesh(flagGeo, flagMat)
        flag.rotation.z = Math.PI / 2
        flag.position.set(3, 14, 0)
        group.add(flag)

        return group
    }

    public load(): void {
        if (this.board.preloadedFlag) {
            this.mesh = this.board.preloadedFlag.clone()
            this.mesh.traverse(child => {
                const meshChild = child as Mesh
                if (meshChild.isMesh && meshChild.material) {
                    if (Array.isArray(meshChild.material)) {
                        meshChild.material = meshChild.material.map(m => {
                            const cloned = m.clone()
                            cloned.side = DoubleSide
                            return cloned
                        })
                    } else {
                        const cloned = (meshChild.material as Material).clone()
                        cloned.side = DoubleSide
                        meshChild.material = cloned
                    }
                }
            })

            if (this.mesh.children && this.mesh.children.length > 0) {
                const first = this.mesh.children[0] as Mesh
                if (first && first.material && 'color' in first.material) {
                    (first.material as MeshStandardMaterial).color.set(0xef4444)
                }
            }
        } else {
            this.mesh = this.createFallbackMesh()
        }
        this.mesh.scale.setScalar(2)
        this.setPosition()
    }

    public setPosition(): void {
        if (!this.mesh) return

        // Infinite board: grid coordinate 0 sits at world 0, so the tile
        // centre is just (x + 0.5) tiles along each axis.
        this.mesh.position.x = this.tile.worldX
        this.mesh.position.z = this.tile.worldZ
        this.mesh.position.y = this.board.terrain.heightAtWorld(this.mesh.position.x, this.mesh.position.z)
    }

    public isVisible(): boolean {
        return !!(this.mesh && this.mesh.parent === this.board.game.scene)
    }

    public setVisible(visible: boolean): void {
        if (visible) {
            if (!this.mesh) {
                this.load()
            }
            if (this.mesh && !this.isVisible()) {
                this.board.game.scene.add(this.mesh)
            }
        } else if (this.mesh && this.isVisible()) {
            this.board.game.scene.remove(this.mesh)
        }
    }
}
