import * as THREE from "three";
import { ASSETS } from "../config/assets.js";

// Безвоздушное лунное небо: абсолютно чёрный купол, немерцающие звёзды,
// слабая полоса Млечного Пути и Земля правильного порядка углового размера.
// Движение есть только как очень малый оптический параллакс от зрителя —
// собственный декоративный drift и «дыхание» космоса намеренно отсутствуют.

const STAR_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (250.0 / max(1.0, -mv.z)), 1.0, 4.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = smoothstep(0.48, 0.03, d);
    float halo = smoothstep(0.48, 0.20, d) * 0.22;
    float alpha = (core * core + halo) * vAlpha;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const frac = (n) => n - Math.floor(n);

export function createSky({ isMobile = false, pixelRatio = 1 } = {}) {
  const group = new THREE.Group();
  const celestial = new THREE.Group();
  group.add(makeBlackDome());
  group.add(celestial);

  const uniforms = {
    uPixelRatio: { value: pixelRatio }
  };

  const stars = buildStars(isMobile ? 900 : 1900, 112, uniforms, {
    band: false,
    alpha: 0.86,
    sizeMin: 0.55,
    sizeMax: 2.8
  });
  celestial.add(stars);

  const milkyWay = buildStars(isMobile ? 650 : 1500, 111, uniforms, {
    band: true,
    alpha: 0.26,
    sizeMin: 0.38,
    sizeMax: 1.25
  });
  milkyWay.rotation.set(0.48, 0.18, -0.32);
  celestial.add(milkyWay);

  const earth = buildEarth(isMobile);
  celestial.add(earth);

  let rotX = 0;
  let rotY = 0;

  return {
    group,
    earth,
    update(_elapsed, mx = 0, my = 0, reducedMotion = false) {
      const tx = reducedMotion ? 0 : my * 0.012;
      const ty = reducedMotion ? 0 : mx * 0.018;
      rotX += (tx - rotX) * 0.035;
      rotY += (ty - rotY) * 0.035;
      celestial.rotation.x = rotX;
      celestial.rotation.y = rotY;
    }
  };
}

function makeBlackDome() {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(125, 32, 18),
    new THREE.MeshBasicMaterial({
      color: 0x010101,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
  );
  dome.renderOrder = -20;
  return dome;
}

function buildStars(count, radius, uniforms, options) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const white = new THREE.Color(0xf5f3ea);
  const cool = new THREE.Color(0xd7e0ed);
  const warm = new THREE.Color(0xead8bd);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const u = frac(Math.sin(i * 12.9898 + 1.31) * 43758.5453);
    const v = frac(Math.sin(i * 78.233 + 4.17) * 12543.123);
    const theta = u * Math.PI * 2;
    let phi = Math.acos(2 * v - 1);

    if (options.band) {
      phi = Math.PI / 2 + (phi - Math.PI / 2) * 0.105;
    }

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;

    const luminance = frac(Math.sin(i * 3.17 + 7.0) * 9999.0);
    sizes[i] = options.sizeMin + Math.pow(luminance, 4.2) * (options.sizeMax - options.sizeMin);
    alphas[i] = options.alpha * (0.3 + Math.pow(luminance, 1.7) * 0.7);

    const temperature = frac(Math.sin(i * 1.37 + 2.0) * 555.5);
    if (temperature > 0.92) color.copy(warm);
    else if (temperature > 0.68) color.copy(cool);
    else color.copy(white);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: false
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function buildEarth(isMobile) {
  const group = new THREE.Group();
  const radius = isMobile ? 1.45 : 1.85;
  const map = new THREE.TextureLoader().load(ASSETS.textures.earth);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      emissive: 0xffffff,
      emissiveMap: map,
      emissiveIntensity: 0.1,
      fog: false
    })
  );
  surface.rotation.y = -1.15;
  group.add(surface);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.07, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x7eb6dd) } },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main() {
          float fresnel = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewW)), 0.0), 4.5);
          gl_FragColor = vec4(uColor, fresnel * 0.22);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      fog: false
    })
  );
  group.add(atmosphere);

  group.position.set(52, 34, -88);
  return group;
}
