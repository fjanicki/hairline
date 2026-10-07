import * as THREE from 'three';
import { canvasTexture, rng as seeded } from '../../build.js';

// Benali's bakery window by day (Ch5): a shop interior with depth inside a flat pane, by interior
// mapping. Each pixel casts its view ray into a box behind the glass (back wall, side walls, floor,
// ceiling) and through two cut-out layers in front of the back wall: the bread racks and the glass
// display counter. One draw call, real parallax as Hugo walks past; no geometry inside the facade.

/** Back wall: cream tiles, a chalkboard, the bakehouse doorway glowing warm. */
function backTexture() {
  return canvasTexture(512, 288, (c, w, h) => {
    c.fillStyle = '#d8ccb0';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,100,70,0.25)';
    c.lineWidth = 1;
    for (let y = 0; y < h; y += 14) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let x = 0; x < w; x += 22) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(60,40,20,0.25)');
    g.addColorStop(0.6, 'rgba(60,40,20,0)');
    g.addColorStop(1, 'rgba(60,40,20,0.3)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Doorway to the bakehouse, lit from the ovens.
    const dg = c.createLinearGradient(0, 60, 0, h);
    dg.addColorStop(0, '#f2c27a');
    dg.addColorStop(1, '#b8743a');
    c.fillStyle = '#4a3828';
    c.fillRect(368, 52, 92, h - 52);
    c.fillStyle = dg;
    c.fillRect(376, 60, 76, h - 60);
    c.fillStyle = 'rgba(60,40,24,0.55)';
    c.fillRect(376, 60, 18, h - 60);
    // Chalkboard and a clock.
    c.fillStyle = '#2b2d2a';
    c.fillRect(60, 40, 220, 92);
    c.strokeStyle = '#6a5034';
    c.lineWidth = 6;
    c.strokeRect(60, 40, 220, 92);
    c.fillStyle = 'rgba(235,232,220,0.85)';
    c.font = 'italic 600 20px Georgia, serif';
    c.fillText('Pain de campagne', 76, 70);
    c.fillText('Baguette tradition', 76, 96);
    c.font = '600 16px Georgia, serif';
    c.fillText('Croissants  1,20', 76, 120);
    c.fillStyle = '#efe8d8';
    c.beginPath();
    c.arc(318, 70, 16, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(318, 70);
    c.lineTo(318, 59);
    c.moveTo(318, 70);
    c.lineTo(326, 74);
    c.stroke();
  });
}

