import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { cappedRatio, clamp01, createAdaptiveRatio, easeInOutCubic } from "./landingMath";

const FOV = 53.4;
const CAMERA_Z = 41.18;
/* half the frame's height on the plane the screens stand in */
const HALF_HEIGHT = Math.tan(((FOV / 2) * Math.PI) / 180) * CAMERA_Z;
const CARD_ASPECT = 1.6;
const CARD_ASPECT_PHONE = 0.78;
/* the strip at the foot of each screen that carries its open button */
const BUTTON_BAND = 0.14;

const smoothstep = (from, to, value) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* the round "open" arrow at the screen's bottom right corner, drawn once */
function drawOpenButton(aspect) {
  const cardHeight = 1280 / aspect;
  const height = Math.round(cardHeight * BUTTON_BAND);
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const right = cardHeight * 0.049;
  const bottom = cardHeight * 0.0245;
  const radius = cardHeight * 0.0307;
  const x = 1280 - right - radius;
  const y = height - bottom - radius;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#121212";
  ctx.fill();
  const arm = radius * 0.4;
  ctx.strokeStyle = "#F1F0EC";
  ctx.lineWidth = radius * 0.12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x + arm * 0.15, y - arm * 0.85);
  ctx.lineTo(x + arm, y);
  ctx.lineTo(x + arm * 0.15, y + arm * 0.85);
  ctx.stroke();
  return canvas;
}

/* each screen shows its page's top, rests, glides down it, rests, and glides back: a 17s loop */
function pageGlide(seconds) {
  const t = ((seconds % 17) + 17) % 17;
  if (t < 3) return 0;
  if (t < 12) return easeInOutCubic((t - 3) / 9);
  if (t < 13.5) return 1;
  return 1 - easeInOutCubic((t - 13.5) / 3.5);
}

const surfaceChunk = /* glsl */ `
  #define PI 3.141592653589793
  uniform float uW;     // half the frame's width where the screens stand
  uniform float uD;     // how deep the S goes (negative: a bump towards you)
  uniform float uT;     // how tight it is
  uniform float uShift; // where it sits across the frame
  uniform float uC;     // 1 = the S, 0 = a plain bump
  uniform float uP;     // how much of all this is on
  uniform float uV;     // speed, 0 to 1
  uniform float uA;     // the lean: left towards you, right away
  uniform float uRise;  // how much the left side lifts at speed
  uniform float uWring; // how much the sides twist at speed
  float prof(float q, float g) { return mix((1.0 - q * q) * g, sin(PI * q) * g, uC); }
  float slope(float q, float g) {
    return mix(-2.0 * q * (2.0 - q * q) * g, (PI * cos(PI * q) - 2.0 * q * sin(PI * q)) * g, uC);
  }
  float lean(float s) { float r = clamp(s, -1.0, 1.0); return uA * (1.5 * r - 0.5 * r * r * r); }
`;

