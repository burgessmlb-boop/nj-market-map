import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the build path-independent, so it works on GitHub Pages
// (username.github.io/repo/) and on a custom domain alike.
export default defineConfig({
  plugins: [react()],
  base: './',
})
