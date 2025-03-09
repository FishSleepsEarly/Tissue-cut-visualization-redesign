import '@kitware/vtk.js';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
// ---------------------------------------------------------------------------
// Create a rendering window.
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

// ---------------------------------------------------------------------------
// Honeycomb layout of discs.
// Each disc is now composed of 9 wedges created using a custom proportion.
// For demonstration, we'll use the same proportions for each disc.
const discRadius = 0.5;   // Overall disc radius
const numRows = 5;        // Number of rows in honeycomb
const numCols = 6;        // Number of columns in honeycomb (total discs = 30)
const xSpacing = discRadius * 2 * 0.95;  // Horizontal spacing between disc centers
const ySpacing = discRadius * 1.65;      // Vertical spacing between disc centers
const xOffset = discRadius;              // Offset for alternate rows

// Define 9 proportions (they should add up to 1). Adjust these as needed.
const portions = [0.1, 0.15, 0.05, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1];
// Define 9 colors (RGB arrays with values from 0 to 1) for the wedges.
const wedgeColors = [
  [1, 0, 0],      // red
  [0, 1, 0],      // green
  [0, 0, 1],      // blue
  [1, 1, 0],      // yellow
  [1, 0, 1],      // magenta
  [0, 1, 1],      // cyan
  [0.5, 0.5, 0.5],// gray
  [1, 0.5, 0],    // orange
  [0.5, 0, 0.5]   // purple
];

// Global array to store all wedge actors from all discs (for opacity control, etc.)
const discWedgeActors = [];

// Create discs in a honeycomb pattern.
for (let row = 0; row < numRows; row++) {
  for (let col = 0; col < numCols; col++) {
    // Compute the center position for the disc.
    let x = col * xSpacing;
    let y = row * ySpacing;
    if (row % 2 === 1) {
      x += xOffset;
    }
    // Create the disc using the custom proportions and colors.
    const wedgeActors = createDiscFromPortions(portions, wedgeColors, discRadius, 20);
    // Position each wedge at the disc center.
    wedgeActors.forEach((wedgeActor) => {
      wedgeActor.setPosition(x, y, 0);
      renderer.addActor(wedgeActor);
      discWedgeActors.push(wedgeActor);
    });
  }
}

// Adjust the camera and render the scene.
renderer.resetCamera();
renderWindowInstance.render();


// ------------------
// Helper Functions//
// ------------------
// ---------------------------------------------------------------------------
// Function to create a single pie slice of the disc.
// Parameters:
//   radius         - radius of the wedge
//   startAngleDeg  - start angle in degrees
//   endAngleDeg    - end angle in degrees
//   numArcPoints   - number of points along the arc (controls smoothness)
function createWedgePolyData(radius, startAngleDeg, endAngleDeg, numArcPoints = 20) {
  const points = [];
  // Center point
  points.push(0, 0, 0);
  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;
  // Arc points along the wedge boundary
  for (let i = 0; i <= numArcPoints; i++) {
    const t = i / numArcPoints;
    const angle = startRad + t * (endRad - startRad);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    points.push(x, y, 0);
  }
  // Create a polygon cell: first number is the number of points, then point indices.
  const numPointsInCell = numArcPoints + 2; // center + arc points
  const cell = [numPointsInCell];
  for (let i = 0; i < numPointsInCell; i++) {
    cell.push(i);
  }
  // Create vtkPoints instance and set the data
  const vtkPointsInstance = vtkPoints.newInstance();
  vtkPointsInstance.setData(Float32Array.from(points), 3);
  // Create polydata and assign points and polygon cell
  const polyData = vtkPolyData.newInstance();
  polyData.setPoints(vtkPointsInstance);
  polyData.getPolys().setData(Uint32Array.from(cell));
  return polyData;
}

// ---------------------------------------------------------------------------
// Helper function to create a wedge actor given a radius, start/end angles, and a color.
function createWedgeActor(radius, startAngle, endAngle, numArcPoints, color) {
  const polyData = createWedgePolyData(radius, startAngle, endAngle, numArcPoints);
  const mapper = vtkMapper.newInstance();
  mapper.setInputData(polyData);
  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(...color);
  // Make wedge boundaries stand out
  actor.getProperty().setEdgeVisibility(true);
  actor.getProperty().setEdgeColor(0, 0, 0);
  actor.getProperty().setLineWidth(2);
  return actor;
}

// ---------------------------------------------------------------------------
// Function to create a full disc composed of wedges.
// Parameters:
//   portions: an array of 9 numbers (summing to 1) that determine the portion of 360° each wedge occupies.
//   colors: an array of 9 RGB arrays (each color is [r, g, b] with values between 0 and 1).
//   radius: radius of the disc.
//   numArcPoints: number of points along the arc for smoothness.
function createDiscFromPortions(portions, colors, radius, numArcPoints = 20) {
  if (portions.length !== 9 || colors.length !== 9) {
    console.error("You must provide exactly 9 portions and 9 colors.");
    return [];
  }
  // Optionally, you can validate that the portions sum to 1.
  const sum = portions.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    console.warn("Portions do not sum exactly to 1. Sum =", sum);
  }
  const wedgeActors = [];
  let currentAngle = 0;
  for (let i = 0; i < 9; i++) {
    const wedgeAngle = portions[i] * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + wedgeAngle;
    const wedgeActor = createWedgeActor(radius, startAngle, endAngle, numArcPoints, colors[i]);
    wedgeActors.push(wedgeActor);
    currentAngle = endAngle;
  }
  return wedgeActors;
}

// ---------------------------------------------------------------------------
// Opacity slider event: adjust opacity of all wedge actors.
const opacitySlider = document.getElementById('opacity-slider');
if (opacitySlider) {
  opacitySlider.addEventListener('input', (event) => {
    const opacity = parseFloat(event.target.value);
    discWedgeActors.forEach((actor) => {
      actor.getProperty().setOpacity(opacity);
    });
    renderWindowInstance.render();
  });
}

// ---------------------------------------------------------------------------
// Function to print coordinates for each wedge actor.
function printWedgeCoordinates() {
  discWedgeActors.forEach((actor, index) => {
    const pos = actor.getPosition();
    console.log(`Wedge ${index}: x=${pos[0]}, y=${pos[1]}, z=${pos[2]}`);
  });
}

// Example: Print coordinates to the console.
printWedgeCoordinates();
