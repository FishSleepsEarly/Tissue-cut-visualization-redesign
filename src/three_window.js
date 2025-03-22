import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Functionalities to implement:
 * 
 * 1. Zoom in level adjustment -- Done, by default feature of three.js
 * 
 * 2. Opacity adjustment --  Done, check 'Opacity Control' functions.
 * 
 * 3. Locating cells and genes -- TODO
 *      - Put mouse on a cell, will show its corresponding coordinates and barcode -- Done, but quality might need improvement. Check 'Load cell info when mouse hover over each disc/cell.' part.
 *      - Select a point from bar graph, show corresponding cell set. -- TODO, example see slides P9
 * 
 * 4. Switch between gene sets, so when select a gene set, its corredponding cells will be colored -- TODO
 *      - Create function to color a gene set. -- Done (colorSpotsByExpression)
 *      - Coloring in different strength -- TODO, Optional
 * 
 * 5. 2D->3D -- Done, check createDiscsFromCSV
 * 
 * 6. Clipping -- Done
 * 
 * 7. Synchronously and colored gene viewing -- TODO
 *      - Function to color a gene set -- Done
 *      - Function to create multiple layers of cells so that we can show the same cell position in different colors. -- TODO
 */


/**
 * Variables
 */
let tissueImage = '../data/image.png'
let SpotPositionsPath = '../data/SpotPositions.csv'
let ClusterGeneExpressionPath = '../data/ClusterGeneExpression.csv'
let SpotClusterMembershipPath = '../data/SpotClusterMembership.csv'
const discs = [];
let geneExpressionData;
let geneList;
let cellTypeData;
let tissueImageMesh;
const raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 10 };
const mouse = new THREE.Vector2();

let featureMatrix;
let barcodeList;
/**
 ----------------------------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Scene Setup
 */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 50000);
const renderer = new THREE.WebGLRenderer();
const container = document.getElementById('three-container');
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);
const singleInfoBox = document.getElementById('single-cell-info-box');

// set up the gene seletc menu
const geneSearchInput = document.getElementById('gene-search');
const geneSelect = document.getElementById('gene-select');

//const geneList = ["1700047M11Rik", "Zzz3"];
function populateGeneDropdown(genes) {
    geneSelect.innerHTML = ''; // Clear previous options
    genes.forEach(gene => {
        const option = document.createElement('option');
        option.value = gene;
        option.textContent = gene;
        geneSelect.appendChild(option);
    });
}

/**
 ----------------------------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Mouse and Camera and Handlers
 */

//Camera Movement Variables
let isLeftMouseDown = false;
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

let rotateFactor = 0.005
let moveFactor = 1
let zoomFactor = 0.2

const minRotation = -Math.PI/4;
const maxRotation = Math.PI/4;
const minZoomZ = 10;
const maxZoomZ = 700;
const minPositionX = 100;
const maxPositionX = 1200;
const minPositionY = 0;
const maxPositionY = 1200;

//Camera initialization
//const initialCameraPosition = {x:9000,y:9000,z:10000}
const initialCameraPosition = {x:9000*0.07,y:9000*0.07,z:10000*0.07}
camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);

//Camera reset
const resetCamera = () => {
    camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    camera.rotation.set(0, 0, 0);
};
document.getElementById('reset-camera').addEventListener('click', resetCamera);

//Mouse Controls (Restrict to Three.js Window)
container.addEventListener('mousedown', (event) => {
    if (event.button === 0) isLeftMouseDown = true;
    if (event.button === 2) isRightMouseDown = true;
});

container.addEventListener('mouseup', (event) => {
    if (event.button === 0) isLeftMouseDown = false;
    if (event.button === 2) isRightMouseDown = false;
});

// Camera rotate and move
container.addEventListener('mousemove', (event) => {
    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    if (isLeftMouseDown) {
        camera.rotation.y -= deltaX * rotateFactor;
        camera.rotation.x -= deltaY * rotateFactor;

        camera.rotation.x = Math.max(minRotation, Math.min(maxRotation, camera.rotation.x));
        camera.rotation.y = Math.max(minRotation, Math.min(maxRotation, camera.rotation.y));
    }
    if (isRightMouseDown) {
        camera.position.x -= deltaX * moveFactor;
        camera.position.y += deltaY * moveFactor;

        camera.position.x = Math.max(minPositionX, Math.min(maxPositionX, camera.position.x));
        camera.position.y = Math.max(minPositionY, Math.min(maxPositionY, camera.position.y));
    }
});

// Camera zoom in
container.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * zoomFactor;
    camera.position.z = Math.max(minZoomZ, Math.min(maxZoomZ, camera.position.z));
});

container.addEventListener('contextmenu', (event) => event.preventDefault());

//Clipping
const leftClipSlider = document.getElementById('left-clip-slider');
const rightClipSlider = document.getElementById('right-clip-slider');

