import * as THREE from "three";

// Видимый солнечный диск на том же векторе, что и DirectionalLight.
// Размер соответствует порядку реального углового диаметра Солнца (~0,53°);
// мягкий внешний край — оптика камеры/bloom, а не атмосферное гало.

const SUN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;

  void main() {
    float r = length(vUv - 0.5);
    float disc = 1.0 - smoothstep(0.405, 0.438, r);
    float opticalEdge = (1.0 - smoothstep(0.44, 0.69, r)) * 0.13;
    float alpha = (disc + opticalEdge) * uIntensity;
    if (alpha < 0.004) discard;
    vec3 color = mix(uColor, vec3(1.0), disc * 0.82);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createSunBody({ sunPosition, color } = {}) {
  const uniforms = {
    uColor: { value: color ? color.clone() : new THREE.Color(1.0, 0.95, 0.86) },
    uIntensity: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08), material);
  mesh.position.copy(sunPosition.clone().normalize().multiplyScalar(104));
  mesh.renderOrder = -4;
  mesh.frustumCulled = false;

  return {
    mesh,
    setIntensity(value) {
      uniforms.uIntensity.value = value;
    },
    update(camera) {
      mesh.quaternion.copy(camera.quaternion);
    }
  };
}
