// Единственный requestAnimationFrame-цикл проекта.
// onFrame(dt, elapsed) — dt в секундах (ограничен, чтобы не было скачков после фоновой вкладки).
export function createAnimationLoop(onFrame) {
  let rafId = null;
  let last = 0;
  let running = false;

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    onFrame(dt, now / 1000);
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    }
  };
}
