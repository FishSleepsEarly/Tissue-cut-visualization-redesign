import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Functionalities to implement:
 * 
 * 1. Zoom in level adjustment -- Done, by default feature of three.js
 * 
 * 2. Opacity adjustment --  Done, check 'Opacity Control' functions.
 * 
 * 3. Locating cells and genes -- Done
 *      - Put mouse on a cell, will show its corresponding coordinates and barcode -- Done, but quality might need improvement. Check 'Load cell info when mouse hover over each disc/cell.' part.
 *      - Select a point from bar graph, locate the corresponding cell's position using 2 cross lines. -- Done, example see slides P9
 * 
 * 4. Switch between gene sets, so when select a gene set, its corredponding cells will be colored -- Done
 *      - Create function to color a gene set. -- Done (colorSpotsByExpression)
 *      - Coloring in different strength -- Done
 * 
 * 5. 2D->3D -- Done, check createDiscsFromCSV
 * 
 * 6. Clipping -- Done
 * 
 * 7. Synchronously and colored gene viewing -- TODO
 *      - Function to color a gene set -- Done
 *      - Function to create multiple layers of cells so that we can show the same cell position in different colors. -- TODO
 * 
 * 8. Improve the project UI and outlook -- TODO
 *      - A scale bar indicate the viewing scale (2mm, 1mm ...) --TODO
 *      - General better look -- TODO
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
//for Spot Index Map and showing cross lines
const crosshairMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
let crosshairX = new THREE.Line(new THREE.BufferGeometry(), crosshairMaterial);
let crosshairY = new THREE.Line(new THREE.BufferGeometry(), crosshairMaterial);
scene.add(crosshairX);
scene.add(crosshairY);
let crosshairLocked = false;
// set up the gene seletc menu
const geneSearchInput = document.getElementById('gene-search');
const geneSelect = document.getElementById('gene-select');

//Set up the gene selection menu
function populateGeneDropdown(genes) {
    geneSelect.innerHTML = '';
    genes.forEach(gene => {
        const option = document.createElement('option');
        option.value = gene;
        option.textContent = gene;
        geneSelect.appendChild(option);
    });
}

//Set up the cross lines.
function createCrosshairs() {
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    //Horizontal line
    const geometryX = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, 5)
    ]);
    crosshairX = new THREE.Line(geometryX, material);
    crosshairX.visible = false;
    scene.add(crosshairX);

    //Vertical line
    const geometryY = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, 5)
    ]);
    crosshairY = new THREE.Line(geometryY, material);
    crosshairY.visible = false;
    scene.add(crosshairY);
}

// Set up the Spot Index Map
function createSpotIndexPlot(discs) {
    const infoBox = document.getElementById('locked-spot-info');
    const spotIndices = [];
    const barcodes = [];
    const visibleDiscs = discs.filter(d => d.visible);

    visibleDiscs.forEach((disc, idx) => {
        spotIndices.push(idx);
        barcodes.push(disc.userData.id);
    });

    const trace = {
        x: spotIndices,
        y: new Array(spotIndices.length).fill(1),
        mode: 'markers',
        type: 'scatter',
        text: barcodes.map((b, i) => `Spot ID: ${b}<br>Index: ${spotIndices[i]}`),
        hoverinfo: 'text',
        marker: { size: 6, color: 'blue' }
    };

    const layout = {
        title: 'Spot Index Map',
        xaxis: { title: 'Spot Index' },
        yaxis: { visible: false }
    };

    Plotly.newPlot('spot-plot', [trace], layout);

    const plotDiv = document.getElementById('spot-plot');

    //Hover only update if NOT locked
    plotDiv.on('plotly_hover', function (data) {
        if (!crosshairLocked) {
            const index = data.points[0].pointIndex;
            const disc = visibleDiscs[index];
            if (disc) {
                updateCrosshair(disc.position.x, disc.position.y);
            }
        }
    });

    //Unhover only hide if NOT locked
    plotDiv.on('plotly_unhover', function () {
        if (!crosshairLocked) {
            hideCrosshair();
        }
    });

    // Left click: lock cross line and info box on screen
    plotDiv.on('plotly_click', function (data) {
        const index = data.points[0].pointIndex;
        const disc = visibleDiscs[index];
        if (disc) {
            crosshairLocked = true;
            updateCrosshair(disc.position.x, disc.position.y);

            //Lock info box
            const infoBox = document.getElementById('locked-spot-info');
            infoBox.innerHTML = `<strong>Spot ID:</strong> ${disc.userData.id}<br><strong>Index:</strong> ${index}`;
            infoBox.style.display = 'block';
        }
    });

    //Right click: unlock crosshair and hide info box
    plotDiv.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        crosshairLocked = false;
        hideCrosshair();

        const infoBox = document.getElementById('locked-spot-info');
        infoBox.style.display = 'none';
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

let rotateFactor = 0.01
let moveFactor = 1
let zoomFactor = 0.2

const minRotation = -Math.PI / 4;
const maxRotation = Math.PI / 4;
const minZoomZ = 10;
const maxZoomZ = 700;
const minPositionX = 100;
const maxPositionX = 1200;
const minPositionY = 0;
const maxPositionY = 1200;
const centerX = (minPositionX + maxPositionX) / 2;
const centerY = (minPositionY + maxPositionY) / 2;
const rotationCenter = new THREE.Vector3(centerX, centerY, 0);

let verticalAngle = 0;
const maxVerticalAngle = Math.PI / 2; // 90 degrees


//Camera initialization
//const initialCameraPosition = {x:9000,y:9000,z:10000}
const initialCameraPosition = { x: 9000 * 0.07, y: 9000 * 0.07, z: 10000 * 0.07 }
camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);

