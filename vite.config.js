import { defineConfig } from 'vite';

export default defineConfig({
  // Configuration options go here

  // If your main entry file is in public/vtk_window.js:
  // (Though typically, you'd place your source in a `src/` folder)
  build: {
    rollupOptions: {
      input: '/src/vtk_window.js', 
      // or point to your main JS entry if you restructure
    },
    outDir: 'dist',  // The folder where production build files will go
  },
});
