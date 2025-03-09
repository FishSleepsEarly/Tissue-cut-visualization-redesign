# Web-Based Visualization Project

## 1. How to Run the Project

To launch the web-based program, follow these steps:

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```

By default, the web will be available at: [http://localhost:5173/](http://localhost:5173/) (Vite's default settings).

Vite is a tool that automatically manages dependencies and package paths, making the development process more efficient.

## 2. Project Structure

```
project-root/
│── index.html
│── package-lock.json
│── package.json
│── vite.config.js
│
├── public/
│   ├── styles.css
│   ├── data/
│      ├──image.png
│      ├──SpotPositions.csv
│
└── src/
    ├── three_window.js
    ├── vtk_window_base.js
    ├── vtk_window_piesliced.js
    ├── vtk_window.js
```

- **`index.html`** – Vite will use this html file as the main entry point of the web application.
- **`package.json`** – Contains project dependencies and scripts.
- **`vite.config.js`** – Configuration file for Vite.
  
- **`public/styles.css`** – Global stylesheet for the project.  
- **`public/data/image.png`** – The tissue cut image.
- **`public/data/SpotPositions.csv`** – The csv file that contains the coordinates of all cell spots.
- 
- **`src/three_window.js`** – The 3D visiualization window code based on three.js.
- **`src/vtk_window.js`** – Legacy code, ignore it.
- **`src/vtk_window_base.js`** – Legacy code, ignore it.
- **`src/vtk_window_piesliced.js`** – Legacy code, ignore it.
