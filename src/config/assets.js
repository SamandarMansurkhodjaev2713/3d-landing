// Пути к статическим ассетам.
// BASE_URL учитывает подпапку деплоя (напр. "/3d-landing/" на GitHub Pages),
// в dev-режиме он равен "/". Всегда оканчивается на "/".
const BASE = import.meta.env.BASE_URL;

export const ASSETS = {
  model: `${BASE}assets/models/polus-rover.glb`,

  hdr: {
    main: `${BASE}assets/hdr/rogland_clear_night_1k.hdr`
  },

  textures: {
    earth: `${BASE}assets/textures/earth/blue-marble-1024.png`
  }
};
