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
│
└── src/
    ├── image.png
    ├── three_window.js
    ├── vtk_window_base.js
    ├── vtk_window_piesliced.js
    ├── vtk_window.js
```

- **`index.html`** – Main entry point of the web application.
- **`package.json`** – Contains project dependencies and scripts.
- **`vite.config.js`** – Configuration file for Vite.
- **`public/styles.css`** – Global stylesheet for the project.
- **`src/`** – Contains source code and assets for the application.

This structure helps keep the project organized and easy to maintain.
