// Мобильное меню: гамбургер открывает/закрывает выезжающую панель навигации.
// Управляет классом на <nav> и aria-атрибутами для доступности.
export function createMobileMenu({ navEl, toggleBtn }) {
  function setOpen(open) {
    navEl.classList.toggle("nav--open", open);
    toggleBtn.classList.toggle("is-active", open);
    toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menu-locked", open);
  }

  toggleBtn.addEventListener("click", () => {
    setOpen(!navEl.classList.contains("nav--open"));
  });

  // Esc закрывает меню.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  return { close: () => setOpen(false) };
}