// Prevent page scrolling on wheel when hovering over Three.js window
container.addEventListener('wheel', (event) => {
    event.preventDefault();
}, { passive: false });

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
        /*
        camera.rotation.y -= deltaX * rotateFactor;
        camera.rotation.x -= deltaY * rotateFactor;

        camera.rotation.x = Math.max(minRotation, Math.min(maxRotation, camera.rotation.x));
        camera.rotation.y = Math.max(minRotation, Math.min(maxRotation, camera.rotation.y));
        */
        const angleY = -(deltaX * rotateFactor); // horizontal rotation
        const angleX = -(deltaY * rotateFactor); // vertical rotation

        // Get direction vector from center to camera
        const offset = new THREE.Vector3().copy(camera.position).sub(rotationCenter);

        // === Horizontal rotation (around Z in your 2D layout)
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
        offset.applyQuaternion(qY);

        // === Vertical rotation (around camera's current right vector)
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();

        const qX = new THREE.Quaternion().setFromAxisAngle(right, angleX);
        offset.applyQuaternion(qX);

        // Set new camera position and orientation
        camera.position.copy(rotationCenter).add(offset);

        // Update "up" vector manually so camera doesn't auto-flip
        camera.up.applyQuaternion(qX).normalize();
        camera.up.applyQuaternion(qY).normalize();

        // Now manually face the center
        camera.lookAt(rotationCenter);
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
const topClipSlider = document.getElementById('top-clip-slider');
const bottomClipSlider = document.getElementById('bottom-clip-slider');


// Function to clip the scene
function updateClipping() {
    const leftLimit = parseFloat(leftClipSlider.value);
    const rightLimit = parseFloat(rightClipSlider.value);
    const topLimit = parseFloat(topClipSlider.value);
    const bottomLimit = parseFloat(bottomClipSlider.value);

    discs.forEach(disc => {
        const x = disc.position.x;
        const y = disc.position.y;

        const withinX = x >= leftLimit && x <= rightLimit;
        const withinY = y >= bottomLimit && y <= topLimit;

        disc.visible = withinX && withinY;
    });

    renderer.render(scene, camera);
}

leftClipSlider.addEventListener('input', updateClipping);
rightClipSlider.addEventListener('input', updateClipping);
topClipSlider.addEventListener('input', updateClipping);
bottomClipSlider.addEventListener('input', updateClipping);

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
        const expressionPerSpot = computeSpotExpressionFromMatrix(featureMatrix, geneList, [selectedGene]);

        const min = Math.min(...expressionPerSpot).toFixed(1);
        const max = Math.max(...expressionPerSpot).toFixed(1);

        //Update Color Scale
        document.getElementById('scale-min').innerText = min;
        document.getElementById('scale-max').innerText = max;
        document.getElementById('scale-gene-name').innerText = selectedGene;

        if (multiGeneCheckbox.checked) return;
        colorSpotsByExpression(expressionPerSpot, barcodeList);
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
            side: THREE.DoubleSide,
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

    const discMaterial = new THREE.MeshBasicMaterial({ color: 0x4B0082, side: THREE.DoubleSide, transparent: true });

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
        disc.userData.radius = parseFloat(radius) * scaleFactor;

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
    // Make sure crosshairs are rendered
    crosshairX.visible = crosshairX.visible ?? false;
    crosshairY.visible = crosshairY.visible ?? false;
    renderer.render(scene, camera);
}
animate();



