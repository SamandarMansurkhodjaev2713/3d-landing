// Стили (порядок важен для каскада).
import "./styles/base.css";
import "./styles/typography.css";
import "./styles/layout.css";
import "./styles/nav.css";
import "./styles/sections.css";
import "./styles/hud.css";
import "./styles/panels.css";
import "./styles/animations.css";
import "./styles/cursor.css";
import "./styles/hotspots.css";
import "./styles/responsive.css";
import "./styles/editorial.css";

import { CONTENT } from "./config/content.js";
import { CAMERA_KEYFRAMES, CAMERA_KEYFRAMES_MOBILE, SECTION_IDS } from "./config/cameraKeyframes.js";

import { createRenderer, pixelRatioCap } from "./three/createRenderer.js";
import { createScene } from "./three/createScene.js";
import { createCamera } from "./three/createCamera.js";
import { createLights } from "./three/createLights.js";
import { createSky } from "./three/createSky.js";
import { createSunBody } from "./three/createSunBody.js";
import { createDust } from "./three/createDust.js";
import { createScan } from "./three/createScan.js";
import { createArchiveReconstruction } from "./three/createArchiveReconstruction.js";
import { createComposer } from "./three/createComposer.js";
import { loadEnvironment } from "./three/loadEnvironment.js";
import { loadRoverModel } from "./three/loadRoverModel.js";
import { createCameraRig } from "./three/cameraRig.js";
import { createAnimationLoop } from "./three/animationLoop.js";

import { createNavigation } from "./ui/navigation.js";
import { createMobileMenu } from "./ui/mobileMenu.js";
import { createProgressBar } from "./ui/progressBar.js";
import { createActiveSection } from "./ui/activeSection.js";
import { initReveal, playHeroReveal } from "./ui/revealAnimations.js";
import { initCountUp } from "./ui/countUpStats.js";
import { initMagneticButton } from "./ui/magneticButton.js";
import { createHud } from "./ui/hud.js";
import { initCursor } from "./ui/cursor.js";
import { createHotspots } from "./ui/hotspots.js";
import { createCameraPanel } from "./ui/cameraPanel.js";
import { createScenePanel } from "./ui/scenePanel.js";
import { createSectionDirector } from "./ui/sectionDirector.js";

const el = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 768px)").matches;

// --- Видимый отказ загрузки ---
// Раньше сбой сети/загрузки тихо «глотался» в .catch(), и сайт молча уезжал в
// интро БЕЗ ровера (пустая сцена с текстом) либо просто зависал на 0% — ни то,
// ни другое не даёт ни малейшей зацепки, что пошло не так. Теперь любой
// фатальный сбой (упавшая модель, необработанное исключение при инициализации
// вплоть до отсутствия WebGL, зависшая без ответа загрузка) превращается в
// понятный экран с кнопкой «Повторить попытку».
//
// Регистрируем это на уровне модуля, ДО вызова boot() — если сцена упадёт
// синхронно на самой первой строчке (например, создание WebGL-контекста), эти
// обработчики уже должны слушать, а не создаваться позже внутри boot().
let loadResolved = false; // терминально: True после ЛЮБОГО финального исхода (успех/ошибка)

function showLoadError(message) {
  if (loadResolved) return; // уже финализировано — не перекрываем ни успех, ни прошлую ошибку
  loadResolved = true;
  document.body.classList.remove("intro-active");
  const loader = el("loader");
  if (loader) {
    loader.classList.remove("is-booting", "is-cleared");
    loader.classList.add("has-error");
  }
  const errText = el("loader-error-text");
  if (errText && message) errText.textContent = message;
}

window.addEventListener("error", () => showLoadError());
window.addEventListener("unhandledrejection", () => showLoadError());

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

boot();