const cardVertex = /* glsl */ `
  ${surfaceChunk}
  uniform float uHover;
  uniform float uCardH;
  uniform float uLift;
  varying vec2 vUv;
  varying vec2 vFlat;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec2 c = uv * 2.0 - 1.0;
    // a hovered screen gives a little in the middle while its edges stay put
    p.z -= uHover * 0.1 * uCardH * (1.0 - c.x * c.x) * (1.0 - c.y * c.y);
    vec4 w = modelMatrix * vec4(p, 1.0);
    vFlat = w.xy;
    float s = w.x / uW;
    float q = uT * s + uShift;
    float g = exp(-q * q);
    // banked into the S at rest; at speed the sides twist, each its own way
    float a = -0.16 * slope(q, g) / PI * uC * uP
      + 1.8 * uV * uWring * smoothstep(0.3, 0.9, abs(s)) * sign(s) * uP;
    float ca = cos(a);
    float sa = sin(a);
    w.yz = vec2(w.y * ca - w.z * sa, w.y * sa + w.z * ca);
    w.z -= uD * prof(q, g) * uP;
    // a slight rise to the right
    w.y += 0.03 * w.x * uP;
    // at speed the left side lifts and comes towards you
    float m = (1.0 - smoothstep(-1.0, 0.3, s)) * uRise * uV * uP;
    w.y += 0.1 * uW * m;
    w.z += 0.2 * uW * m;
    w.z += lean(s) * uP + uLift;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const cardFragment = /* glsl */ `
  ${surfaceChunk}
  uniform sampler2D uMap;
  uniform sampler2D uLabel;
  uniform float uLoaded;
  uniform float uWin;
  uniform float uScroll;
  uniform float uHover;
  uniform float uCardW;
  uniform float uCardH;
  uniform float uRadius;
  uniform float uFade;
  uniform float uGloss;
  uniform vec3 uCam;
  varying vec2 vUv;
  varying vec2 vFlat;
  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    // a screen-shaped window onto the page, gliding down it
    float v = 1.0 - uScroll * (1.0 - uWin) - (1.0 - vUv.y) * uWin;
    vec3 col = mix(vec3(0.06), texture2D(uMap, vec2(vUv.x, v)).rgb, uLoaded);

    // the surface worked out exactly rather than from the mesh, so light and haze follow the true curve
    float s = vFlat.x / uW;
    float q = uT * s + uShift;
    float g = exp(-q * q);
    float pr = prof(q, g);
    float sl = slope(q, g);
    vec2 c = vUv * 2.0 - 1.0;
    float dome = (1.0 - c.x * c.x) * (1.0 - c.y * c.y);

    // haze: the further back in the S, the more it sinks into the dark
    float zs = -uD * pr;
    float depth = clamp(0.5 - 0.5 * zs / max(abs(uD), 1e-4), 0.0, 1.0) * uP;
    depth += uHover * 0.1 * uCardH * dome / (2.0 * max(abs(uD), 1e-4));
    float haze = 0.8 * clamp(depth, 0.0, 1.0);
    col = mix(col, vec3(0.059), haze);

    // light from up and to the left: a soft fall-off and a small, tight glint along the bend
    float ax = min(abs(s), 1.0);
    float dzdx = -uD * sl * uT / uW + uA / uW * 1.5 * (1.0 - ax * ax);
    dzdx += 0.4 * uHover * uCardH * c.x * (1.0 - c.y * c.y) / uCardW;
    float dzdy = 0.4 * uHover * c.y * (1.0 - c.x * c.x);
    vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));
    float a = -0.16 * sl / PI * uC * uP;
    float ca = cos(a);
    float sa = sin(a);
    n.yz = vec2(n.y * ca - n.z * sa, n.y * sa + n.z * ca);
    vec3 at = vec3(vFlat, (zs + lean(s)) * uP - 0.1 * uHover * uCardH * dome);
    vec3 eye = normalize(uCam - at);
    vec3 L = normalize(vec3(-0.4, 0.5, 1.0));
    col *= 1.0 - 0.12 * (1.0 - (dot(n, L) * 0.5 + 0.5));
    col += pow(max(dot(n, normalize(L + eye)), 0.0), 48.0) * uGloss;

    // the open button at the foot; the page itself stays as bright as it is
    if (vUv.y < ${BUTTON_BAND.toFixed(3)}) {
      vec4 lab = texture2D(uLabel, vec2(vUv.x, vUv.y / ${BUTTON_BAND.toFixed(3)}));
      col = mix(col, mix(lab.rgb, vec3(0.059), haze), lab.a);
    }

    // rounded corners, smoothed by however big a pixel is here
    vec2 pp = (vUv - 0.5) * vec2(uCardW / uCardH, 1.0);
    float d = box(pp, vec2(uCardW / uCardH * 0.5, 0.5), uRadius);
    float aa = fwidth(d);
    gl_FragColor = vec4(col, (1.0 - smoothstep(-aa, aa, d)) * uFade);
  }