// Enhanced colorPieDisc: supports both solid color and multi-color pie slices
/*
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

    // Remove old disc from scene
    scene.remove(oldDisc);

    // Dispose geometry and material
    if (oldDisc instanceof THREE.Group) {
        oldDisc.children.forEach(child => {
            child.geometry?.dispose();
            child.material?.dispose();
        });
    } else {
        oldDisc.geometry?.dispose();
        oldDisc.material?.dispose();
    }

    // Default radius fallback
    //let oldRadius = 0.5;
    let oldRadius = oldDisc.userData?.radius || 0.5;
    if (oldDisc.geometry?.parameters?.radiusTop) {
        oldRadius = oldDisc.geometry.parameters.radiusTop;
    }

    // === Single Color Disc ===
    if (colors.length === 1) {
        const material = new THREE.MeshBasicMaterial({ color: colors[0], side: THREE.DoubleSide });
        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(oldRadius, oldRadius, 0.1, 32),
            material
        );
        disc.rotation.x = Math.PI / 2;
        disc.position.copy(oldDisc.position);
        disc.userData.id = oldDisc.userData.id;

        scene.add(disc);
        discs[index] = disc;
        return;
    }

    // === Multi-color Pie Chart ===
    const group = new THREE.Group();
    const totalSegments = 64;
    let startAngle = 0;

    for (let i = 0; i < colors.length; i++) {
        const angle = portions[i] * Math.PI * 2;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        const arcSegments = Math.max(3, Math.floor(portions[i] * totalSegments));
        for (let j = 0; j <= arcSegments; j++) {
            const theta = startAngle + (j / arcSegments) * angle;
            shape.lineTo(
                oldRadius * Math.cos(theta),
                oldRadius * Math.sin(theta)
            );
        }
        shape.lineTo(0, 0);

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI;
        group.add(mesh);

        startAngle += angle;
    }

    group.position.copy(oldDisc.position);
    group.rotation.x = 0;
    group.userData.id = oldDisc.userData.id;

    scene.add(group);
    discs[index] = group;
};
*/
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

    scene.remove(oldDisc);

    // Dispose old geometry and materials
    if (oldDisc instanceof THREE.Group) {
        oldDisc.children.forEach(child => {
            child.geometry?.dispose();
            child.material?.dispose();
        });
    } else {
        oldDisc.geometry?.dispose();
        oldDisc.material?.dispose();
    }

    // ✅ Correct and safe radius fallback
    let oldRadius = oldDisc.userData?.radius;
    if (typeof oldRadius !== 'number' || isNaN(oldRadius)) {
        oldRadius = 0.5;
    }

    // === Single-color disc ===
    if (colors.length === 1) {
        const material = new THREE.MeshBasicMaterial({ color: colors[0], side: THREE.DoubleSide });
        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(oldRadius, oldRadius, 0.1, 32),
            material
        );
        disc.rotation.x = Math.PI / 2;
        disc.position.copy(oldDisc.position);
        disc.userData = {
            id: oldDisc.userData.id,
            radius: oldRadius
        };

        scene.add(disc);
        discs[index] = disc;
        return;
    }

    // === Multi-color pie chart ===
    const group = new THREE.Group();
    const totalSegments = 64;
    let startAngle = 0;

    for (let i = 0; i < colors.length; i++) {
        const angle = portions[i] * Math.PI * 2;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        const arcSegments = Math.max(6, Math.floor(portions[i] * totalSegments));
        for (let j = 0; j <= arcSegments; j++) {
            const theta = startAngle + (j / arcSegments) * angle;
            shape.lineTo(
                oldRadius * Math.cos(theta),
                oldRadius * Math.sin(theta)
            );
        }
        shape.lineTo(0, 0);

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI;
        group.add(mesh);

        startAngle += angle;
    }

    group.position.copy(oldDisc.position);
    group.rotation.x = 0;
    group.userData = {
        id: oldDisc.userData.id,
        radius: oldRadius
    };

    scene.add(group);
    discs[index] = group;
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