function boot() {
  renderContent();

  // --- Three.js ---
  const canvas = el("three-canvas");
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = createCamera();
  const lights = createLights(scene);

  // Физически сдержанное лунное небо: статичные звёзды, слабый Млечный Путь и Земля.
  const sky = createSky({ isMobile, pixelRatio: renderer.getPixelRatio() });
  scene.add(sky.group);

  // Видимое тело солнца — диск на векторе ключевого света, низко над кромкой кратера.
  const sunBody = createSunBody({ isMobile, sunPosition: lights.sun.position });
  scene.add(sunBody.mesh);

  // Пылинки реголита, ловящие скользящий свет (forward-scatter к солнцу).
  const dust = createDust({ isMobile, pixelRatio: renderer.getPixelRatio(), sunDir: lights.sun.position });
  scene.add(dust.points);

  // Лидарный пинг по грунту — ровер «сканирует» поверхность (живёт), не зависит от модели.
  const scan = createScan({});
  scene.add(scan.mesh);

  // Сдержанный bloom (только десктоп). render() ниже сам выбирает composer или прямой рендер.
  const composerCtl = isMobile ? null : createComposer(renderer, scene, camera);
  let lowQuality = false; // адаптивное качество: при низком FPS выключаем bloom (см. цикл)
  const render = () => (composerCtl && !lowQuality ? composerCtl.composer.render() : renderer.render(scene, camera));

  // Состояние курсора для параллакса (нормализованное -1..1, со сглаживанием).
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  if (!reducedMotion) {
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  // Рабочая копия ракурсов (для портрета — свои). Её правит панель камеры, читает rig.
  const kfSource = isMobile ? CAMERA_KEYFRAMES_MOBILE : CAMERA_KEYFRAMES;
  const keyframes = kfSource.map((k) => ({ ...k }));
  const sections = SECTION_IDS.map((id) => el(id));
  const rig = createCameraRig({
    camera,
    keyframes,
    sections,
    reducedMotion,
    distanceScale: isMobile ? 1.32 : 1
  });

  // Хотспоты инспекции (десктоп): привязаны к мировым точкам ровера на hero-ракурсе.
  // Создаём ПОСЛЕ keyframes — иначе на десктопе обращение к keyframes[0] падало в TDZ.
  const hotspots = isMobile ? null : createHotspots({ roverPos: { x: keyframes[0].x, y: 0, z: keyframes[0].z } });

  // --- UI ---
  const nav = createNavigation({
    logoEl: el("nav-logo"),
    linksEl: el("nav-links"),
    reducedMotion,
    onNavigate: () => mobileMenu.close()
  });
  const mobileMenu = createMobileMenu({ navEl: el("main-nav"), toggleBtn: el("nav-toggle") });
  const progressBar = createProgressBar(el("progress-bar"));
  const activeSection = createActiveSection(nav.links);
  const hud = createHud(el("hud-layer"));
  const sectionDirector = createSectionDirector({ reducedMotion });
  initReveal();
  initCountUp({ reducedMotion });
  initMagneticButton(el("launch-button"), { reducedMotion });
  initCursor({ reducedMotion });

  const replayBtn = el("replay-button");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => window.location.reload());
  }

  // --- Панели настройки (СЦЕНА/КАМЕРА). Только в dev-режиме (для локальной донастройки);
  // в продакшн-сборке (деплой) их нет. В деплое можно временно включить через #dev в URL,
  // а в dev — скрыть через #clean. ---
  const DEV_PANELS = (import.meta.env.DEV || location.hash.includes("dev")) && !location.hash.includes("clean");
  const sceneRefs = { renderer, lights, env: null };
  let scenePanel = null;
  let cameraPanel = null;
  if (DEV_PANELS) {
    scenePanel = createScenePanel({
      container: el("scene-panel"),
      refs: sceneRefs,
      onClose: () => closePanel("scene")
    });
    cameraPanel = createCameraPanel({
      container: el("camera-panel"),
      keyframes,
      defaults: kfSource,
      onClose: () => closePanel("camera")
    });
    setupToggles();
  } else {
    const st = el("side-toggles");
    if (st) st.style.display = "none";
  }

  // --- Лоадер ---
  const loader = el("loader");
  const loaderPercent = el("loader-percent");
  const loaderPhase = el("loader-phase");

  const retryBtn = el("loader-error-retry");
  if (retryBtn) retryBtn.addEventListener("click", () => window.location.reload());

  // Подстраховка от запроса, который не падает и не резолвится, а просто висит
  // (капризный прокси/фаервол): если через 25с интро так и не началось — не молчим.
  // На успешном пути таймер сбрасывается ниже, в Promise.allSettled(...).then(...);
  // если он всё же сработает после успеха — showLoadError() просто не-op (loadResolved уже true).
  const loadWatchdog = setTimeout(() => {
    showLoadError("Загрузка занимает необычно много времени. Проверьте соединение и обновите страницу.");
  }, 25000);

  // --- Вступление: Cold Boot -> Arc Descent -> Seamless Handoff ---
  // 1) Бут: пока грузятся ассеты, тёмная сцена видна сквозь полупрозрачный лоадер,
  //    телеметрия привязана к реальному проценту, камера «дышит» на широком ракурсе.
  // 2) Дуга: камера заходит по дуге (Безье) и НАХОДИТ ровер поздним рефреймом взгляда
  //    в последней трети — ровно когда восходит солнце (диск + свет + пыль).
  // 3) Склейка: лоадер уходит рано, hero-текст и хром накатываются на хвост движения.
  const INTRO_DUR = 4.2;
  // Широкий взгляд бута/начала дуги направлен НА солнце (к вектору ключевого света,
  // -x, низко над горизонтом). Сначала смотрим, как над зубчатой кромкой восходит
  // солнце, затем поздним рефреймом разворачиваемся и находим ровер в его свете.
  const wideLook = { x: -45.0, y: 5.0, z: 16.0 };
  const BOOT_POSE = { px: -13, py: 22, pz: 33, fov: 60 }; // орбитальный ракурс бута/старта дуги

  let bootActive = false;
  let introActive = false;
  let introT = 0;
  let heroPose = null;
  let arcStart = null;
  let arcCtrl = null;
  let sunTarget = 0;
  let expTarget = 1;
  let introSkipCleanup = null;
  let revealedHero = false;
  let shownChrome = false;
  let hidLoader = false;

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth01 = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const lin = (a, b, t) => a + (b - a) * t;

  // Бут-фаза: затухающий idle-дрейф камеры на широком ракурсе, пока грузятся ассеты.
  function bootUpdate(dt, elapsed) {
    const dx = Math.sin(elapsed * 0.18) * 1.4;
    const dy = Math.sin(elapsed * 0.13 + 1.0) * 0.8;
    const dz = Math.cos(elapsed * 0.11) * 1.4;
    camera.position.set(BOOT_POSE.px + dx, BOOT_POSE.py + dy, BOOT_POSE.pz + dz);
    if (Math.abs(camera.fov - BOOT_POSE.fov) > 0.001) {
      camera.fov = BOOT_POSE.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(wideLook.x, wideLook.y, wideLook.z);
  }

  // Дуга спуска: квадратичная Безье по позиции + поздний рефрейм взгляда на ровер.
  function introUpdate(dt) {
    introT += dt;
    const t = Math.min(introT / INTRO_DUR, 1);
    const e = easeInOut(t);
    const it = 1 - e;
    camera.position.set(
      it * it * arcStart.px + 2 * it * e * arcCtrl.px + e * e * heroPose.px,
      it * it * arcStart.py + 2 * it * e * arcCtrl.py + e * e * heroPose.py,
      it * it * arcStart.pz + 2 * it * e * arcCtrl.pz + e * e * heroPose.pz
    );
    const fov = lin(arcStart.fov, heroPose.fov, e);
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // Поздний рефрейм: сначала смотрим восход (0..0.55), затем разворот к роверу.
    const rf = smooth01(0.55, 1.0, t);
    camera.lookAt(
      lin(wideLook.x, heroPose.lx, rf),
      lin(wideLook.y, heroPose.ly, rf),
      lin(wideLook.z, heroPose.lz, rf)
    );
    // Восход: солнце (диск + свет + пыль) загорается ДО разворота — мы видим сам момент.
    const lr = smooth01(0.3, 0.55, t);
    lights.sun.intensity = sunTarget * lr;
    renderer.toneMappingExposure = lin(0.2, expTarget, lr);
    sunBody.setIntensity(lr);
    dust.setIntensity(lr * (1 - smooth01(0.72, 1, t)) * 0.72);
    const reconstructionProgress = smooth01(0.58, 0.94, t);
    const reconstructionOpacity = 0.98 * (1 - smooth01(0.88, 1, t));
    if (reconstructionCtl) reconstructionCtl.setIntro(reconstructionProgress, reconstructionOpacity);
    // Seamless Handoff: лоадер уходит рано, текст и хром — на хвост движения.
    if (!hidLoader && t > 0.08) {
      hidLoader = true;
      if (loader) loader.classList.add("is-hidden");
    }
    if (!revealedHero && t > 0.78) {
      revealedHero = true;
      playHeroReveal();
    }
    if (!shownChrome && t > 0.9) {
      shownChrome = true;
      document.body.classList.add("is-loaded");
    }
    if (t >= 1) finishIntro();
  }

  // Конец бут-фазы (ассеты загружены) -> старт дуги спуска.
  function startIntro() {
    heroPose = rig.poseAt(0);
    rig.parkRover(0); // ровер заранее в hero-позе — без рывка при передаче ригу
    if (reconstructionCtl) reconstructionCtl.setIntro(0, 0.98);
    if (reducedMotion) {
      finishIntro();
      return;
    }
    // Старт дуги = текущая (дрейфующая) поза бута -> переход бесшовный.
    arcStart = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, fov: camera.fov };
    arcCtrl = {
      px: (arcStart.px + heroPose.px) / 2 + 6,
      py: (arcStart.py + heroPose.py) / 2 + 3,
      pz: (arcStart.pz + heroPose.pz) / 2 - 2
    };
    bootActive = false;
    introActive = true;
    introT = 0;
    if (loaderPhase) loaderPhase.textContent = "Системы в норме";
    if (loaderPercent) loaderPercent.textContent = "100%";
    if (loader) loader.classList.add("is-cleared");
    // Пропуск дуги по любому действию пользователя.
    const skip = () => {
      if (introActive) introT = Math.max(introT, INTRO_DUR - 0.5);
    };
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    introSkipCleanup = () => {
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }

  function finishIntro() {
    bootActive = false;
    introActive = false;
    lights.sun.intensity = sunTarget;
    renderer.toneMappingExposure = expTarget;
    sunBody.setIntensity(1);
    dust.setIntensity(0);
    scan.setIntensity(0);
    if (reconstructionCtl) reconstructionCtl.finish();
    if (loader) loader.classList.add("is-hidden");
    document.body.classList.remove("intro-active");
    document.body.classList.add("is-loaded"); // хром и hero проявляются на финале
    if (introSkipCleanup) {
      introSkipCleanup();
      introSkipCleanup = null;
    }
    playHeroReveal();
  }

  // Cold Boot: запоминаем целевой свет, гасим сцену и входим в бут-фазу (пока грузимся).
  function startBoot() {
    sunTarget = lights.sun.intensity; // цели берём ДО гашения (панель уже прочла их)
    expTarget = renderer.toneMappingExposure;
    if (reducedMotion) return; // reduced-motion: без бут-драматургии, лоадер непрозрачный
    lights.sun.intensity = 0;
    renderer.toneMappingExposure = 0.2;
    sunBody.setIntensity(0);
    dust.setIntensity(0);
    bootActive = true;
    document.body.classList.add("intro-active"); // лочим скролл сразу
    if (loader) loader.classList.add("is-booting"); // лоадер полупрозрачный -> видно звёзды
  }
  startBoot();

  // --- Главный цикл ---
  let lastIndex = -1;
  let explodeCtl = null;
  let reconstructionCtl = null;
  // Инерция камеры/сцены (Stage D): запаздывание + velocity-дрейф звёзд по скорости скролла.
  let prevSF = 0;
  let velDrift = 0;
  let camLag = null;
  // Адаптивное качество: мониторим FPS, при устойчивой просадке снижаем нагрузку (только вниз).
  let fpsT = 0;
  let fpsN = 0;
  let qualityStep = 0;
  const loop = createAnimationLoop((dt, elapsed) => {
    // Бут-фаза: тёмная сцена + idle-дрейф камеры, пока грузятся ассеты.
    if (bootActive) {
      bootUpdate(dt, elapsed);
      sky.update(elapsed, 0, 0, reducedMotion);
      sunBody.update(camera, elapsed);
      dust.update(elapsed);
      render();
      return;
    }
    // Дуга спуска: камерой рулим вручную (без рига и параллакса).
    if (introActive) {
      introUpdate(dt);
      sky.update(elapsed, 0, 0, reducedMotion);
      sunBody.update(camera, elapsed);
      dust.update(elapsed);
      render();
      return;
    }
    rig.update(dt);
    const sf = rig.state.sectionFloat;
    sectionDirector.update(sf);
    const missionDust = Math.max(0, 1 - Math.abs(sf - 1.08) / 0.34);
    dust.setIntensity(missionDust * 0.24);
    const terrainPulse = Math.max(0, 1 - Math.abs(sf - 1.45) / 0.52);
    scan.setIntensity(terrainPulse * 0.22);
    if (reconstructionCtl) {
      const inspection = Math.max(0, 1 - Math.abs(sf - 2) / 0.72);
      const inspectionProgress = Math.max(0, Math.min(1, (sf - 1.62) / 0.76));
      reconstructionCtl.setInspection(inspectionProgress, inspection * 0.52);
    }
    // Разборка ровера по скроллу: раскрывается к секции «Системы» (3) и собирается обратно.
    if (explodeCtl) {
      explodeCtl.setAmount(Math.max(0, 1 - Math.abs(sf - 3) / 1.3));
    }
    // Инерция: скорость скролла даёт лёгкий velocity-дрейф звёзд/пыли (вес сцены),
    // сглаженный, чтобы не дёргался. Для reduced-motion отключаем.
    const rawVel = !reducedMotion && dt > 0 ? (sf - prevSF) / dt : 0;
    prevSF = sf;
    const velTarget = Math.max(-0.35, Math.min(0.35, rawVel * 0.12));
    velDrift += (velTarget - velDrift) * (1 - Math.exp(-dt * 5));
    // Параллакс от курсора: лёгкий сдвиг камеры — ближний ровер двигается сильнее дальних звёзд.
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    camera.position.x += mouse.x * 0.45;
    camera.position.y += -mouse.y * 0.28;
    // Микро-инерция камеры: лёгкое запаздывание сглаживает быстрый скролл,
    // незаметно на медленном (НЕ имитация лагов — высокий cutoff, ~0.1с).
    if (!reducedMotion) {
      if (!camLag) camLag = camera.position.clone();
      camLag.lerp(camera.position, 1 - Math.exp(-dt * 10));
      camera.position.copy(camLag);
    }
    sky.update(elapsed, mouse.x + velDrift, mouse.y, reducedMotion);
    sunBody.update(camera, elapsed);
    dust.update(elapsed);
    scan.update(elapsed);
    if (hotspots) hotspots.update(camera, Math.max(0, 1 - sf / 0.6)); // видны на hero, гаснут к секции 1
    render();

    // Адаптив качества (только в steady-state, не во время интро/компиляции шейдеров).
    fpsT += dt;
    fpsN++;
    if (fpsT >= 1.5) {
      const fps = fpsN / fpsT;
      fpsT = 0;
      fpsN = 0;
      if (fps < 45 && qualityStep < 2) {
        qualityStep++;
        if (qualityStep === 1) {
          lowQuality = true; // шаг 1: выключаем bloom
        } else {
          // шаг 2: снижаем pixelRatio
          renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * 0.8));
          if (composerCtl) composerCtl.setSize(window.innerWidth, window.innerHeight);
        }
      }
    }

    progressBar.set(rig.progress);
    hud.update(rig, elapsed);
    const idx = rig.activeIndex;
    if (idx !== lastIndex) {
      lastIndex = idx;
      activeSection.set(idx);
      if (cameraPanel) cameraPanel.syncSection(idx);
    }
  });
  loop.start();

  // Не жжём GPU на скрытой вкладке.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });

  // --- Загрузка ассетов ---
  // HDRI не критичен: без него сцена работает на прямом свете, просто без
  // env-отражений на металле — не повод показывать ошибку и прерывать загрузку.
  const envPromise = loadEnvironment(renderer, scene)
    .then((env) => {
      sceneRefs.env = env;
      if (scenePanel) scenePanel.bindEnvironment(env);
    })
    .catch((err) => console.error("HDRI не загрузился:", err));

  // Модель ровера — единственный объект сцены; без неё показывать «рабочий» сайт
  // нельзя, поэтому её сбой запоминаем отдельно и превращаем в видимую ошибку.
  let modelFailed = false;
  const modelPromise = loadRoverModel(scene, (p) => {
    const pct = p === null ? null : Math.round(p * 100);
    if (loaderPercent) loaderPercent.textContent = pct === null ? "…" : `${pct}%`;
    // Телеметрия привязана к реальным байтам загрузки (а не декоративный спиннер).
    if (loaderPhase && pct !== null) {
      loaderPhase.textContent = pct < 35 ? "Инициализация борта" : pct < 75 ? "Калибровка оптики" : "Синхронизация";
    }
  })
    .then(({ model, base, explode }) => {
      rig.setRoverModel(model, base);
      explodeCtl = explode;
      reconstructionCtl = createArchiveReconstruction(model, {
        isMobile,
        pixelRatio: renderer.getPixelRatio()
      });
    })
    .catch((err) => {
      modelFailed = true;
      console.error("Модель не загрузилась:", err);
    });

  Promise.allSettled([envPromise, modelPromise]).then(() => {
    clearTimeout(loadWatchdog);
    if (loadResolved) return; // уже показан экран ошибки (например, синхронный крэш выше)
    if (modelFailed) {
      showLoadError("Не удалось загрузить 3D-модель. Проверьте соединение и отключите блокировщики контента, затем обновите страницу.");
      return;
    }
    loadResolved = true;
    rig.refresh();
    startIntro(); // подлёт из космоса → выход из тени → передача ригу + проявление hero
  });

  // --- Resize ---
  let resizeScheduled = false;
  window.addEventListener("resize", () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap()));
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composerCtl) composerCtl.setSize(window.innerWidth, window.innerHeight);
      if (reconstructionCtl) reconstructionCtl.setPixelRatio(renderer.getPixelRatio());
      rig.refresh();
    });
  });

  rig.refresh();

  // --- Управление панелями ---
  function setupToggles() {
    el("toggle-scene").addEventListener("click", () => togglePanel("scene"));
    el("toggle-camera").addEventListener("click", () => togglePanel("camera"));
  }
  function togglePanel(which) {
    const open =
      which === "scene"
        ? !el("scene-panel").classList.contains("panel--open")
        : !el("camera-panel").classList.contains("panel--open");
    closePanel("scene");
    closePanel("camera");
    if (open) openPanel(which);
  }
  function openPanel(which) {
    el(`${which}-panel`).classList.add("panel--open");
    el(`toggle-${which}`).classList.add("is-active");
  }
  function closePanel(which) {
    el(`${which}-panel`).classList.remove("panel--open");
    el(`toggle-${which}`).classList.remove("is-active");
  }
}

