import {
    Vector3,
    Box3,
    DoubleSide,
    Group,
    CylinderGeometry,
    ConeGeometry,
    MeshStandardMaterial,
    Mesh
} from 'three'

import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import obj from '../../assets/flag.obj'
import mtl from '../../assets/flag.mtl'

export default class Flag {
    constructor(tile) {
        this.tile = tile
        this.board = this.tile.board
        this.x = this.tile.x
        this.z = this.tile.z
        this.game = this.board.game
        this.mesh = null
    }

    static preload(manager, callback) {
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

    createFallbackMesh() {
        const group = new Group()
        // Pole
        const poleGeo = new CylinderGeometry(0.6, 0.6, 18, 8)
        const poleMat = new MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 })
        const pole = new Mesh(poleGeo, poleMat)
        pole.position.y = 9
        group.add(pole)

        // Flag triangle
        const flagGeo = new ConeGeometry(5, 8, 3)
        const flagMat = new MeshStandardMaterial({ color: 0xef4444, side: DoubleSide, roughness: 0.4 })
        const flag = new Mesh(flagGeo, flagMat)
        flag.rotation.z = Math.PI / 2
        flag.position.set(3, 14, 0)
        group.add(flag)

        return group
    }

    load() {
        if (this.board.preloadedFlag) {
            this.mesh = this.board.preloadedFlag.clone()
            // Clone materials so we can customize without affecting other flags
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => m.clone())
                    } else {
                        child.material = child.material.clone()
                    }
                    child.material.side = DoubleSide
                }
            })
            // Tint flag cloth red
            if (this.mesh.children && this.mesh.children.length > 0) {
                if (this.mesh.children[0] && this.mesh.children[0].material) {
                    this.mesh.children[0].material.color.set(0xef4444)
                }
            }
        } else {
            this.mesh = this.createFallbackMesh()
        }
        this.setPosition()
    }

    setPosition() {
        if (!this.mesh) return

        this.mesh.position.x = this.board.tileSize * this.x - this.board.width * this.board.tileSize / 2 + this.board.tileSize / 2
        this.mesh.position.z = this.board.tileSize * this.z - this.board.height * this.board.tileSize / 2 + this.board.tileSize / 2
        this.mesh.position.y = (this.tile && this.tile.size && this.tile.size.y) ? this.tile.size.y : 7
    }

    isVisible() {
        return !!(this.mesh && this.mesh.parent === this.game.scene)
    }

    toggle() {
        if (this.isVisible()) {
            this.hide()
        } else {
            this.show()
        }
    }

    show(silent = false) {
        if (this.board.blockActions) return
        if (!this.mesh) {
            this.load()
        }
        if (this.mesh && !this.isVisible()) {
            this.game.scene.add(this.mesh)
            if (!silent && this.game.onFlagPlaced) {
                this.game.onFlagPlaced(this.tile)
            }
        }
    }

    hide(silent = false) {
        if (this.board.blockActions && !silent) return
        if (this.mesh && this.isVisible()) {
            this.game.scene.remove(this.mesh)
            if (!silent && this.game.onFlagRemoved) {
                this.game.onFlagRemoved(this.tile)
            }
        }
    }

    set(visible) {
        if (visible) {
            this.show()
        } else {
            this.hide()
        }
    }

    setSilent(visible) {
        if (visible) {
            this.show(true)
        } else {
            this.hide(true)
        }
    }
}