`;

const floorVertex = /* glsl */ `
  ${surfaceChunk}
  uniform float uRun;
  varying vec3 vWorld;
  varying float vFar;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vFar = -w.z / uRun;
    // the floor leans with the screens, so they stand on it
    w.z += lean(w.x / uW) * uP;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const floorFragment = /* glsl */ `
  uniform float uCell;
  uniform float uGlow;
  uniform float uLampX;
  uniform float uWet;
  uniform sampler2D uRefl;
  uniform mat4 uMirror;
  varying vec3 vWorld;
  varying float vFar;
  void main() {
    // a fine square grid, barely there, fading off into the dark
    vec2 gp = vWorld.xz / uCell;
    vec2 f = abs(fract(gp) - 0.5);
    vec2 l = 1.0 - smoothstep(vec2(0.0), 1.5 * fwidth(gp), f);
    float line = max(l.x, l.y);
    float fade = 1.0 - smoothstep(0.2, 0.95, vFar);
    vec3 col = vec3(0.08 * line * fade);
    // the screens above, caught in the lines like light on a wet floor
    if (uWet > 0.5) {
      vec3 p = vWorld;
      p.x -= (p.x - uLampX) * 0.35 * abs(vFar);
      vec4 m = uMirror * vec4(p, 1.0);
      vec2 uv = m.xy / m.w * 0.5 + 0.5;
      vec2 e = smoothstep(0.0, 0.1, uv) * smoothstep(0.0, 0.1, 1.0 - uv);
      float fall = vFar > 0.0 ? exp(-6.0 * vFar) : exp(2.2 * vFar);
      col += texture2D(uRefl, uv).rgb * line * 0.5 * fall * e.x * e.y * fade;
    }
    gl_FragColor = vec4(col, uGlow * fade);
  }
`;

function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

