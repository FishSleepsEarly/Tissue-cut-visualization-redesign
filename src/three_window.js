import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Scene Setup
 */

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 5000);
const renderer = new THREE.WebGLRenderer();
const container = document.getElementById('three-container');
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

/**
 * Camera Movement Variables
 */
let isLeftMouseDown = false;
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

/**
 * Camera initialization and camera reset Function
 */
const initialCameraPosition = {x:0,y:0,z:10}
camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
const resetCamera = () => {
    camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    camera.rotation.set(0, 0, 0);
};

document.getElementById('reset-camera').addEventListener('click', resetCamera);

/**
 * Mouse Controls (Restrict to Three.js Window)
 */
container.addEventListener('mousedown', (event) => {
    if (event.button === 0) isLeftMouseDown = true;
    if (event.button === 2) isRightMouseDown = true;
});

container.addEventListener('mouseup', (event) => {
    if (event.button === 0) isLeftMouseDown = false;
    if (event.button === 2) isRightMouseDown = false;
});

container.addEventListener('mousemove', (event) => {
    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    if (isLeftMouseDown) {
        camera.rotation.y -= deltaX * 0.005;
        camera.rotation.x -= deltaY * 0.005;
    }
    if (isRightMouseDown) {
        camera.position.x -= deltaX * 0.01;
        camera.position.y += deltaY * 0.01;
    }
});

container.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * 0.01;
});

container.addEventListener('contextmenu', (event) => event.preventDefault());

/**
 * Background Image
 */
const textureLoader = new THREE.TextureLoader();
textureLoader.load('./src/image.png', function (texture) {
    const planeGeometry = new THREE.PlaneGeometry(4, 4);
    const planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.set(0, 0, 0);
    scene.add(plane);
});

/**
 * Honeycomb Grid Setup
 */
const discRadius = 0.5;
const discHeight = 0.1;
const numRows = 3;
const numCols = 10;
const xSpacing = discRadius * 2 * 0.95;
const ySpacing = discRadius * 1.65;
const xOffset = discRadius;
const discs = [];

/**
 * Function to Modify a Disc into a Pie Chart
 */
const togglePieDisc = (index, colors, portions) => {
    if (index < 0 || index >= discs.length) return;
    
    const oldDisc = discs[index];
    scene.remove(oldDisc);
    
    const group = new THREE.Group();
    let startAngle = 0;
    for (let i = 0; i < colors.length; i++) {
        const segmentAngle = Math.PI * 2 * portions[i];
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, discRadius, startAngle, startAngle + segmentAngle, false);
        shape.lineTo(0, 0);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide, transparent: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI;
        group.add(mesh);
        startAngle += segmentAngle;
    }
    
    group.position.copy(oldDisc.position);
    scene.add(group);
    discs[index] = group;
};

/**
 * Create Honeycomb Grid
 */
const discMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide, transparent: true });
const discGeometry = new THREE.CylinderGeometry(discRadius, discRadius, discHeight, 32);
for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
        const disc = new THREE.Mesh(discGeometry, discMaterial.clone());
        disc.rotation.x = Math.PI / 2;
        
        let x = col * xSpacing;
        let y = row * ySpacing;
        if (row % 2 === 1) {
            x += xOffset;
        }
        disc.position.set(x, y, 0);
        scene.add(disc);
        discs.push(disc);
    }
}

/**
 * Animation Loop
 */
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

/**
 * Opacity Control
 */
const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.addEventListener('input', (event) => {
    const opacity = parseFloat(event.target.value);
    discs.forEach(disc => {
        if (disc.material) {
            disc.material.opacity = opacity;
            disc.material.transparent = true;
        } else if (disc.children) {
            disc.children.forEach(child => {
                if (child.material) {
                    child.material.opacity = opacity;
                    child.material.transparent = true;
                }
            });
        }
    });
});

// Example: Convert disc at index 9 into a pie chart
togglePieDisc(9, [0xff0000, 0x00ff00, 0x0000ff], [0.2, 0.4, 0.4]);
