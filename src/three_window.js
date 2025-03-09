import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * General Variables
 */
let tissueImage = '../data/image.png'
let SpotPositionsPath = '../data/SpotPositions.csv'

/**
 * Scene Setup
 */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 50000);
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

let rotateFactor = 0.005
let moveFactor = 5
let zoomFactor = 1.5
/**
 * Camera initialization and camera reset Function
 */
const initialCameraPosition = {x:9000,y:9000,z:10000}

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
        camera.rotation.y -= deltaX * rotateFactor;
        camera.rotation.x -= deltaY * rotateFactor;
    }
    if (isRightMouseDown) {
        camera.position.x -= deltaX * moveFactor;
        camera.position.y += deltaY * moveFactor;
    }
});

container.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * zoomFactor;
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
const discs = [];
/**
 * Create Honeycomb Grid by using the info read from the given csv file
 */
async function createDiscsFromCSV(csvFilePath, numLines) {
    const response = await fetch(csvFilePath);
    const text = await response.text();
    const rows = text.split('\n').slice(1, numLines + 1); // Skip header and take numLines

    const discMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide, transparent: true });

    //const discs = [];
    
    rows.forEach(row => {
        const [barcode, x, y, radius] = row.split(',').map(value => value.trim());

        // Create disc geometry and material
        const discGeometry = new THREE.CylinderGeometry(parseFloat(radius), parseFloat(radius), 0.1, 32);
        const disc = new THREE.Mesh(discGeometry, discMaterial.clone());

        // Rotate and position the disc
        disc.rotation.x = Math.PI / 2;
        disc.position.set(parseFloat(x), parseFloat(y), 0);

        // Assign the barcode as an ID to the disc
        disc.userData.id = barcode; 

        // Add the disc to the scene and array
        scene.add(disc);
        discs.push(disc);
    });

    return discs;
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

/**
 * Function to Modify a Disc into a Pie Chart
 */
const colorPieDisc = (index, colors, portions) => {
    if (index < 0 || index >= discs.length) {
        console.error(`colorPieDisc: Invalid index ${index}, discs length: ${discs.length}`);
        return;
    }

    const oldDisc = discs[index];

    // Extract radius from old disc geometry
    let oldRadius = 0.5; // Default value in case of error
    if (oldDisc.geometry && oldDisc.geometry.parameters) {
        oldRadius = oldDisc.geometry.parameters.radiusTop || 0.5;
    }

    // Remove old disc
    scene.remove(oldDisc);
    
    // Create new pie chart using old disc size
    const group = new THREE.Group();
    let startAngle = 0;
    for (let i = 0; i < colors.length; i++) {
        const segmentAngle = Math.PI * 2 * portions[i];
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, oldRadius, startAngle, startAngle + segmentAngle, false);
        shape.lineTo(0, 0);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide, transparent: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI;
        group.add(mesh);
        startAngle += segmentAngle;
    }

    // Preserve position of the old disc
    group.position.copy(oldDisc.position);

    // Add to scene
    scene.add(group);
    discs[index] = group;
};

/**
 * Function to find a specific cell disc by id (the barcode of genes).
 */
const findDiscById = (barcode) => {
    return scene.children.find(disc => disc.userData.id === barcode);
};

/**
 * Initialization function.
 */
async function init() {
    console.log("Waiting for initialization..");
    await createDiscsFromCSV(SpotPositionsPath, 3499);
    console.log("Initialization done.");
}

// Call the async function
await init();

// Example: Convert disc at index into a colored pie chart
colorPieDisc(5, [0xff0000, 0x00ff00, 0x0000ff], [0.2, 0.4, 0.4]);