//Decide what color should be applied to a cell
function getColorFromExpression(value, min, max) {
    const ratio = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, ratio));

    // Define gradient stops
    const colorStops = [
        { pos: 0.0, color: [75, 0, 130] },     // Purple
        { pos: 0.3, color: [204, 102, 255] },  // Pinkish
        { pos: 0.5, color: [255, 102, 102] },  // Light Red
        { pos: 0.7, color: [255, 165, 0] },    // Orange
        { pos: 1.0, color: [255, 255, 0] },    // Yellow
    ];

    // Find which two stops the ratio falls between
    for (let i = 0; i < colorStops.length - 1; i++) {
        const left = colorStops[i];
        const right = colorStops[i + 1];

        if (clamped >= left.pos && clamped <= right.pos) {
            const localRatio = (clamped - left.pos) / (right.pos - left.pos);

            const r = Math.round(left.color[0] + localRatio * (right.color[0] - left.color[0]));
            const g = Math.round(left.color[1] + localRatio * (right.color[1] - left.color[1]));
            const b = Math.round(left.color[2] + localRatio * (right.color[2] - left.color[2]));

            return (r << 16) | (g << 8) | b;
        }
    }

    return 0x4B0082;
}




//Color discs/spots based on the expression strength calculated.
function colorSpotsByExpression(expressionPerSpot, barcodeList) {
    const min = Math.min(...expressionPerSpot);
    const max = Math.max(...expressionPerSpot);

    for (let i = 0; i < expressionPerSpot.length; i++) {
        const value = expressionPerSpot[i];
        const barcode = barcodeList[i];

        const discIndex = discs.findIndex(d => d.userData.id === barcode);
        if (discIndex !== -1) {
            const color = getColorFromExpression(value, min, max);
            colorPieDisc(discIndex, [color], [1.0]);
        }
    }
}
/**
 * ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Helper and other functions
 */
// Update the corss lines on the three window
function updateCrosshair(x, y) {
    const lineZ = 5;
    crosshairX.geometry.setFromPoints([
        new THREE.Vector3(minPositionX, y, lineZ),
        new THREE.Vector3(maxPositionX, y, lineZ)
    ]);
    crosshairY.geometry.setFromPoints([
        new THREE.Vector3(x, minPositionY, lineZ),
        new THREE.Vector3(x, maxPositionY, lineZ)
    ]);
    crosshairX.visible = true;
    crosshairY.visible = true;
}
// Hide the corss lines on the three window
function hideCrosshair() {
    crosshairX.visible = false;
    crosshairY.visible = false;
}

function rotateAroundPoint(object, point, axis, theta) {
    object.position.sub(point); // translate to origin
    object.position.applyAxisAngle(axis, theta); // rotate
    object.position.add(point); // translate back
    object.lookAt(point); // make camera face the center
}
/**
 * ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * -----------------------------------------------------------------TEST ROOF-------------------------------------------------------------------------------------------------------
 */

const MAX_MULTI_GENES = 5;
const MULTI_GENE_COLORS = [0xff0000, 0x40E0D0, 0x006400, 0xffff00, 0xffffff];
const MULTI_GENE_COLOR_NAMES = ['Red', 'Turquoise', 'Green', 'Yellow', 'White'];

let multiGeneSelections = [];

const multiGeneCheckbox = document.getElementById('multi-gene-checkbox');
const addGeneToSceneButton = document.getElementById('add-gene-button');
const multiGeneSelectedList = document.getElementById('selected-genes-list');
//const geneDropdown = document.getElementById('gene-select');

multiGeneCheckbox.addEventListener('change', () => {
    if (multiGeneCheckbox.checked) {
        addGeneToSceneButton.style.display = 'inline-block';
    } else {
        addGeneToSceneButton.style.display = 'none';
        multiGeneSelections = [];
        multiGeneSelectedList.innerHTML = '';
        //geneSelect.disabled = false;
        geneSelect.dispatchEvent(new Event('change'));

    }
});