// --- Рендер текстового контента из CONTENT в пустые секции index.html ---
function renderContent() {
  document.title = "ПОЛЮС // Архив миссии";

  el("section-hero").innerHTML = heroMarkup();
  el("section-mission").innerHTML = missionMarkup();
  el("section-architecture").innerHTML = architectureMarkup();
  el("section-systems").innerHTML = systemsMarkup();
  el("section-log").innerHTML = logMarkup();
  el("section-launch").innerHTML = launchMarkup();
}

// Заголовки разбиваем на строки в масках — для построчного «выезда» из-под маски.
function lines(text) {
  return String(text)
    .split("\n")
    .map((l, i) => `<span class="ln" style="--l:${i}"><span class="ln-in">${l}</span></span>`)
    .join("");
}

function heroMarkup() {
  const h = CONTENT.hero;
  const meta = h.meta.map((m) => `<li>${m}</li>`).join("");
  return `
    <div class="section-inner hero">
      <div class="hero-index">${h.index}</div>
      <div class="hero-title">
        <span class="hero-line hero-line--1">${h.titleLine1}</span>
        <span class="hero-line hero-line--stroke">${h.titleLine2Stroke}</span>
        <span class="hero-line hero-line--2">${h.titleLine2}</span>
      </div>
      <p class="hero-summary">${h.summary}</p>
      <ul class="hero-meta">${meta}</ul>
      <div class="scroll-indicator">
        <span class="scroll-indicator__text">${h.scrollText}</span>
        <span class="scroll-indicator__line"></span>
      </div>
    </div>`;
}