/*
  A row of project screens standing on a dark grid floor, bent into an S, carried along by the
  page scroll (and by dragging), each one gliding down its own page. Returns null without WebGL.
  onChange(index, hovering) reports the screen in the middle (or under the pointer); onOpen(index)
  fires when a screen is clicked.
*/
export function createWorkRoom({ host, section, items, onChange, onOpen }) {
  const count = items.length;
  if (!host || !count) return null;
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cardAspect = mobile ? CARD_ASPECT_PHONE : CARD_ASPECT;
  const sectionEl = section || host.closest("section");

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.5, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(cappedRatio(mobile ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y";
  canvas.dataset.cursorLive = "";
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 2000);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  /* the wet floor: a second camera, below the floor, sees only the screens */
  const reflect = !mobile;
  const mirrorCamera = new PerspectiveCamera(FOV, 1, 0.1, 2000);
  mirrorCamera.layers.set(1);
  const reflection = new WebGLRenderTarget(16, 16, { depthBuffer: false });

  const shared = {
    uW: { value: 1 },
    uD: { value: 1 },
    uT: { value: 1.15 },
    uShift: { value: mobile ? 0 : -0.2 },
    uC: { value: mobile ? 0 : 1 },
    uP: { value: 1 },
    uV: { value: 0 },
    uA: { value: 0 },
    uRise: { value: mobile ? 0 : 1 },
    uWring: { value: mobile ? 0 : 1 },
    uGloss: { value: mobile ? 0.1 : 0.35 },
    uLift: { value: 0 },
    uFade: { value: reduced ? 1 : 0 },
    uCardW: { value: 1 },
    uCardH: { value: 1 },
    uRadius: { value: 0.05 },
    uCam: { value: camera.position },
  };

  const cardGeometry = new PlaneGeometry(1, 1, 24, 24);
  const cards = items.map((item, index) => {
    const material = new ShaderMaterial({
      vertexShader: cardVertex,
      fragmentShader: cardFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        ...shared,
        uMap: { value: null },
        uLabel: { value: null },
        uLoaded: { value: 0 },
        uWin: { value: 1 },
        uScroll: { value: 0 },
        uHover: { value: 0 },
      },
    });
    const mesh = new Mesh(cardGeometry, material);
    mesh.frustumCulled = false;
    mesh.layers.enable(1);
    mesh.visible = false;
    scene.add(mesh);
    return { index, mesh, material, hover: 0, rel: 0 };
  });

  const floorGeometry = new PlaneGeometry(1, 1, 48, 24);
  floorGeometry.rotateX(-Math.PI / 2);
  const mirrorMatrix = new Matrix4();
  const floorMaterial = new ShaderMaterial({
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      ...shared,
      uRun: { value: 1 },
      uCell: { value: 1 },
      uGlow: { value: reduced ? 0.9 : 0 },
      uLampX: { value: 0 },
      uWet: { value: reflect ? 1 : 0 },
      uRefl: { value: reflection.texture },
      uMirror: { value: mirrorMatrix },
    },
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.renderOrder = -1;
  floor.frustumCulled = false;
  scene.add(floor);

  let width = 1;
  let height = 1;
  let halfWidth = 1;
  let cardWidthPx = 1;
  let cardHeightPx = 1;
  let stepPx = 1;
  let cardWidth = 1;
  let cardHeight = 1;
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    mirrorCamera.aspect = aspect;
    mirrorCamera.updateProjectionMatrix();
    halfWidth = HALF_HEIGHT * aspect;
    const unit = Math.min(20, Math.max(5, width / 150));
    let radiusPx;
    if (mobile) {
      cardWidthPx = width * 0.84;
      cardHeightPx = cardWidthPx / cardAspect;
      if (cardHeightPx > height * 0.56) {
        cardHeightPx = height * 0.56;
        cardWidthPx = cardHeightPx * cardAspect;
      }
      stepPx = cardWidthPx + width * 0.025;
      radiusPx = 14;
    } else {
      cardHeightPx = Math.min(0.435 * height, 55 * unit);
      cardWidthPx = cardHeightPx * CARD_ASPECT;
      stepPx = cardWidthPx + unit;
      radiusPx = 2 * unit;
    }
    const toWorld = (2 * HALF_HEIGHT) / height;
    cardWidth = cardWidthPx * toWorld;
    cardHeight = cardHeightPx * toWorld;
    cards.forEach((card) => card.mesh.scale.set(cardWidth, cardHeight, 1));
    shared.uW.value = halfWidth;
    shared.uA.value = mobile ? 0 : -0.12 * halfWidth;
    shared.uCardW.value = cardWidth;
    shared.uCardH.value = cardHeight;
    shared.uRadius.value = radiusPx / cardHeightPx;

    const floorY = -cardHeight / 2 - 0.06 * HALF_HEIGHT;
    const run = 6 * HALF_HEIGHT;
    const near = Math.min(CAMERA_Z * (1 - Math.abs(floorY) / HALF_HEIGHT) + 0.2 * HALF_HEIGHT, 0.8 * CAMERA_Z);
    floor.scale.set(8 * halfWidth, 1, near + run);
    floor.position.set(0, floorY, (near - run) / 2);
    floorMaterial.uniforms.uRun.value = run;
    floorMaterial.uniforms.uCell.value = 0.22 * HALF_HEIGHT;
    floorMaterial.uniforms.uLampX.value = -0.6 * halfWidth;
    const mirrorY = floorY - 0.07 * HALF_HEIGHT;
    mirrorCamera.position.set(0, 2 * mirrorY, CAMERA_Z);
    mirrorCamera.updateMatrixWorld();
    mirrorMatrix.multiplyMatrices(mirrorCamera.projectionMatrix, mirrorCamera.matrixWorldInverse);
    const ratio = renderer.getPixelRatio();
    reflection.setSize(Math.max(1, Math.round(width * ratio * 0.1)), Math.max(1, Math.round(height * ratio * 0.1)));
    wake();
  };

  /* page textures: fetched near the middle, uploaded one per frame, the farthest let go on small devices */
  const labelTexture = new CanvasTexture(drawOpenButton(cardAspect));
  labelTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures = new Map();
  const loading = new Set();
  const ready = [];
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const light = lowEnd || mobile;
  const keep = light ? 8 : count;
  const bind = (card) => {
    const entry = textures.get(card.index);
    card.material.uniforms.uMap.value = entry?.texture ?? null;
    card.material.uniforms.uWin.value = entry?.win ?? 1;
    card.material.uniforms.uLoaded.value = entry ? 1 : 0;
    card.material.uniforms.uLabel.value = labelTexture;
  };
  const request = (index) => {
    if (textures.has(index) || loading.has(index)) return;
    loading.add(index);
    const src = light ? items[index].tallSmall : items[index].tall;
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${src}`);
        return response.blob();
      })
      .then(async (blob) => {
        let source;
        let flipped = true;
        try {
          source = await createImageBitmap(blob, { imageOrientation: "flipY" });
          flipped = false;
        } catch {
          source = await decodeImage(blob);
        }
        if (disposed) {
          source.close?.();
          return;
        }
        const texture = new Texture(source);
        texture.flipY = flipped;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (light) {
          texture.generateMipmaps = false;
          texture.minFilter = LinearFilter;
        }
        texture.needsUpdate = true;
        ready.push({ index, texture, win: Math.min(1, source.width / cardAspect / source.height) });
        wake();
        if (!idleHandle && !running) idleHandle = idle(drain);
      })
      .catch(() => loading.delete(index));
  };
  const uploadOne = () => {
    const next = ready.shift();
    if (!next) return;
    renderer.initTexture(next.texture);
    textures.set(next.index, { texture: next.texture, win: next.win });
    loading.delete(next.index);
    bind(cards[next.index]);
    while (textures.size > keep) {
      let farthest = -1;
      let distance = 2.5;
      textures.forEach((_, index) => {
        const d = Math.abs(cards[index].rel);
        if (d > distance) {
          distance = d;
          farthest = index;
        }
      });
      if (farthest < 0) break;
      textures.get(farthest).texture.dispose();
      textures.delete(farthest);
      bind(cards[farthest]);
    }
  };

  const sectionProgress = () => {
    if (!sectionEl) return 0;
    const rect = sectionEl.getBoundingClientRect();
    const range = Math.max(1, sectionEl.offsetHeight - window.innerHeight);
    return clamp01(-rect.top / range);
  };

  /* one notch of a mouse wheel carries on a little; trackpads and smooth scrolling stay one to one */
  let lastWheelAt = -1e9;
  let lastBurstAt = -1e9;
  let notched = false;
  const onWheel = (event) => {
    const t = event.timeStamp;
    const gap = t - lastWheelAt;
    if (gap < 30) lastBurstAt = t;
    const px = Math.abs(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1));
    notched = px >= 40 && gap >= 30 && t - lastBurstAt >= 500;
    lastWheelAt = t;
    wake();
  };

  let speed = 0;
  const point = new Vector3();
  /* where a point on a flat screen ends up on the page, following the same bend as the vertex shader */
  const project = (x, y) => {
    const s = x / halfWidth;
    const bend = shared.uC.value;
    const q = shared.uT.value * s + shared.uShift.value;
    const g = Math.exp(-q * q);
    const sinQ = Math.sin(Math.PI * q);
    const profile = bend * sinQ * g + (1 - bend) * (1 - q * q) * g;
    const slope = bend * (Math.PI * Math.cos(Math.PI * q) - 2 * q * sinQ) * g + (1 - bend) * -2 * q * (2 - q * q) * g;
    const angle = ((-0.16 * slope) / Math.PI) * bend + 1.8 * speed * shared.uWring.value * smoothstep(0.3, 0.9, Math.abs(s)) * Math.sign(s);
    let py = y * Math.cos(angle);
    let pz = y * Math.sin(angle) - shared.uD.value * profile;
    py += 0.03 * x;
    const rise = (1 - smoothstep(-1, 0.3, s)) * shared.uRise.value * speed;
    py += 0.1 * halfWidth * rise;
    pz += 0.2 * halfWidth * rise;
    const r = Math.max(-1, Math.min(1, s));
    pz += shared.uA.value * (1.5 * r - 0.5 * r * r * r) + shared.uLift.value;
    point.set(x, py, pz).project(camera);
    return [(point.x * 0.5 + 0.5) * width, (-point.y * 0.5 + 0.5) * height];
  };
  const side = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const inTriangle = (p, a, b, c) => {
    const d1 = side(p, a, b);
    const d2 = side(p, b, c);
    const d3 = side(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  /* the screen under a point, nearest the middle first */
  const pick = (x, y) => {
    const p = [x, y];
    let found = -1;
    let best = Infinity;
    for (const card of cards) {
      if (!card.mesh.visible || Math.abs(card.rel) >= best) continue;
      const centre = card.mesh.position.x;
      let prevTop = null;
      let prevBottom = null;
      for (let i = 0; i <= 12; i++) {
        const cx = centre - cardWidth / 2 + (cardWidth * i) / 12;
        const top = project(cx, cardHeight / 2);
        const bottom = project(cx, -cardHeight / 2);
        if (prevTop && prevBottom && (inTriangle(p, prevTop, top, bottom) || inTriangle(p, prevTop, bottom, prevBottom))) {
          found = card.index;
          best = Math.abs(card.rel);
          break;
        }
        prevTop = top;
        prevBottom = bottom;
      }
    }
    return found;
  };

  const idle = window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 120));
  const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
  let idleHandle = 0;
  const drain = () => {
    idleHandle = 0;
    if (disposed) return;
    if (ready.length && !running) uploadOne();
    if (ready.length || loading.size) idleHandle = idle(drain);
  };

  let raf = 0;
  let idleTimer = 0;
  let disposed = false;
  let running = false;
  let visible = false;
  let first = true;
  let lastNow = performance.now();
  let enteredAt = 0;
  let current = 0;
  let base = 0;
  let pending = 0;
  let dragOffset = 0;
  let lastTarget = 0;
  let shownIndex = -1;
  let shownHovering = false;
  let hovered = -1;
  let pointerX = -1;
  let pointerY = -1;
  let mouseInside = false;
  let pressed = false;
  let dragging = false;
  let pressX = 0;
  let pressY = 0;
  let lastX = 0;
  let lastDelta = 0;
  let lastMoveAt = 0;
  let cursorHover = "";
  const resolution = createAdaptiveRatio({
    start: renderer.getPixelRatio(),
    floor: Math.min(renderer.getPixelRatio(), mobile ? 1 : 1.25),
    onChange: (ratio) => {
      renderer.setPixelRatio(ratio);
      resize();
    },
  });

  const frame = (now) => {
    raf = 0;
    if (document.body.classList.contains("modal-open")) {
      running = false;
      return;
    }
    uploadOne();
    const ms = Math.min(50, Math.max(0, now - lastNow));
    lastNow = now;
    const frames = ms / (1000 / 60);
    const dt = ms / 1000;

    const scrollTarget = sectionProgress() * (count - 1);
    const delta = scrollTarget - lastTarget;
    lastTarget = scrollTarget;
    if (first || reduced) {
      base = scrollTarget;
      pending = 0;
    } else if (delta !== 0) {
      if (notched) pending += delta;
      else base += delta;
      notched = false;
    }
    if (pending !== 0) {
      const step = pending * (1 - Math.pow(0.78, Math.min(frames, 4)));
      base += step;
      pending -= step;
      if (Math.abs(pending * stepPx) < 0.05) {
        base += pending;
        pending = 0;
      }
    }
    const target = base + dragOffset;
    const perScreen = width / stepPx;
    if (first || reduced) current = target;
    else current += perScreen * Math.tanh((target - current) / perScreen) * 0.1 * Math.min(frames, 2);
    if (Math.abs(target - current) * stepPx < 0.01) current = target;
    first = false;

    const lagPx = perScreen * Math.tanh((target - current) / perScreen) * stepPx;
    const rush = Math.tanh(lagPx / (mobile ? 245 : 550));
    speed = reduced ? 0 : Math.min(1, rush * rush);
    shared.uV.value = speed;
    shared.uD.value = (mobile ? -1 : 1) * 0.2 * halfWidth * (1 + 1.1 * speed);

    /* the screens rise into place and the floor lights up the first time the room comes into view */
    if (!enteredAt && !reduced && host.getBoundingClientRect().top < height * 0.7) enteredAt = now;
    let entering = false;
    if (enteredAt) {
      const s = (now - enteredAt) / 1000;
      shared.uLift.value = 0.7 * HALF_HEIGHT * (1 - expoOut(s / 1.25));
      shared.uFade.value = 1 - Math.pow(1 - clamp01(s / 0.7), 2);
      floorMaterial.uniforms.uGlow.value = 0.9 * (1 - Math.pow(1 - clamp01((s - 0.15) / 1.1), 2));
      entering = s < 1.4;
    } else if (!reduced) {
      shared.uLift.value = 0.7 * HALF_HEIGHT;
    }

    let nearest = 0;
    let nearestDistance = Infinity;
    for (const card of cards) {
      let rel = card.index - current;
      rel = ((((rel + count / 2) % count) + count) % count) - count / 2;
      card.rel = rel;
      const centrePx = width / 2 + rel * stepPx;
      const leftPx = centrePx - cardWidthPx / 2;
      const onScreen = leftPx < 1.5 * width && leftPx + cardWidthPx > -0.5 * width;
      card.mesh.visible = onScreen;
      if (onScreen) card.mesh.position.set((centrePx / width) * 2 * halfWidth - halfWidth, 0, 0);
      if (Math.abs(rel) < nearestDistance) {
        nearestDistance = Math.abs(rel);
        nearest = card.index;
      }
      if (Math.abs(rel) < 3) request(card.index);
      if (onScreen && !card.material.uniforms.uLabel.value) bind(card);
    }

    hovered = mouseInside && !pressed && speed < 0.05 ? pick(pointerX, pointerY) : -1;
    let hoverMoving = false;
    let gliding = false;
    for (const card of cards) {
      const goal = card.index === hovered ? 1 : 0;
      card.hover += (goal - card.hover) * (1 - Math.exp(-dt * 13.9));
      if (Math.abs(goal - card.hover) > 0.002) hoverMoving = true;
      else card.hover = goal;
      card.material.uniforms.uHover.value = card.hover;
      if (!reduced && card.mesh.visible && card.material.uniforms.uWin.value < 0.999) {
        card.material.uniforms.uScroll.value = pageGlide(now / 1000 + card.index * 5.3);
        gliding = true;
      }
    }
    const shown = hovered >= 0 ? hovered : nearest;
    if (shown !== shownIndex || hovered >= 0 !== shownHovering) {
      shownIndex = shown;
      shownHovering = hovered >= 0;
      onChange?.(shown, shownHovering);
    }
    const nextCursor = hovered >= 0 ? "true" : "false";
    if (nextCursor !== cursorHover) canvas.dataset.cursorHover = cursorHover = nextCursor;
    canvas.style.cursor = dragging ? "grabbing" : hovered >= 0 ? "pointer" : "grab";

    if (reflect) {
      renderer.setRenderTarget(reflection);
      renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(null);
    }
    renderer.render(scene, camera);

    const busy = ready.length > 0 || target !== current || pending !== 0 || speed > 5e-4 || hoverMoving || entering;
    if (busy) resolution.sample(ms);
    if (!visible || !(busy || gliding)) {
      running = false;
      return;
    }
    if (!busy) {
      /* only the pages are gliding: a calmer frame rate is plenty */
      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        raf = requestAnimationFrame(frame);
      }, 30);
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  function wake() {
    if (idleTimer && visible) {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      running = false;
    }
    if (running || !visible || disposed) return;
    running = true;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const trackPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    pressed = true;
    dragging = false;
    pressX = lastX = event.clientX;
    pressY = event.clientY;
    lastDelta = 0;
    trackPointer(event);
    wake();
  };
  const onPointerMove = (event) => {
    trackPointer(event);
    mouseInside = event.pointerType === "mouse";
    if (pressed) {
      if (dragging) {
        const moved = (lastX - event.clientX) * 1.5;
        lastX = event.clientX;
        dragOffset += moved / stepPx;
        lastDelta = moved;
        lastMoveAt = performance.now();
      } else {
        const dx = event.clientX - pressX;
        const dy = event.clientY - pressY;
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          dragging = true;
          lastX = event.clientX;
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch {
            /* capture is a nicety; dragging still works without it */
          }
        } else if (Math.abs(dy) > 10) {
          pressed = false;
        }
      }
    }
    wake();
  };
  const onPointerUp = (event) => {
    if (!pressed) return;
    pressed = false;
    if (dragging) {
      /* a quick release flings the row on */
      if (performance.now() - lastMoveAt < 100) dragOffset += (lastDelta * 12) / stepPx;
    } else if (onOpen) {
      trackPointer(event);
      const index = pick(pointerX, pointerY);
      if (index >= 0) onOpen(index);
    }
    dragging = false;
    wake();
  };
  const onPointerCancel = () => {
    pressed = false;
    dragging = false;
  };
  const onPointerLeave = () => {
    mouseInside = false;
    wake();
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("wheel", onWheel, { passive: true });
  const onScroll = () => wake();
  window.addEventListener("scroll", onScroll, { passive: true });
  const modalWatch = new MutationObserver(() => wake());
  modalWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const resizer = new ResizeObserver(resize);
  resizer.observe(host);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  });
  visibility.observe(host);

  idle(() => {
    if (disposed) return;
    cards.forEach((card, index) => {
      if (index < 3 || index > count - 3) {
        bind(card);
        card.mesh.visible = true;
      }
    });
    renderer.compile(scene, camera);
    for (let i = 0; i < (light ? Math.min(count, 4) : count); i++) request(i);
    idleHandle = idle(drain);
  });
  resize();

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      if (idleHandle) cancelIdle(idleHandle);
      resizer.disconnect();
      visibility.disconnect();
      modalWatch.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      cards.forEach((card) => card.material.dispose());
      cardGeometry.dispose();
      textures.forEach((entry) => entry.texture.dispose());
      ready.forEach((entry) => entry.texture.dispose());
      labelTexture.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      reflection.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