// Function to clip based on X position
function updateClipping() {
    const leftLimit = parseFloat(leftClipSlider.value);
    const rightLimit = parseFloat(rightClipSlider.value);

    discs.forEach(disc => {
        if (disc.position.x < leftLimit || disc.position.x > rightLimit) {
            disc.visible = false;
        } else {
            disc.visible = true;
        }
    });

    // Render the scene after updating
    renderer.render(scene, camera);
}
leftClipSlider.addEventListener('input', updateClipping);
rightClipSlider.addEventListener('input', updateClipping);

//Load cell info when mouse hover over each disc/cell.
container.addEventListener('mousemove', (event) => {
    raycaster.params.Mesh.threshold = 5; 
    //raycaster.far = 10000;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(discs, false);

    if (intersects.length > 0) {
        const disc = intersects[0].object;
        const { x, y, z } = disc.position;
        const barcode = disc.userData.id;

        singleInfoBox.innerHTML = `Barcode: ${barcode} <br> X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}`;
        singleInfoBox.style.left = `${event.clientX + 10}px`;
        singleInfoBox.style.top = `${event.clientY + 10}px`;
        singleInfoBox.style.display = 'block';
    } else {
        singleInfoBox.style.display = 'none';
    }
});

//Gene search box
geneSearchInput.addEventListener('input', () => {
    const query = geneSearchInput.value.toLowerCase();
    const filteredGenes = geneList.filter(gene => gene.toLowerCase().includes(query));
    populateGeneDropdown(filteredGenes);
});
//Gene select, will triger spots coloring
geneSelect.addEventListener('change', () => {
    const selectedGene = geneSelect.value;
    if (selectedGene) {
        let expressionPerSpot = computeSpotExpressionFromMatrix(featureMatrix, geneList, [selectedGene]);
        colorSpotsByExpression(expressionPerSpot, barcodeList, 0);
    }
});

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
 * -----------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * File Loading Functions.
 */
// Function to Load and Display an Image with Adjustable Position and Size
function loadImage(imagePath, width = 4, height = 4, position = { x: 0, y: 0, z: 0 }) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imagePath, function (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.y = -1; 

        const planeGeometry = new THREE.PlaneGeometry(width, height);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 1.0,
        }); 

        tissueImageMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        tissueImageMesh.position.set(position.x, position.y, position.z);
        scene.add(tissueImageMesh);
    });
}

