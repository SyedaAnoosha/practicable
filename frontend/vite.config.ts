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
    //
    // `[CHANGED 2026-08-13]` Bricolage Grotesque / Source Serif 4 / JetBrains Mono →
    // Schibsted Grotesk / Newsreader / Azeret Mono. See theme.css's `--font-*` block for
    // the reasoning. Keep these three URLs and theme.css's stacks in step: this plugin
    // fetches at build time, so a face named in CSS but missing here fails silently to a
    // system fallback and looks like a rendering bug rather than a config one.
    webfontDownload([
      'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap',
      'https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500;600&display=swap',
    ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
