import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// index.html at the repo root is the Vite entry: the hand-written page is
// adopted as-is and the canvas is an extra module script on top of it.
// pix/, pdf/ and CNAME live in public/ so their URLs are unchanged.
export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', gzipSize: true }),
  ],
  build: {
    target: 'es2022',
    // The tldraw chunk must not be preloaded from index.html. Vite already
    // splits it out via the React.lazy boundary in src/main.tsx; an explicit
    // manualChunks entry promoted it to a top-level chunk, which made Vite
    // emit a <link rel="modulepreload"> for it and eagerly download ~585kB
    // gzipped for every reader. Disabling modulePreload keeps the editor
    // genuinely on-demand.
    modulePreload: false,
    chunkSizeWarningLimit: 2048,
  },
})
