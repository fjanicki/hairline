import * as THREE from 'three';

/** Gradient sky sphere that follows the camera. Colours are set by Mood every frame. */
export class Sky {
  constructor(radius = 400) {
    this.uniforms = {
      uTop: { value: new THREE.Color(0x3a4150) },
      uBottom: { value: new THREE.Color(0x6e7378) },
      uOffset: { value: 0.0 },
      uExponent: { value: 0.7 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uBottom;
        uniform float uOffset, uExponent;
        varying vec3 vDir;
        void main() {
          float h = max(vDir.y + uOffset, 0.0);
          gl_FragColor = vec4(mix(uBottom, uTop, pow(h, uExponent)), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.userData.noDispose = true;
  }

  set(top, bottom) {
    this.uniforms.uTop.value.copy(top);
    this.uniforms.uBottom.value.copy(bottom);
  }

  follow(camera) {
    this.mesh.position.copy(camera.position);
  }
}
