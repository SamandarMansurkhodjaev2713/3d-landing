import { CONTENT } from "../config/content.js";

// Строит навигацию из CONTENT.nav: логотип + ссылки + CTA.
// Клик по ссылке — плавный скролл к секции. Возвращает ссылки и хелпер скролла.
export function createNavigation({ logoEl, linksEl, reducedMotion = false, onNavigate }) {
  logoEl.textContent = CONTENT.nav.logo;

  const links = [];

  CONTENT.nav.links.forEach((item, index) => {
    const a = document.createElement("a");
    a.className = "nav-link" + (item.cta ? " nav-link--cta" : "");
    a.href = "#" + item.target;
    a.innerHTML = `<span class="nav-link__index">0${index + 1}</span><span class="nav-link__label">${item.label}</span>`;
    a.dataset.target = item.target;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToSection(item.target, reducedMotion);
      if (onNavigate) onNavigate();
    });

    linksEl.appendChild(a);
    links.push({ el: a, target: item.target });
  });

  return { links, scrollToSection: (id) => scrollToSection(id, reducedMotion) };
}

function scrollToSection(id, reducedMotion) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({
    top: el.offsetTop,
    behavior: reducedMotion ? "auto" : "smooth"
  });
}