function missionMarkup() {
  const m = CONTENT.mission;
  const stats = m.stats
    .map(
      (s) => `
      <div class="stat" data-reveal>
        <div class="stat-value"><span data-count="${s.value}">0</span><span class="stat-suffix">${s.suffix}</span></div>
        <div class="stat-label">${s.label}</div>
      </div>`
    )
    .join("");
  const route = m.route;
  return `
    <div class="section-inner section-inner--left">
      <div class="mission-layout">
        <div class="block" data-reveal>
          <span class="section-tag">${m.tag}</span>
          <h2 class="section-title">${lines(m.title)}</h2>
          <p class="section-lead">${m.lead}</p>
          <p class="section-body">${m.body}</p>
          <p class="section-body section-body--muted">${m.body2}</p>
        </div>
        <figure class="route-profile" data-reveal style="--i:2">
          <figcaption>
            <span>${route.label}</span>
            <strong>${route.distance}</strong>
          </figcaption>
          <svg viewBox="0 0 640 150" role="img" aria-label="Профиль автономного маршрута">
            <path class="route-grid" d="M0 128H640M0 88H640M0 48H640"/>
            <path class="route-base" d="M12 118 C88 104 110 70 174 78 S250 126 306 96 S392 34 448 52 S532 112 628 36"/>
            <path class="route-progress-line" pathLength="1" d="M12 118 C88 104 110 70 174 78 S250 126 306 96 S392 34 448 52 S532 112 628 36"/>
            <circle class="route-point route-point--start" cx="12" cy="118" r="4"/>
            <circle class="route-point route-point--event" cx="306" cy="96" r="5"/>
            <circle class="route-point route-point--finish" cx="628" cy="36" r="4"/>
          </svg>
          <div class="route-labels">
            <span>${route.start}</span>
            <span>${route.event}<small>${route.correction}</small></span>
            <span>${route.finish}</span>
          </div>
        </figure>
      </div>
      <div class="stats">${stats}</div>
    </div>`;
}

