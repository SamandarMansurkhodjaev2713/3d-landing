import { SECTION_IDS } from "../config/cameraKeyframes.js";

// Подсветка активного пункта навигации по текущей секции.
// set(index) вызывается из animationLoop только при смене индекса.
export function createActiveSection(navLinks) {
  return {
    set(index) {
      const targetId = SECTION_IDS[index];
      navLinks.forEach((link) => {
        link.el.classList.toggle("is-active", link.target === targetId);
      });
    }
  };
}