addGeneToSceneButton.addEventListener('click', () => {
    const selectedGeneName = geneSelect.value;
    if (!selectedGeneName || multiGeneSelections.find(g => g.name === selectedGeneName)) return;
    if (multiGeneSelections.length >= MAX_MULTI_GENES) {
        alert('Maximum of 5 genes allowed.');
        return;
    }

    const usedColors = multiGeneSelections.map(g => g.color);
    const color = MULTI_GENE_COLORS.find(c => !usedColors.includes(c));

    if (!color) {
        alert('Max 5 gene sets can be selected!');
        return;
    }
    multiGeneSelections.push({ name: selectedGeneName, color });

    // === Create new list item UI ===
    const listItem = document.createElement('li');
    listItem.style.display = 'flex';
    listItem.style.alignItems = 'center';
    listItem.style.marginTop = '6px';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.style.marginRight = '8px';

    const label = document.createElement('span');
    label.textContent = selectedGeneName;
    label.style.fontWeight = 'bold';
    label.style.marginRight = '8px';

    const colorBox = document.createElement('span');
    colorBox.style.display = 'inline-block';
    colorBox.style.width = '12px';
    colorBox.style.height = '12px';
    colorBox.style.backgroundColor = '#' + color.toString(16).padStart(6, '0');
    colorBox.style.border = '1px solid #555';

    listItem.appendChild(removeBtn);
    listItem.appendChild(label);
    listItem.appendChild(colorBox);
    multiGeneSelectedList.appendChild(listItem);

    removeBtn.addEventListener('click', () => {
        multiGeneSelections = multiGeneSelections.filter(g => g.name !== selectedGeneName);
        multiGeneSelectedList.removeChild(listItem);

        if (multiGeneSelections.length === 0) {
            geneSelect.disabled = false;

            for (let i = 0; i < barcodeList.length; i++) {
                const discIndex = discs.findIndex(d => d.userData.id === barcodeList[i]);
                if (discIndex !== -1) {
                    colorPieDisc(discIndex, [0x4B0082], [1.0]);
                }
            }
        } else {
            updateSceneWithMultiGeneColors();
        }
    });

    updateSceneWithMultiGeneColors();
});

function updateSceneWithMultiGeneColors() {
    const minMaxPerGene = multiGeneSelections.map(selection => {
        const expr = computeSpotExpressionFromMatrix(featureMatrix, geneList, [selection.name]);
        const min = Math.min(...expr);
        const max = Math.max(...expr);
        return { expr, min, max };
    });

    for (let i = 0; i < barcodeList.length; i++) {
        const barcode = barcodeList[i];
        const discIndex = discs.findIndex(d => d.userData.id === barcode);
        if (discIndex === -1) continue;

        const activeColors = [];
        const portions = [];

        for (let g = 0; g < multiGeneSelections.length; g++) {
            const { expr, min, max } = minMaxPerGene[g];
            const value = expr[i];
            const ratio = (value - min) / (max - min);
            const clamped = Math.max(0, Math.min(1, ratio));

            if (clamped > 0.3) {
                const color = multiGeneSelections[g].color;
                activeColors.push(color);
                portions.push(1);
            }
        }

        if (activeColors.length > 0) {
            const total = portions.reduce((a, b) => a + b, 0);

            const normalized = portions.map(p => p / total);
            colorPieDisc(discIndex, activeColors, normalized);
        } else {
            colorPieDisc(discIndex, [0x4B0082], [1.0]);
        }
    }

}





/**
 * -----------------------------------------------------------------TEST FLOOR-------------------------------------------------------------------------------------------------------
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
    loadImage(tissueImage, 17039.5 * 0.07, 17500 * 0.07, { x: 8495.5 * 0.07, y: 8601.5 * 0.07, z: -10 });
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
    createSpotIndexPlot(discs);
    createCrosshairs();
    hideCrosshair();
    console.log("UI Loaded.");

    console.log("Initialization done.");
    document.getElementById('loading-overlay').style.display = 'none';
    //alert("Initialization done.");
}
/**
 * ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 */

await init();
//colorPieDisc(0, [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xffffff], [0.2, 0.2, 0.2, 0.2, 0.2])