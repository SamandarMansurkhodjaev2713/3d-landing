// «Магнитная» кнопка с плавным сглаживанием через rAF.
// Курсор задаёт цель, реальное смещение догоняет её с инерцией — без рывков.
// При prefers-reduced-motion магнитный эффект отключается полностью.
export function initMagneticButton(el, { reducedMotion = false } = {}) {
  if (!el) return;

  // Короткий тактильный отклик на нажатие — есть всегда.
  el.addEventListener("pointerdown", () => el.classList.add("is-pressed"));
  const release = () => el.classList.remove("is-pressed");
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);

  if (reducedMotion) return;

  const maxShift = 16;
  const strength = 0.4;
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  let raf = null;
  let hovering = false;

  function loop() {
    cur.x += (target.x - cur.x) * 0.18;
    cur.y += (target.y - cur.y) * 0.18;
    el.style.setProperty("--mx", `${cur.x.toFixed(2)}px`);
    el.style.setProperty("--my", `${cur.y.toFixed(2)}px`);

    // Останавливаем цикл, когда кнопка вернулась на место и курсор ушёл.
    if (!hovering && Math.abs(cur.x) < 0.1 && Math.abs(cur.y) < 0.1) {
      cur.x = cur.y = 0;
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
      raf = null;
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function ensureLoop() {
    if (raf === null) raf = requestAnimationFrame(loop);
  }

  el.addEventListener("pointerenter", () => {
    hovering = true;
    ensureLoop();
  });

  el.addEventListener("pointermove", (e) => {
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    target.x = clamp(dx * strength, -maxShift, maxShift);
    target.y = clamp(dy * strength, -maxShift, maxShift);
    ensureLoop();
  });

  el.addEventListener("pointerleave", () => {
    hovering = false;
    target.x = target.y = 0;
    ensureLoop();
  });
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
