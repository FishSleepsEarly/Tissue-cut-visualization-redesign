# Web-Based Visualization Project

> ⚠️ **Important Note:**  
> The file `public/data/FeatureMatrix.mtx` is **ignored by Git** and not included in this repository due to its large size.  
> To run the project correctly, you must **manually download** this file from the following URL and place it in the specified directory:

> 📥 [Download FeatureMatrix.mtx](https://drive.google.com/drive/folders/1t6aeMDh2l067_6DEMFyovtRO5swZieBF)  
> 📁 Save it to: `public/data/FeatureMatrix.mtx`

---

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

---

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
│      ├── image.png
│      ├── SpotPositions.csv
│      ├── FeatureMatrix.mtx  <-- Manually downloaded, not tracked by Git
│
└── src/
    ├── three_window.js
    ├── vtk_window_base.js
    ├── vtk_window_piesliced.js
    ├── vtk_window.js
```

- **`index.html`** – Vite will use this HTML file as the main entry point of the web application.
- **`package.json`** – Contains project dependencies and scripts.
- **`vite.config.js`** – Configuration file for Vite.

- **`public/styles.css`** – Global stylesheet for the project.  
- **`public/data/image.png`** – The tissue cut image.  
- **`public/data/SpotPositions.csv`** – The CSV file that contains the coordinates of all cell spots.  
- **`public/data/FeatureMatrix.mtx`** – **Not included in the repo**; must be manually downloaded.

- **`src/three_window.js`** – The 3D visualization window code based on Three.js.  
- **`src/vtk_window.js`** – Legacy code, ignore it.  
- **`src/vtk_window_base.js`** – Legacy code, ignore it.  
- **`src/vtk_window_piesliced.js`** – Legacy code, ignore it.