/** Racks of bread (alpha): wooden shelves with baskets of baguettes and rows of round loaves. */
function rackTexture() {
  return canvasTexture(512, 288, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const R = seeded(23);
    const crust = ['#b77a3c', '#a86a30', '#c48a48', '#9a5e2a'];
    const shelf = (y) => {
      c.fillStyle = '#6a4a2c';
      c.fillRect(10, y, 330, 9);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(10, y + 9, 330, 4);
    };
    for (const x of [12, 336]) {
      c.fillStyle = '#5a3e24';
      c.fillRect(x - 4, 40, 8, h - 40);
    }
    // Top shelf: round loaves; middle: baguettes standing in baskets; lower: batards lying down.
    shelf(96);
    for (let i = 0; i < 7; i++) {
      c.fillStyle = crust[i % 4];
      c.beginPath();
      c.ellipse(36 + i * 44, 82, 19, 13, 0, Math.PI, 0);
      c.ellipse(36 + i * 44, 82, 19, 4, 0, 0, Math.PI);
      c.fill();
      c.strokeStyle = 'rgba(240,220,180,0.55)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(26 + i * 44, 76);
      c.lineTo(46 + i * 44, 72);
      c.stroke();
    }
    shelf(176);
    for (const bx of [40, 150, 260]) {
      for (let k = 0; k < 6; k++) {
        c.save();
        c.translate(bx + k * 9, 176);
        c.rotate((R() - 0.5) * 0.35);
        c.fillStyle = crust[(k + bx) % 4];
        c.fillRect(-4, -70 - R() * 12, 9, 72);
        c.restore();
      }
      c.fillStyle = '#8a6a3c';
      c.fillRect(bx - 10, 146, 72, 30);
      c.strokeStyle = 'rgba(60,40,20,0.5)';
      for (let y = 150; y < 176; y += 6) {
        c.beginPath();
        c.moveTo(bx - 10, y);
        c.lineTo(bx + 62, y);
        c.stroke();
      }
    }
    shelf(250);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = crust[(i + 1) % 4];
      c.beginPath();
      c.ellipse(44 + i * 50, 240, 24, 9, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
}

/** The glass display counter (alpha): a wooden base, pastries on trays behind the glass, a till. */
function counterTexture() {
  return canvasTexture(512, 288, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const top = 186;
    c.fillStyle = 'rgba(210,225,230,0.18)';
    c.fillRect(30, top, 452, 40);
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 3 ? '#c99050' : '#e0b070';
      c.beginPath();
      c.ellipse(50 + i * 36, top + 30, 13, 6, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(30, top, 452, 3);
    c.fillStyle = '#5a4430';
    c.fillRect(24, top + 40, 464, h - top - 40);
    c.fillStyle = 'rgba(255,240,210,0.12)';
    for (let x = 40; x < 480; x += 40) c.fillRect(x, top + 50, 2, h - top - 60);
    c.fillStyle = '#2a2a2c';
    c.fillRect(420, top - 30, 46, 30);
  });
}

/**
 * The interior-mapped bakery window, `w` x `h` metres, `depth` m deep. Placed like a plane on the
 * facade (+Z out). `tint` dims it to sit with the other shop windows.
 */
export function bakeryWindow(w, h, { depth = 1.1, tint = '#9a9184' } = {}) {
  const uniforms = {
    uBack: { value: backTexture() },
    uRack: { value: rackTexture() },
    uCounter: { value: counterTexture() },
    uSize: { value: new THREE.Vector3(w, h, depth) },
    uTint: { value: new THREE.Color(tint) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vCam;
      void main() {
        vPos = position;
        vCam = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uBack, uRack, uCounter;
      uniform vec3 uSize, uTint;
      varying vec3 vPos;
      varying vec3 vCam;
      void main() {
        vec3 hs = vec3( uSize.xy * 0.5, uSize.z );
        vec3 d = normalize( vPos - vCam );
        d.z = min( d.z, -1e-3 );
        // The room box: walls at x = +-hs.x, floor / ceiling at y = +-hs.y, back at z = -hs.z.
        vec3 t3 = ( vec3( sign( d.x ) * hs.x, sign( d.y ) * hs.y, -hs.z ) - vPos ) / d;
        float t = min( min( t3.x, t3.y ), t3.z );
        vec3 p = vPos + d * t;
        vec3 col;
        if ( t == t3.z ) col = texture2D( uBack, vec2( p.x / uSize.x + 0.5, p.y / uSize.y + 0.5 ) ).rgb;
        else if ( t == t3.x ) col = mix( vec3( 0.62, 0.55, 0.44 ), vec3( 0.42, 0.36, 0.28 ), -p.z / hs.z ) * ( 0.8 + 0.2 * step( 0.0, p.y ) );
        else if ( d.y < 0.0 ) {
          vec2 q = floor( vec2( p.x, p.z ) / 0.25 );
          col = mix( vec3( 0.45, 0.38, 0.3 ), vec3( 0.55, 0.48, 0.38 ), mod( q.x + q.y, 2.0 ) );
        } else col = vec3( 0.7, 0.66, 0.58 );
        col *= 1.0 - 0.35 * smoothstep( 0.2, hs.z, -p.z ); // deeper is darker
        // Cut-out layers in front of the back wall: the bread racks, then the display counter.
        float tr = ( -hs.z * 0.55 - vPos.z ) / d.z;
        if ( tr < t ) {
          vec3 r = vPos + d * tr;
          vec4 s = texture2D( uRack, vec2( r.x / uSize.x + 0.5, r.y / uSize.y + 0.5 ) );
          col = mix( col, s.rgb, s.a );
        }
        float tc = ( -hs.z * 0.18 - vPos.z ) / d.z;
        vec3 cpt = vPos + d * tc;
        vec4 cs = texture2D( uCounter, vec2( cpt.x / uSize.x + 0.5, cpt.y / uSize.y + 0.5 ) );
        col = mix( col, cs.rgb, cs.a );
        gl_FragColor = vec4( col * uTint, 1.0 );
      }`,
  });
  material.name = 'bakery-interior';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.name = 'bakery-window';
  return mesh;
}
