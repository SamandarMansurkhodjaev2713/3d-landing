// HUD-акцент для статистики «Миссии»: цифры «декодируются» — быстро прокручивают
// случайные знаки и слева направо защёлкиваются в финальное значение. Один раз при появлении.
export function initCountUp({ reducedMotion = false } = {}) {
  const items = document.querySelectorAll("[data-count]");
  if (!items.length) return;

  if (reducedMotion) {
    items.forEach((el) => (el.textContent = el.dataset.count));
    return;
  }

  // Тот же надёжный триггер по скроллу, что и у reveal.
  let pending = [...items];
  function check() {
    const h = window.innerHeight;
    pending = pending.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.82 && r.bottom > 0) {
        decode(el);
        return false;
      }
      return true;
    });
    if (!pending.length) window.removeEventListener("scroll", check);
  }
  window.addEventListener("scroll", check, { passive: true });
  check();
}

const GLYPHS = "0123456789";

function decode(el) {
  const final = String(el.dataset.count);
  const duration = 750;
  const start = performance.now();

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    // Сколько символов уже «защёлкнулось» (с небольшим опережением).
    const locked = Math.floor(t * (final.length + 0.6));
    let out = "";
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      if (i < locked || ch < "0" || ch > "9") out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = final;
  }
  requestAnimationFrame(frame);
}
