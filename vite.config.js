import { defineConfig } from "vite";

// Папка public автоматически становится корнем статики Vite,
// поэтому в коде пути к ассетам начинаются с import.meta.env.BASE_URL, а не с "/".
//
// base:
//   dev   → "/"             (npm run dev работает по localhost:5173/)
//   build → "/3d-landing/"  (проект-сайт GitHub Pages живёт в подпапке /<repo>/)
// Все рантайм-пути к ассетам собираются через import.meta.env.BASE_URL,
// поэтому одинаково работают и локально, и на GitHub Pages.
export default defineConfig(({ command, mode }) => ({
  // Preview запускается командой `serve`, как и dev-сервер, но в production-mode.
  // Поэтому одной проверки `command === "build"` недостаточно: собранный HTML
  // ссылался бы на /3d-landing/, а preview искал бы ассеты от корня и возвращал
  // index.html вместо CSS/JS. Production-mode сохраняет один base для build/preview.
  base: command === "build" || mode === "production" ? "/3d-landing/" : "/",
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
