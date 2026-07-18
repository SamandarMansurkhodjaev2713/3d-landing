import * as THREE from "three";

const POINT_VERTEX = `
  uniform float uPlane;
  uniform float uPixelRatio;
  uniform float uPointScale;
  varying float vWorldX;
  varying float vViewDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vWorldX = world.x;
    vViewDepth = -mv.z;
    gl_PointSize = clamp(uPointScale * uPixelRatio * (260.0 / max(1.0, -mv.z)), 1.0, 3.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAGMENT = `
  precision highp float;
  uniform float uPlane;
  uniform float uOpacity;
  uniform float uShell;
  uniform vec3 uColor;
  varying float vWorldX;
  varying float vViewDepth;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float disc = 1.0 - smoothstep(0.18, 0.5, length(p));
    float distanceToScan = abs(vWorldX - uPlane);
    float scanBand = exp(-distanceToScan * 10.5);
    float unreconstructed = smoothstep(uPlane - 0.08, uPlane + 0.18, vWorldX);
    float alpha = disc * uOpacity * max(scanBand, unreconstructed * uShell);
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(uColor * (0.82 + scanBand * 0.45), alpha);
  }
`;

const _rootWorld = new THREE.Vector3();
const _sample = new THREE.Vector3();

export function createArchiveReconstruction(
  root,
  { isMobile = false, pixelRatio = 1, color = 0xa9d7e5 } = {}
) {
  root.updateWorldMatrix(true, true);

  const bounds = new THREE.Box3().setFromObject(root);
  const minX = bounds.min.x;
  const maxX = bounds.max.x;
  const span = Math.max(0.001, maxX - minX);
  const maxPoints = isMobile ? 6200 : 14500;
  const positions = sampleSurface(root, maxPoints);

  const pointUniforms = {
    uPlane: { value: minX },
    uOpacity: { value: 0 },
    uShell: { value: 0.28 },
    uColor: { value: new THREE.Color(color) },
    uPixelRatio: { value: pixelRatio },
    uPointScale: { value: isMobile ? 1.35 : 1.58 }
  };

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: pointUniforms,
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false
  });

  const points = new THREE.Points(geometry, material);
  points.name = "archive-reconstruction";
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 8;
  root.add(points);

  const revealUniforms = {
    active: { value: 0 },
    plane: { value: minX },
    feather: { value: 0.08 }
  };
  installMaterialReveal(root, points, revealUniforms);

  function worldPlane(progress) {
    root.getWorldPosition(_rootWorld);
    return _rootWorld.x + minX - 0.16 + span * 1.08 * progress;
  }

  function setIntro(progress, opacity = 1) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const plane = worldPlane(p);
    revealUniforms.active.value = 1;
    revealUniforms.plane.value = plane;
    pointUniforms.uPlane.value = plane;
    pointUniforms.uOpacity.value = opacity;
    pointUniforms.uShell.value = 0.28;
    points.visible = opacity > 0.002;
  }

  function setInspection(progress, intensity = 0) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const opacity = THREE.MathUtils.clamp(intensity, 0, 1);
    const plane = worldPlane(p);
    revealUniforms.active.value = 0;
    revealUniforms.plane.value = plane;
    pointUniforms.uPlane.value = plane;
    pointUniforms.uOpacity.value = opacity;
    pointUniforms.uShell.value = 0.015;
    points.visible = opacity > 0.002;
  }

  function finish() {
    revealUniforms.active.value = 0;
    pointUniforms.uOpacity.value = 0;
    points.visible = false;
  }

  return {
    points,
    setIntro,
    setInspection,
    finish,
    setPixelRatio(value) {
      pointUniforms.uPixelRatio.value = value;
    }
  };
}

function sampleSurface(root, maxPoints) {
  const meshes = [];
  let total = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    object.updateMatrix();
    meshes.push(object);
    total += object.geometry.attributes.position.count;
  });

  const stride = Math.max(1, Math.ceil(total / maxPoints));
  const result = [];
  let cursor = 0;

  for (const mesh of meshes) {
    const attribute = mesh.geometry.attributes.position;
    for (let i = 0; i < attribute.count; i++, cursor++) {
      if (cursor % stride !== 0) continue;
      _sample.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrix);
      result.push(_sample.x, _sample.y, _sample.z);
      if (result.length / 3 >= maxPoints) return result;
    }
  }

  return result;
}

function installMaterialReveal(root, points, uniforms) {
  const materialCache = new Map();

  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh === points) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => revealMaterial(material, materialCache, uniforms));
    } else {
      mesh.material = revealMaterial(mesh.material, materialCache, uniforms);
    }
  });
}

function revealMaterial(material, cache, uniforms) {
  if (!material || material.isShaderMaterial) return material;
  if (cache.has(material)) return cache.get(material);

  const clone = material.clone();
  const previousCompile = clone.onBeforeCompile;
  const previousCacheKey = clone.customProgramCacheKey?.bind(clone);

  clone.onBeforeCompile = (shader, renderer) => {
    if (previousCompile) previousCompile(shader, renderer);
    shader.uniforms.uArchiveActive = uniforms.active;
    shader.uniforms.uArchivePlane = uniforms.plane;
    shader.uniforms.uArchiveFeather = uniforms.feather;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vArchiveWorldX;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvArchiveWorldX = (modelMatrix * vec4(transformed, 1.0)).x;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vArchiveWorldX;\nuniform float uArchiveActive;\nuniform float uArchivePlane;\nuniform float uArchiveFeather;"
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (uArchiveActive > 0.5) {
          float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          float threshold = uArchivePlane + (grain - 0.5) * uArchiveFeather;
          if (vArchiveWorldX > threshold) discard;
        }`
      );
  };
  clone.customProgramCacheKey = () =>
    `${previousCacheKey ? previousCacheKey() : clone.type}-archive-reveal-v1`;
  clone.needsUpdate = true;
  cache.set(material, clone);
  return clone;
}
