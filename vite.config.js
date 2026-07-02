import { defineConfig } from "vite";

// Папка public автоматически становится корнем статики Vite,
// поэтому в коде пути к ассетам начинаются с import.meta.env.BASE_URL, а не с "/".
//
// base:
//   dev   → "/"             (npm run dev работает по localhost:5173/)
//   build → "/3d-landing/"  (проект-сайт GitHub Pages живёт в подпапке /<repo>/)
// Все рантайм-пути к ассетам собираются через import.meta.env.BASE_URL,
// поэтому одинаково работают и локально, и на GitHub Pages.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/3d-landing/" : "/",
  server: {
    host: true,
    open: false
  },
  build: {
    target: "esnext",
    // GLB-модель крупная — не засоряем консоль предупреждениями о размере чанка.
    chunkSizeWarningLimit: 2000
  }
}));
