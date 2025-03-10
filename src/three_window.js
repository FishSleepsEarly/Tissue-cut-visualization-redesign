import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * General Variables
 */
let tissueImage = '../data/image.png'
let SpotPositionsPath = '../data/SpotPositions.csv'
const discs = [];
let tissueImageMesh;

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
 * Function to Load and Display an Image with Adjustable Position and Size
 */
function loadImage(imagePath, width = 4, height = 4, position = { x: 0, y: 0, z: 0 }) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imagePath, function (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.y = -1; 

        const planeGeometry = new THREE.PlaneGeometry(width, height);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,  // Ensures material supports transparency
            opacity: 1.0,       // Start at full opacity
        }); 

        tissueImageMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        tissueImageMesh.position.set(position.x, position.y, position.z);
        scene.add(tissueImageMesh);
    });
}




/**
 * Create Honeycomb Grid by using the info read from the given csv file
 */
async function createDiscsFromCSV(csvFilePath, numLines) {
    const response = await fetch(csvFilePath);
    const text = await response.text();
    const rows = text.split('\n').slice(1); // Skip the header

    const discMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide, transparent: true });

    let validRows = rows.filter(row => {
        const values = row.split(',').map(value => value.trim());
        return values.length >= 4 && !isNaN(parseFloat(values[1])) && !isNaN(parseFloat(values[2])) && !isNaN(parseFloat(values[3]));
    });

    if (numLines > validRows.length) {
        console.warn(`Requested ${numLines} lines, but only ${validRows.length} contain valid data. Using ${validRows.length} lines.`);
        numLines = validRows.length;
    }

    validRows.slice(0, numLines).forEach(row => {
        const [barcode, x, y, radius] = row.split(',').map(value => value.trim());

        const discGeometry = new THREE.CylinderGeometry(parseFloat(radius), parseFloat(radius), 0.1, 32);
        const disc = new THREE.Mesh(discGeometry, discMaterial.clone());

        disc.rotation.x = Math.PI / 2;
        disc.position.set(parseFloat(x), parseFloat(y), 0);

        disc.userData.id = barcode;

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
// Cells Opacity Control
const cellsOpacitySlider = document.getElementById('cells-opacity-slider');
cellsOpacitySlider.addEventListener('input', (event) => {
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

// Image Opacity Control
const imageOpacitySlider = document.getElementById('image-opacity-slider');
imageOpacitySlider.addEventListener('input', (event) => {
    const opacity = parseFloat(event.target.value);
    if (tissueImageMesh && tissueImageMesh.material) {
        tissueImageMesh.material.opacity = opacity;
        tissueImageMesh.material.transparent = true;
    }
});


/**
 * Function to Modify a Disc into a colored Pie.
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
 * Function to align the image and cells.
 */
async function loadImageWithAlignment(imagePath, spotCSVPath) {
    // Load spot positions
    const response = await fetch(spotCSVPath);
    const text = await response.text();
    const rows = text.split('\n').slice(1); // Skip header

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    rows.forEach(row => {
        const values = row.split(',').map(value => value.trim());
        if (values.length >= 4) {
            let x = parseFloat(values[1]);
            let y = parseFloat(values[2]);
            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    });

    const width = maxX - minX;  // Image width should match spot distribution width
    const height = maxY - minY; // Image height should match spot distribution height
    const position = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: -1 }; // Center it below plots
    console.log("Loading image with:");
    console.log("Width:", width);
    console.log("Height:", height);
    console.log("Position:", position);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imagePath, function (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.y = -1; // Flip the image vertically

        const planeGeometry = new THREE.PlaneGeometry(width, height);
        const planeMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.8 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.set(position.x, position.y, position.z);
        scene.add(plane);
    });
}


/**
 * Initialization function.
 */
async function init() {
    console.log("Waiting for initialization..");

    console.log("Creating cell plots..");
    await createDiscsFromCSV(SpotPositionsPath, 3500);
    console.log("Cell plots created.");

    console.log("Loading tissue cut image..");
    // w=13913, h=14289, { x: 8495.5, y: 8801.5, z: -1 }
    loadImage(tissueImage, 13913, 14289, { x: 8495.5, y: 8801.5, z: -1 });
    //loadImageWithAlignment(tissueImage, SpotPositionsPath);
    console.log("Tissue cut image loaded."); 

    console.log("Initialization done.");

}

// Call the async function
await init();

// Example: Convert disc at index into a colored pie chart
colorPieDisc(5, [0xff0000, 0x00ff00, 0x0000ff], [0.2, 0.4, 0.4]);

