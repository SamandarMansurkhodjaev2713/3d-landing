// Появление блоков при входе в зону видимости. Используем проверку по скроллу
// (а не IntersectionObserver) — она надёжнее, срабатывает и на программном скролле,
// и не зависит от фоновой вкладки. После появления элемент снимается с очереди.
export function initReveal() {
  let pending = [...document.querySelectorAll("[data-reveal]")];
  if (!pending.length) return;

  function check() {
    const h = window.innerHeight;
    pending = pending.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.9 && r.bottom > 0) {
        el.classList.add("is-revealed");
        return false;
      }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    }
  }

  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check, { passive: true });
  check(); // стартовая проверка для уже видимых блоков
}

// Стартовая анимация hero — запускается после загрузки сцены, без скролла.
export function playHeroReveal() {
  document.body.classList.add("hero-ready");
}
