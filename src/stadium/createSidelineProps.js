import * as THREE from 'three';
import { ghost } from './arenaDetail.js';
import { FIELD, BOWL } from '../config/stadiumConfig.js'; // Добавили BOWL

/**
 * Creates sideline props for the CFL stadium.
 * Optimised for low polycount by reusing geometries and materials across instances.
 * @returns {THREE.Group}
 */
export function createSidelineProps() {
    const group = new THREE.Group();
    group.name = 'SidelineProps';

    const fieldWidth = FIELD.totalWidth || FIELD.width || 70;
    const fieldLength = FIELD.totalLength || 150;
    const halfWidth = fieldWidth / 2;
    const halfLength = fieldLength / 2;
    const fieldY = BOWL.fieldElevation; // Исправление: ставим объекты на уровень поля (-8)

    /* ------------------------------------------------------------------ */
    /*  Shared Materials (reused across all instances to save memory)     */
    /* ------------------------------------------------------------------ */
    const frameMat = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a2a, 
        roughness: 0.5, 
        metalness: 0.6 
    });
    const padMat = new THREE.MeshStandardMaterial({ 
        color: 0x003366, 
        roughness: 0.9 
    });
    const canopyMat = new THREE.MeshPhysicalMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    const cameraBodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        roughness: 0.4 
    });
    const lensMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.3, 
        metalness: 0.8 
    });
    const coolerMat = new THREE.MeshStandardMaterial({ 
        color: 0xcc2222, 
        roughness: 0.7 
    });
    const tentMat = new THREE.MeshStandardMaterial({ 
        color: 0xf0f0f0, 
        roughness: 0.8 
    });

    /* ------------------------------------------------------------------ */
    /*  Shared Geometries (created once, cloned via mesh instances)       */
    /* ------------------------------------------------------------------ */
    const benchBaseGeom = new THREE.BoxGeometry(15, 0.2, 1.8);
    const benchLegGeom = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const benchPadGeom = new THREE.BoxGeometry(14.8, 0.15, 1.6);
    const benchBackGeom = new THREE.BoxGeometry(14.8, 0.8, 0.15);
    const canopyRoofGeom = new THREE.BoxGeometry(15.5, 0.05, 2.2);
    const canopyPoleGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);

    const camPoleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6);
    const camLegGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const camWheelGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8);
    const camBodyGeom = new THREE.BoxGeometry(0.6, 0.4, 0.3);
    const camLensGeom = new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8);
    const camViewfinderGeom = new THREE.BoxGeometry(0.15, 0.15, 0.2);

    const tentLegGeom = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6);
    const tentRoofGeom = new THREE.BoxGeometry(3.2, 0.15, 3.2);
    const coolerGeom = new THREE.BoxGeometry(0.8, 0.6, 0.6);

    /* ------------------------------------------------------------------ */
    /*  Factory functions to build each prop type                         */
    /* ------------------------------------------------------------------ */
    function createBench() {
        const benchGroup = new THREE.Group();
        
        const base = new THREE.Mesh(benchBaseGeom, frameMat);
        base.position.y = 0.8;
        base.castShadow = true;
        benchGroup.add(base);

        const legPositions = [
            [-7.2, 0.4, -0.8], [-7.2, 0.4, 0.8],
            [7.2, 0.4, -0.8], [7.2, 0.4, 0.8]
        ];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(benchLegGeom, frameMat);
            leg.position.set(...pos);
            leg.castShadow = true;
            benchGroup.add(leg);
        });

        const pad = new THREE.Mesh(benchPadGeom, padMat);
        pad.position.y = 0.975;
        benchGroup.add(pad);

        const back = new THREE.Mesh(benchBackGeom, padMat);
        back.position.set(0, 1.3, -0.8);
        back.castShadow = true;
        benchGroup.add(back);

        const roof = new THREE.Mesh(canopyRoofGeom, canopyMat);
        roof.position.y = 2.0;
        benchGroup.add(roof);

        const polePositions = [
            [-7.5, 1.4, -1.0], [-7.5, 1.4, 1.0],
            [7.5, 1.4, -1.0], [7.5, 1.4, 1.0]
        ];
        polePositions.forEach(pos => {
            const pole = new THREE.Mesh(canopyPoleGeom, frameMat);
            pole.position.set(...pos);
            benchGroup.add(pole);
        });

        return benchGroup;
    }

    function createCameraCart() {
        const cartGroup = new THREE.Group();

        const pole = new THREE.Mesh(camPoleGeom, frameMat);
        pole.position.y = 0.9;
        pole.castShadow = true;
        cartGroup.add(pole);

        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const leg = new THREE.Mesh(camLegGeom, frameMat);
            leg.position.y = 0.6;
            leg.rotation.z = Math.PI / 6;
            leg.rotation.y = angle;
            leg.position.x = Math.cos(angle) * 0.3;
            leg.position.z = Math.sin(angle) * 0.3;
            cartGroup.add(leg);

            const wheel = new THREE.Mesh(camWheelGeom, cameraBodyMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.x = Math.cos(angle) * 0.5;
            wheel.position.z = Math.sin(angle) * 0.5;
            wheel.position.y = 0.1;
            cartGroup.add(wheel);
        }

        const body = new THREE.Mesh(camBodyGeom, cameraBodyMat);
        body.position.y = 1.3;
        body.castShadow = true;
        cartGroup.add(body);

        const lens = new THREE.Mesh(camLensGeom, lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 1.3, 0.3);
        cartGroup.add(lens);

        const viewfinder = new THREE.Mesh(camViewfinderGeom, cameraBodyMat);
        viewfinder.position.set(-0.2, 1.4, -0.2);
        cartGroup.add(viewfinder);

        return cartGroup;
    }

    function createMedicalStation() {
        const stationGroup = new THREE.Group();

        const legOffsets = [
            [-1.4, 1.25, -1.4], [-1.4, 1.25, 1.4],
            [1.4, 1.25, -1.4], [1.4, 1.25, 1.4]
        ];
        legOffsets.forEach(pos => {
            const leg = new THREE.Mesh(tentLegGeom, frameMat);
            leg.position.set(...pos);
            leg.castShadow = true;
            stationGroup.add(leg);
        });

        const roof = new THREE.Mesh(tentRoofGeom, tentMat);
        roof.position.y = 2.5;
        roof.rotation.x = 0.08; 
        roof.castShadow = true;
        stationGroup.add(roof);

        const cooler1 = new THREE.Mesh(coolerGeom, coolerMat);
        cooler1.position.set(-0.5, 0.3, 0);
        stationGroup.add(cooler1);

        const cooler2 = new THREE.Mesh(coolerGeom, coolerMat);
        cooler2.position.set(0.5, 0.3, 0.5);
        stationGroup.add(cooler2);

        return stationGroup;
    }

    /* ------------------------------------------------------------------ */
    /*  Instantiate and position props along both sidelines               */
    /* ------------------------------------------------------------------ */
    
    for (const zSign of [-1, 1]) {
        const bench = createBench();
        // Ставим на уровень поля (fieldY), а не на 0
        bench.position.set(0, fieldY, zSign * (halfWidth + 3));
        group.add(bench);
    }

    for (const zSign of [-1, 1]) {
        const cart = createCameraCart();
        cart.position.set(5 * zSign, fieldY, zSign * (halfWidth + 1.5));
        cart.rotation.y = zSign > 0 ? Math.PI : 0;
        group.add(cart);
    }

    for (const zSign of [-1, 1]) {
        const station = createMedicalStation();
        station.position.set(halfLength - 10, fieldY, zSign * (halfWidth + 2));
        group.add(station);
    }

    group.traverse((object) => {
        if (object.isMesh) ghost(object);
    });
    group.userData.dispose = () => {
        const geometries = new Set();
        const materials = new Set();
        group.traverse((object) => {
            if (object.geometry) geometries.add(object.geometry);
            if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
            else if (object.material) materials.add(object.material);
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
        });
    };
    return group;
}
