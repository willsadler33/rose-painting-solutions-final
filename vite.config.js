import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps every asset path relative, so the built site works from
// any folder or sub-path (Netlify, Vercel, cPanel hosting, a USB stick…).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // `npm run dev` only serves the front end. To work on the dashboard locally with
  // its API, run `npm run build` then `npm run serve` (see README → Owner dashboard).
  build: {
    // Two pages: the public website, and the owner dashboard at /admin/ (its own bundle,
    // so visitors never download any dashboard code).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
    target: 'es2020',
    cssMinify: true,
    sourcemap: false,
  },
})