function architectureMarkup() {
  const a = CONTENT.architecture;
  const groups = a.groups
    .map(
      (group, i) => `
      <article class="architecture-group" data-reveal style="--i:${i}">
        <span class="architecture-group__number">${group.number}</span>
        <div>
          <h3>${group.title}</h3>
          <p>${group.lead}</p>
          <small>${group.meta}</small>
        </div>
      </article>`
    )
    .join("");
  const rows = a.specs
    .map(
      ([k, v], i) => `
      <div class="spec-row" data-reveal style="--i:${i}">
        <dt class="spec-key">${k}</dt>
        <dd class="spec-val">${v}</dd>
      </div>`
    )
    .join("");
  return `
    <div class="section-inner section-inner--right">
      <div class="architecture-layout">
        <div class="block block--narrow" data-reveal>
          <span class="section-tag">${a.tag}</span>
          <h2 class="section-title">${lines(a.title)}</h2>
          <p class="section-body">${a.intro}</p>
        </div>
        <div class="architecture-groups">${groups}</div>
        <details class="specs-disclosure" data-reveal>
          <summary>Полная спецификация <span>07 узлов</span></summary>
          <dl class="specs">${rows}</dl>
        </details>
      </div>
    </div>`;
}

function systemsMarkup() {
  const s = CONTENT.systems;
  const tabs = s.cards
    .map(
      (c, i) => `
      <button class="system-tab${i === 0 ? " is-active" : ""}" type="button" role="tab"
        aria-selected="${i === 0 ? "true" : "false"}" data-system-tab="${i}">
        <span>${c.number}</span>${c.name}
      </button>`
    )
    .join("");
  const panels = s.cards
    .map(
      (c, i) => `
      <article class="system-panel${i === 0 ? " is-active" : ""}" role="tabpanel" data-system-panel="${i}">
        <div class="system-panel__eyebrow">Узел ${c.number} · диагностика</div>
        <h3>${c.name}</h3>
        <p>${c.desc}</p>
        <div class="system-response">
          <span><small>Риск</small>${c.risk}</span>
          <span><small>Ответ борта</small>${c.response}</span>
        </div>
      </article>`
    )
    .join("");
  return `
    <div class="section-inner section-inner--bottom">
      <div class="block-head" data-reveal>
        <span class="section-tag">${s.tag}</span>
        <h2 class="section-title">${lines(s.title)}</h2>
        <p class="section-body">${s.intro}</p>
      </div>
      <div class="systems-console" data-reveal>
        <div class="system-tabs" role="tablist" aria-label="Ключевые системы ровера">${tabs}</div>
        <div class="system-panels">${panels}</div>
      </div>
    </div>`;
}

