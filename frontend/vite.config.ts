import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { webfontDownload } from 'vite-plugin-webfont-dl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(), // DESIGN.md §51.2: the Vite plugin, not the PostCSS path
    // DESIGN.md §9.5: self-host the three-face type system at build time rather than
    // linking Google Fonts at runtime — a live third-party font request on every page
    // load is a privacy/performance issue this product's own buyers would notice.
    // theme.css has named these fonts since Day 1 but nothing ever actually loaded
    // them, so every page has silently been rendering in system-ui/Georgia fallbacks.
    webfontDownload([
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&display=swap',
      'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap',
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
    ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
