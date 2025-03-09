import '@kitware/vtk.js';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkCylinderSource from '@kitware/vtk.js/Filters/Sources/CylinderSource';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkPlaneSource from '@kitware/vtk.js/Filters/Sources/PlaneSource';
import vtkTexture from '@kitware/vtk.js/Rendering/Core/Texture';
import myImage from './image.png';

const renderWindow = vtkFullScreenRenderWindow.newInstance({
  rootContainer: document.getElementById('vtk-container'),
  background: [0.1, 0.2, 0.3],
  containerStyle: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  listenWindowResize: false,
});
const renderer = renderWindow.getRenderer();
const renderWindowInstance = renderWindow.getRenderWindow();

// -----------------------------
// Create discs in a honeycomb pattern
// -----------------------------
const discRadius = 0.5;    // Radius of each disc
const discHeight = 0.1;    // Very thin so it looks like a disc
const numRows = 3;         // Number of rows
const numCols = 10;        // Number of columns
const xSpacing = discRadius * 2 * 0.95;  // Horizontal spacing
const ySpacing = discRadius * 1.65;      // Vertical spacing
const xOffset = discRadius;              // Offset for alternate rows

// Array to store all disc actors for later reference
const discActors = [];

for (let row = 0; row < numRows; row++) {
  for (let col = 0; col < numCols; col++) {
    // Create a thin cylinder to simulate a disc
    const discSource = vtkCylinderSource.newInstance({
      height: discHeight,
      radius: discRadius,
      resolution: 32,
    });
    const discMapper = vtkMapper.newInstance();
    discMapper.setInputConnection(discSource.getOutputPort());

    const discActor = vtkActor.newInstance();
    discActor.setMapper(discMapper);

    // Rotate so the cylinder lies flat in the XY plane
    discActor.rotateX(90);

    // Compute positions to form a honeycomb
    let x = col * xSpacing;
    let y = row * ySpacing;
    if (row % 2 === 1) {
      x += xOffset;
    }
    discActor.setPosition(x, y, 0);

    // Set disc surface color (light gray)
    discActor.getProperty().setColor(0.8, 0.8, 0.8);
    // Make the edges stand out
    discActor.getProperty().setEdgeVisibility(true);
    discActor.getProperty().setEdgeColor(0, 0, 0);
    discActor.getProperty().setLineWidth(2);

    // Add the disc actor to the renderer and store it
    renderer.addActor(discActor);
    discActors.push(discActor);
  }
}

// -----------------------------
// Create a plane to display the image
// -----------------------------
const planeSource = vtkPlaneSource.newInstance({
  generateTextureCoordinates: true,
  xResolution: 1,
  yResolution: 1,
});
const planeMapper = vtkMapper.newInstance();
planeMapper.setInputConnection(planeSource.getOutputPort());

const planeActor = vtkActor.newInstance();
planeActor.setMapper(planeMapper);

// Position the plane; adjust the position as needed
planeActor.setPosition(0, -2, 0);

// Create a texture and load the image using an HTML Image element
const texture = vtkTexture.newInstance();
const image = new Image();
// Since the image is in the same directory, set the path accordingly
image.src = myImage;
//image.crossOrigin = 'Anonymous'; // Use if necessary (e.g., for CORS)
image.onload = () => {
  texture.setImage(image);
  planeActor.addTexture(texture);
  renderWindowInstance.render();
};


// Add the plane actor to the renderer
renderer.addActor(planeActor);

// -----------------------------
// Adjust the camera and render the scene
// -----------------------------
renderer.resetCamera();
renderWindowInstance.render();

// -----------------------------
// Add event listener to slider to control opacity of all discs
// -----------------------------
const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.addEventListener('input', (event) => {
  const opacity = parseFloat(event.target.value);
  discActors.forEach(actor => {
    actor.getProperty().setOpacity(opacity);
  });
  renderWindowInstance.render();
});

// -----------------------------
// Function to print coordinates of each disc
// -----------------------------
function printDiscCoordinates() {
  discActors.forEach((actor, index) => {
    const pos = actor.getPosition();
    console.log(`Disc ${index}: x=${pos[0]}, y=${pos[1]}, z=${pos[2]}`);
  });
}

// Call the function to print coordinates to the console
printDiscCoordinates();