function logMarkup() {
  const l = CONTENT.log;
  const entries = l.entries
    .map(
      (e, i) => `
      <li class="log-entry" data-reveal style="--i:${i}">
        <span class="log-time">${e.time}</span>
        <span class="log-code">${e.code}</span>
        <span class="log-text">${e.text}</span>
      </li>`
    )
    .join("");
  return `
    <div class="section-inner section-inner--center">
      <div class="block block--log" data-reveal>
        <span class="section-tag">${l.tag}</span>
        <h2 class="section-title">${lines(l.title)}</h2>
        <p class="log-note">${l.note}</p>
      </div>
      <ul class="log-entries">${entries}</ul>
      <cite class="quote-attr">${l.attr}</cite>
    </div>`;
}

function launchMarkup() {
  const l = CONTENT.launch;
  return `
    <div class="section-inner section-inner--bottom">
      <div class="block block--launch" data-reveal>
        <span class="launch-label">${l.label}</span>
        <h2 class="launch-headline">
          <span>${l.headlineLine1}</span>
          <span>${l.headlineLine2}</span>
        </h2>
        <p class="section-body launch-body">${l.body}</p>
        <div class="launch-actions">
        <a class="cta-button" id="launch-button" href="${l.repository}" target="_blank" rel="noreferrer">
          <span class="cta-text">${l.button}</span>
          <span class="cta-arrow" aria-hidden="true">→</span>
          <span class="cta-scan" aria-hidden="true"></span>
        </a>
        <button class="replay-button" id="replay-button" type="button">${l.replay}</button>
        </div>
        <a class="source-link" href="${l.repository}" target="_blank" rel="noreferrer">${l.github}<span aria-hidden="true">↗</span></a>
        <div class="launch-footer">
          <span>${l.footerLine1}</span>
          <span>${l.footerLine2}</span>
        </div>
      </div>
    </div>`;
}