async function loadGeneExpressionData(csvFilePath) {
    const response = await fetch(csvFilePath);
    const text = await response.text();
    const rows = text.split('\n').filter(row => row.trim() !== '');

    let headers = rows[0].split(',').map(h => h.trim().replace(/["']/g, ''));
    let geneList = headers.slice(1);

    //let geneExpressionData = {};

    for (let i = 1; i < rows.length; i++) {
        let values = rows[i].split(',').map(v => v.trim());
        let cellType = values[0].replace(/["']/g, '');

        let expression = {};
        for (let j = 1; j < headers.length; j++) {
            expression[headers[j]] = parseFloat(values[j]) || 0;
        }
        //geneExpressionData[cellType] = expression;
    }

    //return { geneExpressionData, geneList };
    return { geneList };
}

//Read FeatureMatrix.mtx.
async function loadFeatureMatrix(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('%'));

    const [numRows, numCols, numEntries] = lines[0].trim().split(/\s+/).map(Number);

    // Initialize empty matrix as array of rows
    const matrix = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    for (let i = 1; i < lines.length; i++) {
        const [row, col, value] = lines[i].trim().split(/\s+/);
        matrix[parseInt(row) - 1][parseInt(col) - 1] = parseFloat(value);
    }

    return matrix;
}

async function loadCellTypeMembership(csvFilePath) {
    const response = await fetch(csvFilePath);
    const text = await response.text();
    const rows = text.split('\n').filter(row => row.trim() !== '');

    let headers = rows[0].split(',').map(h => h.trim().replace(/["']/g, '')); // Clean headers
    //let cellTypeData = {};
    let barcodeList = [];

    for (let i = 1; i < rows.length; i++) {
        let values = rows[i].split(',').map(v => v.trim());
        if (values.length < 2) continue; // skip incomplete lines

        let barcode = values[0].replace(/["']/g, '');
        barcodeList.push(barcode);

        let membership = {};
        for (let j = 1; j < headers.length; j++) {
            membership[headers[j]] = parseFloat(values[j]) || 0;
        }
        //cellTypeData[barcode] = membership;
    }

    //return { cellTypeData, barcodeList };
    return { barcodeList };
}
/**
 * -----------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Discs/Spots Process
 */

//Create plots/discs by using the info read from the given csv file
async function createDiscsFromCSV(csvFilePath, numLines, scaleFactor = 0.07) {
    const response = await fetch(csvFilePath);
    const text = await response.text();
    const rows = text.split('\n').slice(1);

    const discMaterial = new THREE.MeshBasicMaterial({ color: 0x00008B, side: THREE.DoubleSide, transparent: true});

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

        const discGeometry = new THREE.CylinderGeometry(parseFloat(radius) * scaleFactor, parseFloat(radius) * scaleFactor, 0.1, 32);
        const disc = new THREE.Mesh(discGeometry, discMaterial.clone());

        disc.rotation.x = Math.PI / 2;
        disc.position.set(parseFloat(x) * scaleFactor, parseFloat(y) * scaleFactor, 0);

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





 //Function to Modify a Disc into a colored Pie.
const colorPieDisc = (index, colors, portions) => {
    if (index < 0 || index >= discs.length) {
        console.error(`colorPieDisc: Invalid index ${index}, discs length: ${discs.length}`);
        return;
    }

    const oldDisc = discs[index];

    if (!oldDisc) {
        console.error(`colorPieDisc: No disc found at index ${index}`);
        return;
    }

    // Ensure we extract radius from the correct disc type
    let oldRadius = 0.5;
    if (oldDisc.geometry?.parameters) {
        oldRadius = oldDisc.geometry.parameters.radiusTop || 0.5;
    }

    // Remove old disc from scene
    scene.remove(oldDisc);

    // Create new disc with updated color
    const newMaterial = new THREE.MeshBasicMaterial({ color: colors[0], side: THREE.DoubleSide });
    const newDisc = new THREE.Mesh(new THREE.CylinderGeometry(oldRadius, oldRadius, 0.1, 32), newMaterial);

    newDisc.rotation.x = Math.PI / 2;
    newDisc.position.copy(oldDisc.position);
    newDisc.userData.id = oldDisc.userData.id;

    // Replace in scene and array
    scene.add(newDisc);
    discs[index] = newDisc;
};


//Function to find a specific cell disc by id (the barcode of genes).
const findDiscById = (barcode) => {
    return scene.children.find(disc => disc.userData.id === barcode);
};

//Function to sort an array from 0 to 9, then a to z.
function sortInPlace(array) {
    array.sort((a, b) => {
        const isDigit = str => /^\d/.test(str);
        const aStartsWithDigit = isDigit(a);
        const bStartsWithDigit = isDigit(b);

        if (aStartsWithDigit && !bStartsWithDigit) return -1;
        if (!aStartsWithDigit && bStartsWithDigit) return 1;

        return a.localeCompare(b);
    });
}


//Compute the given gene's(selectedGenes) expression strength.
function computeSpotExpressionFromMatrix(featureMatrix, geneList, selectedGenes) {
    const indices = selectedGenes.map(g => geneList.indexOf(g)).filter(i => i !== -1);
    let expressionPerSpot = Array(featureMatrix[0].length).fill(0);

    indices.forEach(index => {
        const geneRow = featureMatrix[index];
        for (let i = 0; i < geneRow.length; i++) {
            expressionPerSpot[i] += geneRow[i];
        }
    });

    return expressionPerSpot;
}
//Color discs/spots based on the expression strength calculated.
function colorSpotsByExpression(expressionPerSpot, barcodeList, threshold = 0.01) {
    for (let i = 0; i < expressionPerSpot.length; i++) {
        const expressionValue = expressionPerSpot[i];
        const barcode = barcodeList[i];

        const discIndex = discs.findIndex(d => d.userData.id === barcode);

        if (discIndex !== -1) {
            if (expressionValue > threshold) {
                // High expression → Red
                colorPieDisc(discIndex, [0xff0000], [1.0]);
            } else {
                // Low expression → Dark Blue
                colorPieDisc(discIndex, [0x00008B], [1.0]);
            }
        }
    }
}
/**
 * ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Initialization function.
 */
async function init() {
    console.log("Waiting for initialization..");

    console.log("Creating cell plots..");
    await createDiscsFromCSV(SpotPositionsPath, 3500);
    console.log("Cell plots created.");

    console.log("Loading tissue cut image..");
    // loadImage(tissueImage, 17039.5, 17500, { x: 8495.5, y: 8601.5, z: -1 });
    loadImage(tissueImage, 17039.5*0.07, 17500*0.07, { x: 8495.5*0.07, y: 8601.5*0.07, z: -10 });
    //loadImageWithAlignment(tissueImage, SpotPositionsPath);
    console.log("Tissue cut image loaded."); 

    console.log("Loading files..");
    ({ geneList } = await loadGeneExpressionData('../data/ClusterGeneExpression.csv'));
    ({ barcodeList } = await loadCellTypeMembership('../data/SpotClusterMembership.csv'));
    featureMatrix = await loadFeatureMatrix('../data/FeatureMatrix.mtx');
    //sortInPlace(geneList);
    //console.log(barcodeList);
    console.log("Files loaded.");

    console.log("Loading UI..");
    updateClipping();
    populateGeneDropdown(geneList);
    console.log("UI Loaded.");

    console.log("Initialization done.");
    alert("Initialization done.");
}
/**
 * ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 */

await init();
