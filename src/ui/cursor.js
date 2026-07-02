// Кастомный курсор-прицел: точка (1:1, без инерции) + угловые скобки (лёгкое
// догоняющее сглаживание). На интерактиве скобки стягиваются и подсвечиваются.
// Только для мыши (hover+fine); на тач-устройствах не активируется. Уважает reduced-motion.
export function initCursor({ reducedMotion = false } = {}) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const dot = document.createElement("div");
  dot.id = "cursor-dot";
  const ring = document.createElement("div");
  ring.id = "cursor-ring";
  const box = document.createElement("div");
  box.className = "cur-box";
  ["tl", "tr", "bl", "br"].forEach((p) => {
    const c = document.createElement("span");
    c.className = "cur-corner cur-" + p;
    box.appendChild(c);
  });
  ring.appendChild(box);
  document.body.append(dot, ring);
  document.body.classList.add("has-custom-cursor");

  const SEL = "a, button, .card, .cta-button, .nav-link, .side-toggle, [data-cursor]";
  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let hover = false;

  window.addEventListener(
    "pointermove",
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      if (reducedMotion) ring.style.transform = `translate(${mx}px, ${my}px)`;
      const onInt = !!(e.target.closest && e.target.closest(SEL));
      if (onInt !== hover) {
        hover = onInt;
        ring.classList.toggle("is-hover", hover);
        dot.classList.toggle("is-hover", hover);
      }
    },
    { passive: true }
  );

  document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
  document.addEventListener("pointerup", () => ring.classList.remove("is-down"));
  document.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    dot.style.opacity = "";
    ring.style.opacity = "";
  });

  if (!reducedMotion) {
    const loop = () => {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
