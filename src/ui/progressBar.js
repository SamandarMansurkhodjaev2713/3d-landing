// Полоса прогресса скролла. Обновляется из animationLoop по доле прокрутки.
// Используем transform: scaleX — дешевле, чем менять width каждый кадр.
export function createProgressBar(el) {
  let last = -1;
  return {
    set(fraction) {
      const f = Math.max(0, Math.min(1, fraction));
      if (Math.abs(f - last) < 0.001) return;
      last = f;
      el.style.transform = `scaleX(${f})`;
    }
  };
}
