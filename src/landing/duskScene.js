import {
  BackSide,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  Path,
  PerspectiveCamera,
  PMREMGenerator,
  Plane,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeUtils,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import fontData from "./prajwal-font.json";
import { PAPER_HEX, ROPE_HEX, cappedRatio, clamp01, createAdaptiveRatio, ramp, ropeColorAt, smooth, smoother } from "./landingMath";

export const TAKEOVER = 0.26;
const CORD = [0.262, 0.36];
const LIGHT = [0.3, 0.44];
const FINAL = [0.86, 0.985];
const LETTERS_AT = 0.375;
const LETTER_TIME = 1.3;

const WORD = "PRAJWAL";
const SIZE = 140;
const DEPTH = 28;
const TRACKING = SIZE * 0.05;
const DOT_RADIUS = SIZE * 0.11;
/* every capital in the word reaches 969 font units, so the baseline sits half a cap below the centre */
const CAP_HEIGHT = 969 * (SIZE / fontData.resolution);
const GROUND = -CAP_HEIGHT / 2;

/* where each letter starts its flight from: x, y, spin (deg) and scale */
const LAUNCH = [
  [-420, 260, -90, 2.2],
  [60, -420, 180, 2.6],
  [480, 300, 90, 1.8],
  [-120, 420, 45, 2],
  [260, -380, -60, 2.4],
  [520, -180, 120, 1.7],
  [-300, -360, 200, 2.3],
];
const DOT_LAUNCH = [380, 380];

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/* the backdrop writes display colours straight out, so its constants stay unconverted */
const glslVec3 = (hex) => {
  const c = new Color().setStyle(hex, "srgb-linear");
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const backdropFragment = /* glsl */ `
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uOn;
  uniform vec3 uBg;
  uniform vec3 uCordL;
  uniform vec3 uCordR;
  uniform float uCordY;
  uniform float uCordH;
  uniform float uGap;
  uniform float uCore;
  uniform float uCoreY;
  uniform float uLight;
  uniform float uPaper;
  uniform float uTime;
  uniform vec4 uRipple;
  uniform float uPointer;
  uniform float uHand;
  varying vec2 vUv;

  const vec3 PAPER = ${glslVec3(PAPER_HEX)};
  const vec3 NIGHT = ${glslVec3("#0c0603")};
  const vec3 NIGHT_HIGH = ${glslVec3("#1a0b05")};
  const vec3 AMBER = ${glslVec3(ROPE_HEX[0])};
  const vec3 ORANGE = ${glslVec3(ROPE_HEX[1])};
  const vec3 EMBER = ${glslVec3(ROPE_HEX[2])};

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    if (uPaper > 0.5) {
      gl_FragColor = vec4(PAPER, 1.0);
      return;
    }
    if (uOn < 0.5) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 uv = vUv;
    vec2 px = uv * uRes;
    float unit = uUnit;

    vec3 night = mix(NIGHT, NIGHT_HIGH, uv.y * 0.7);
    vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    night *= 1.0 - 0.25 * smoothstep(0.4, 1.2, length(q));
    vec3 c = mix(uBg, night, uLight);

    float d = abs(uv.x - uRipple.x) * uRes.x;
    float wave = uRipple.y * unit * exp(-2.2 * uRipple.z) * exp(-d / (240.0 * unit))
      * sin(0.04 * d / unit - 11.0 * uRipple.z);
    float ly = (uv.y - uCoreY) * uRes.y - wave;
    vec3 cord = mix(mix(AMBER, ORANGE, smoothstep(0.0, 0.55, uv.x)), EMBER, smoothstep(0.55, 1.0, uv.x));
    vec3 glowCol = mix(ORANGE, EMBER, smoothstep(0.25, 0.9, uv.x));
    float above = step(0.0, ly) * exp(-ly / (0.34 * uRes.y));
    float breathe = 1.0 + 0.05 * sin(uTime * 0.8);
    c += glowCol * above * 0.3 * breathe * uLight;
    c += glowCol * step(ly, 0.0) * exp(ly / (0.05 * uRes.y)) * 0.06 * uLight;
    float line = exp(-pow(ly / (1.3 * unit), 2.0)) + 0.25 * exp(-pow(ly / (16.0 * unit), 2.0));
    float sweep = fract(uTime / 16.0) * 1.5 - 0.25;
    float spot = exp(-pow((uv.x - sweep) * uRes.x / (300.0 * unit), 2.0)) * uLight;
    float hand = uHand * uLight * exp(-pow((uv.x - uPointer) * uRes.x / (220.0 * unit), 2.0));
    c += cord * line * uCore * (1.1 + 2.2 * spot + 1.2 * hand);
    c += glowCol * above * (spot + 0.6 * hand) * 0.5 * exp(-ly / (0.08 * uRes.y));

    vec3 band = mix(uCordL, uCordR, uv.x);
    float y = (uv.y - uCordY) * uRes.y;
    float ay = abs(y);
    float edge = unit;
    float inBand = smoothstep(uGap - edge, uGap + edge, ay) * (1.0 - smoothstep(uGap + uCordH - edge, uGap + uCordH + edge, ay));
    c = mix(c, band, inBand);

    float g = hash(floor(px)) - 0.5;
    c += g * mix(0.016, 0.008, inBand);
    gl_FragColor = vec4(max(c, 0.0), 1.0);
  }
`;

const letterUniformsChunk = /* glsl */ `
  varying vec3 vLitP;
  varying vec3 vLitN;
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uTime;
  uniform float uPointer;
  uniform float uHand;
  uniform float uGround;
  uniform vec3 uAmber;
  uniform vec3 uOrange;
  uniform vec3 uEmber;
  uniform float uGlow;
  uniform float uLit;
`;

/* the letters are lit like frosted tubes from the horizon line: white-hot faces, the line's colours at the rims */
const letterGlowChunk = /* glsl */ `
  {
    vec2 suv = gl_FragCoord.xy / uRes;
    vec3 lineCol = mix(mix(uAmber, uOrange, smoothstep(0.0, 0.55, suv.x)), uEmber, smoothstep(0.55, 1.0, suv.x));
    float h = max(vLitP.y - uGround, 0.0);
    vec3 nrm = normalize(vLitN);
    float facing = abs(dot(nrm, normalize(cameraPosition - vLitP)));
    float core = 0.6 + 0.4 * pow(facing, 1.5);
    float rim = pow(1.0 - facing, 1.6);
    float under = pow(clamp(-nrm.y, 0.0, 1.0), 1.5);
    float pool = exp(-h / 6.0);
    float lift = exp(-h / 30.0);
    float sweep = fract(uTime / 16.0) * 1.5 - 0.25;
    float spot = exp(-pow((suv.x - sweep) * uRes.x / (300.0 * uUnit), 2.0));
    float hand = uHand * exp(-pow((suv.x - uPointer) * uRes.x / (220.0 * uUnit), 2.0));
    float boost = 1.0 + 0.45 * spot + 0.3 * hand;
    vec3 hot = vec3(1.0, 0.96, 0.92) * core * (0.88 + 0.12 * lift);
    vec3 tint = lineCol * (0.7 * rim + 0.6 * under * lift + 0.9 * pool + 0.12 * lift);
    totalEmissiveRadiance += (hot + tint) * boost * uGlow * mix(0.1, 1.0, uLit);
  }
`;

/* monotone cubic through the camera's keyframes: [progress, distance, yaw, pitch] */
const CAMERA_KEYS = [
  [0.34, 1.45, -14, 6],
  [0.5, 1.22, -10, 4],
  [0.66, 1.06, -6, 3],
  [0.86, 0.9, 7, 1.5],
];
function cameraCurve(column) {
  const xs = CAMERA_KEYS.map((k) => k[0]);
  const ys = CAMERA_KEYS.map((k) => k[column]);
  const n = xs.length;
  const h = xs.slice(1).map((v, i) => v - xs[i]);
  const slope = ys.slice(1).map((v, i) => (v - ys[i]) / h[i]);
  const m = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
const cameraDistance = cameraCurve(1);
const cameraYaw = cameraCurve(2);
const cameraPitch = cameraCurve(3);

/* this font winds its outlines the opposite way to what three expects, so in letters with a counter
   (P, R, A) the counter comes out as the body and the outline as its hole; swap them back */
function glyphShapes(font, ch) {
  const areaOf = (path) => Math.abs(ShapeUtils.area(path.getPoints()));
  return font.generateShapes(ch, SIZE).map((shape) => {
    const bodyArea = areaOf(shape);
    const outline = shape.holes.find((hole) => areaOf(hole) > bodyArea);
    if (!outline) return shape;
    const counter = new Path();
    counter.curves = shape.curves;
    const fixed = new Shape();
    fixed.curves = outline.curves;
    fixed.holes = [counter, ...shape.holes.filter((hole) => hole !== outline)];
    return fixed;
  });
}

const geometryCache = new Map();
function buildWord(mobile) {
  const key = mobile ? "low" : "high";
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const font = new FontLoader().parse(fontData);
  const scale = SIZE / fontData.resolution;
  const glyphGeometry = new Map();
  const parts = [];
  let cursor = 0;
  for (const ch of WORD) {
    if (!glyphGeometry.has(ch)) {
      const geo = new ExtrudeGeometry(glyphShapes(font, ch), {
        depth: DEPTH,
        curveSegments: mobile ? 4 : 8,
        bevelEnabled: true,
        bevelThickness: 7,
        bevelSize: 4.5,
        bevelOffset: 0,
        bevelSegments: mobile ? 3 : 6,
      });
      geo.computeBoundingBox();
      const centre = new Vector3();
      geo.boundingBox.getCenter(centre);
      geo.translate(-centre.x, -centre.y, -centre.z);
      glyphGeometry.set(ch, { geo, centre });
    }
    const { geo, centre } = glyphGeometry.get(ch);
    parts.push({ geo, home: new Vector3(cursor + centre.x, centre.y, 0) });
    cursor += fontData.glyphs[ch].ha * scale + TRACKING;
  }
  const dotGeo = new SphereGeometry(DOT_RADIUS, mobile ? 40 : 64, mobile ? 20 : 32);
  const dotHome = new Vector3(cursor + DOT_RADIUS * 0.4, DOT_RADIUS, 0);
  const width = dotHome.x + DOT_RADIUS;
  const word = { parts, dotGeo, dotHome, width, geometries: [...[...glyphGeometry.values()].map((g) => g.geo), dotGeo] };
  geometryCache.set(key, word);
  return word;
}

/* a soft studio, captured once as an environment map, so the letters have something to reflect */
function buildEnvironment(renderer) {
  const room = new Scene();
  const disposables = [];
  const add = (geometry, material, position) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
    disposables.push(geometry, material);
  };
  const shellGeo = new SphereGeometry(50, 32, 16);
  const shellMat = new MeshBasicMaterial({ color: "#120804", side: BackSide });
  room.add(new Mesh(shellGeo, shellMat));
  disposables.push(shellGeo, shellMat);
  const panel = (k) => new MeshBasicMaterial({ color: new Color(1, 0.985, 0.97).multiplyScalar(k) });
  add(new PlaneGeometry(24, 5), panel(34), [-8, 30, 6]);
  add(new PlaneGeometry(56, 1.4), panel(16), [-4, 13, 27]);
  add(new PlaneGeometry(6, 26), panel(2.2), [30, 6, 10]);
  add(new PlaneGeometry(6, 26), panel(1.4), [-30, 6, 10]);
  const front = new PlaneGeometry(70, 30, 1, 8);
  const frontColors = [];
  const frontPos = front.getAttribute("position");
  for (let i = 0; i < frontPos.count; i++) {
    const g = 0.1 + 0.5 * Math.pow(frontPos.getY(i) / 30 + 0.5, 2);
    frontColors.push(g, g * 0.985, g * 0.97);
  }
  front.setAttribute("color", new Float32BufferAttribute(frontColors, 3));
  add(front, new MeshBasicMaterial({ vertexColors: true }), [0, 6, 32]);
  const strip = new PlaneGeometry(80, 3, 16, 1);
  const stripColors = [];
  const stripPos = strip.getAttribute("position");
  for (let i = 0; i < stripPos.count; i++) {
    const c = ropeColorAt(stripPos.getX(i) / 80 + 0.5);
    const linear = new Color().setRGB(c[0], c[1], c[2], "srgb");
    stripColors.push(linear.r * 3.2, linear.g * 3.2, linear.b * 3.2);
  }
  strip.setAttribute("color", new Float32BufferAttribute(stripColors, 3));
  add(strip, new MeshBasicMaterial({ vertexColors: true }), [0, -9, 26]);
  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.035).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return texture;
}

/* reflections live below the ground plane and fade with depth */
function reflectionMaterial(base, plane, ground, fade) {
  const material = base.clone();
  material.transparent = true;
  material.clippingPlanes = [plane];
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGround = { value: ground };
    shader.uniforms.uFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWorldY;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWorldY;\nuniform float uGround;\nuniform float uFade;")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= uFade * exp(-(uGround - vWorldY) / 26.0);");
  };
  material.customProgramCacheKey = () => "landing-reflection";
  return material;
}

export function prebuild({ mobile }) {
  buildWord(mobile);
}

export function createDuskScene({ mobile }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(cappedRatio(mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NoToneMapping;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%";

  const scene = new Scene();
  const camera = new PerspectiveCamera(mobile ? 34 : 28, 1, 2, 30000);

  const backdrop = new ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader: backdropFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRes: { value: new Vector2(1, 1) },
      uUnit: { value: 1 },
      uOn: { value: 0 },
      uBg: { value: new Vector3(0.05, 0.02, 0.01) },
      uCordL: { value: new Vector3(1, 0.33, 0) },
      uCordR: { value: new Vector3(1, 0.33, 0) },
      uCordY: { value: 0.5 },
      uCordH: { value: 100 },
      uGap: { value: 0 },
      uCore: { value: 0 },
      uCoreY: { value: 0.5 },
      uLight: { value: 0 },
      uPaper: { value: 0 },
      uTime: { value: 0 },
      uRipple: { value: new Vector4(0.5, 0, 9, 0) },
      uPointer: { value: 0.5 },
      uHand: { value: 0 },
    },
  });
  const backdropMesh = new Mesh(new PlaneGeometry(2, 2), backdrop);
  backdropMesh.frustumCulled = false;
  backdropMesh.renderOrder = -10;
  scene.add(backdropMesh);
  scene.environment = buildEnvironment(renderer);

  const u = backdrop.uniforms;
  const groundPlane = new Plane(new Vector3(0, -1, 0), GROUND);
  const shared = {
    uRes: u.uRes,
    uUnit: u.uUnit,
    uTime: u.uTime,
    uPointer: u.uPointer,
    uHand: u.uHand,
    uGround: { value: GROUND },
    uAmber: { value: new Color(ROPE_HEX[0]) },
    uOrange: { value: new Color(ROPE_HEX[1]) },
    uEmber: { value: new Color(ROPE_HEX[2]) },
    uGlow: { value: 0 },
  };
  const letterMaterial = (lit) => {
    const material = new MeshStandardMaterial({ color: "#6F6A74", roughness: 0.35, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, { uLit: lit });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLitP;\nvarying vec3 vLitN;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvLitP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvLitN = mat3(modelMatrix) * objectNormal;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${letterUniformsChunk}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${letterGlowChunk}`);
    };
    material.customProgramCacheKey = () => "landing-lit-letter";
    return material;
  };

  const word = buildWord(mobile);
  const paper = new Color(PAPER_HEX);
  const orange = new Color(ROPE_HEX[1]);
  const dotMaterial = new MeshPhysicalMaterial({
    color: "#ff7a33",
    roughness: 0.32,
    clearcoat: mobile ? 0 : 1,
    clearcoatRoughness: 0.09,
    emissive: orange.clone(),
    emissiveIntensity: 0.85,
    toneMapped: false,
  });
  const dotFlat = new MeshBasicMaterial({ color: paper, toneMapped: false });

  const world = new Group();
  const letters = new Group();
  letters.position.set(-word.width / 2, GROUND, 0);
  world.add(letters);
  scene.add(world);
  const litUniforms = word.parts.map(() => ({ value: 0 }));
  const letterMaterials = [];
  const parts = word.parts.map(({ geo, home }, i) => {
    const material = letterMaterial(litUniforms[i]);
    letterMaterials.push(material);
    const mesh = new Mesh(geo, material);
    mesh.position.copy(home);
    mesh.visible = false;
    letters.add(mesh);
    return { mesh, home };
  });
  const dot = new Mesh(word.dotGeo, dotMaterial);
  dot.position.copy(word.dotHome);
  dot.visible = false;
  letters.add(dot);

  const fade = { value: 0 };
  const letterReflection = reflectionMaterial(new MeshBasicMaterial({ color: "#f3dccb" }), groundPlane, GROUND, fade);
  const dotReflection = reflectionMaterial(new MeshStandardMaterial({ color: "#ff7a33", roughness: 0.38 }), groundPlane, GROUND, fade);
  const mirror = new Group();
  mirror.position.y = 2 * GROUND;
  mirror.scale.y = -1;
  const mirrorLetters = new Group();
  mirrorLetters.position.copy(letters.position);
  mirror.add(mirrorLetters);
  world.add(mirror);
  const reflections = parts.map(({ mesh }) => {
    const copy = new Mesh(mesh.geometry, letterReflection);
    mirrorLetters.add(copy);
    return copy;
  });
  const dotCopy = new Mesh(word.dotGeo, dotReflection);
  mirrorLetters.add(dotCopy);

  const hemi = new HemisphereLight("#FFFFFF", "#1f120b", 0.3);
  const key = new DirectionalLight("#FFFFFF", 1.6);
  key.position.set(-600, 750, 600);
  const fill = new DirectionalLight("#FFB070", 0.9);
  fill.position.set(700, 400, -600);
  const front = new DirectionalLight("#FFFFFF", 0.2);
  front.position.set(0, 0, 1);
  camera.add(front);
  const halfWidth = word.width / 2;
  const warmLeft = new PointLight(ROPE_HEX[0], 0, 0, 2);
  warmLeft.position.set(-halfWidth * 1.4, GROUND + 18, 150);
  const warmRight = new PointLight(ROPE_HEX[2], 0, 0, 2);
  warmRight.position.set(halfWidth * 1.4, GROUND + 18, 150);
  scene.add(hemi, key, fill, warmLeft, warmRight, camera);

  let baseDistance = 1200;
  let width = 1;
  let height = 1;
  const resize = (w, h) => {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const coverage = mobile ? 0.9 : 0.68;
    const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    baseDistance = word.width / coverage / (2 * tan * aspect);
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    u.uRes.value.copy(buffer);
    u.uUnit.value = renderer.getPixelRatio() * (height / 900);
  };
  const floorRatio = mobile ? 1.25 : 1.5;
  const resolution = createAdaptiveRatio({
    start: renderer.getPixelRatio(),
    floor: Math.min(floorRatio, renderer.getPixelRatio()),
    onChange: (ratio) => {
      renderer.setPixelRatio(ratio);
      resize(width, height);
    },
  });

  let pointerX = 0;
  let pointerY = 0;
  let lastTime = 0;
  let landedAt = 0;
  let cleared = false;
  let lastPointerPx = 0;
  let lastPointerPy = 0;
  let rippleAt = -1e9;
  let pointerMovedAt = -1e9;
  let lettersT = 0;
  let progress = 0;
  let covered = false;
  let horizonY = 0.35;
  const dotWorld = new Vector3();
  const orbit = new Vector3();
  const aimBase = new Vector3();
  const toCamera = new Vector3();
  const lifted = new Vector3();
  const aim = new Vector3();
  const projected = new Vector3();

  return {
    canvas,
    resize,
    async prepare() {
      const shown = parts.map((part) => part.mesh.visible);
      parts.forEach((part) => (part.mesh.visible = true));
      dot.visible = true;
      try {
        await renderer.compileAsync(scene, camera);
        dot.material = dotFlat;
        await renderer.compileAsync(scene, camera);
      } catch {
        /* compiling ahead is only a head start; the first real frame compiles anything missed */
      }
      parts.forEach((part, i) => (part.mesh.visible = shown[i]));
      dot.material = dotMaterial;
      dot.visible = false;
    },
    update(e, now, px, py, cord) {
      const time = now / 1000;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      if (e < TAKEOVER) {
        if (!cleared) renderer.clear();
        cleared = true;
        covered = false;
        return;
      }
      cleared = false;
      const follow = 1 - Math.exp(-dt * 4);
      pointerX += (px - pointerX) * follow;
      pointerY += (py - pointerY) * follow;
      const ratio = renderer.getPixelRatio();

      u.uOn.value = 1;
      u.uTime.value = time;
      u.uBg.value.set(cord.bg[0], cord.bg[1], cord.bg[2]);
      u.uCordL.value.set(cord.l[0], cord.l[1], cord.l[2]);
      u.uCordR.value.set(cord.r[0], cord.r[1], cord.r[2]);
      u.uCordY.value = cord.y;
      const open = ramp(e, CORD[0], CORD[1]);
      u.uCordH.value = cord.h * ratio * (1 + 2.5 * open * open);
      u.uGap.value = Math.pow(open, 1.6) * height * 1.3 * ratio;
      u.uCore.value = smooth(ramp(e, CORD[0], CORD[0] + 0.03));
      const light = smoother(ramp(e, LIGHT[0], LIGHT[1]));
      u.uLight.value = light * (1 - ramp(e, FINAL[0], FINAL[0] + 0.05));
      progress = e;

      const lettersTarget = e >= LETTERS_AT ? LETTER_TIME : 0;
      const speed = lettersTarget > lettersT ? 1 : 2;
      lettersT = lettersTarget > lettersT ? Math.min(lettersTarget, lettersT + dt * speed) : Math.max(lettersTarget, lettersT - dt * speed);
      const assembled = lettersT / LETTER_TIME;
      parts.forEach((part, i) => {
        const t = clamp01((assembled - i * 0.07) / 0.45);
        const eased = 1 - Math.pow(1 - t, 4);
        const [ox, oy, spin, size] = LAUNCH[i % LAUNCH.length];
        const mesh = part.mesh;
        mesh.visible = t > 0;
        mesh.position.set(part.home.x + ox * (1 - eased), part.home.y + oy * (1 - eased), part.home.z);
        mesh.rotation.set(0, 0, MathUtils.degToRad(spin * (1 - eased)));
        mesh.scale.setScalar(size + (1 - size) * eased);
        litUniforms[i].value = 0.2 + 0.8 * clamp01(eased * 1.4);
        const copy = reflections[i];
        copy.visible = mesh.visible;
        copy.position.copy(mesh.position);
        copy.rotation.copy(mesh.rotation);
        copy.scale.copy(mesh.scale);
      });
      const dotT = clamp01((assembled - 0.55) / 0.3);
      const dotEased = 1 - Math.pow(1 - dotT, 4);
      dot.visible = dotT > 0;
      dot.position.set(word.dotHome.x + DOT_LAUNCH[0] * (1 - dotEased), word.dotHome.y + DOT_LAUNCH[1] * (1 - dotEased), word.dotHome.z);
      if (dotT >= 1 && !landedAt) landedAt = now;
      if (dotT < 0.95) landedAt = 0;
      const pop = landedAt ? Math.sin(Math.min(1, (now - landedAt) / 500) * Math.PI) : 0;
      dot.scale.setScalar(1 + 0.22 * pop);
      dotCopy.visible = dot.visible;
      dotCopy.position.copy(dot.position);
      dotCopy.scale.copy(dot.scale);

      key.position.set((-0.6 + Math.sin((2 * Math.PI * time) / 12) * 0.16) * 1000, 750, 600);
      fill.intensity = 0.9 * (1 + 0.08 * Math.sin((2 * Math.PI * time) / 11.1 + 1.3));
      shared.uGlow.value = 1.05 * light;
      warmLeft.intensity = 26000 * u.uLight.value;
      warmRight.intensity = 34000 * u.uLight.value;

      const yaw = MathUtils.degToRad(cameraYaw(e) + pointerX * 2.5);
      const pitch = MathUtils.degToRad(cameraPitch(e) - pointerY * 1.5);
      const distance = cameraDistance(e) * baseDistance;
      orbit.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance);
      aimBase.set(0, mobile ? -baseDistance * 0.1 : -baseDistance * 0.012, 0);

      /* the last stretch: the camera turns to the dot and flies into it, until all that is left is paper */
      let paperOn = e >= FINAL[1] ? 1 : 0;
      const final = ramp(e, FINAL[0], FINAL[1]);
      const toPaper = smooth(ramp(final, 0.2, 0.62));
      dotMaterial.color.set("#ff7a33").multiplyScalar(1 - toPaper);
      dotMaterial.emissive.copy(orange).lerp(paper, toPaper);
      dotMaterial.emissiveIntensity = 0.85 + 0.15 * toPaper;
      dotMaterial.envMapIntensity = 1 - toPaper;
      dotMaterial.clearcoat = mobile ? 0 : 1 - toPaper;
      fade.value = 0.2 * u.uLight.value * (1 - smooth(ramp(final, 0, 0.3)));
      mirror.visible = fade.value > 0.002;
      dot.material = toPaper >= 0.98 ? dotFlat : dotMaterial;
      if (final > 0 && paperOn < 1) {
        letters.updateMatrixWorld(true);
        dot.getWorldPosition(dotWorld);
        toCamera.copy(orbit).sub(dotWorld);
        const far = toCamera.length();
        toCamera.normalize();
        lifted.copy(toCamera).setY(toCamera.y + 0.45).normalize();
        toCamera.lerp(lifted, smooth(ramp(final, 0, 0.5))).normalize();
        const reach = far * Math.pow((DOT_RADIUS * 0.9) / far, smooth(final));
        camera.position.copy(dotWorld).addScaledVector(toCamera, reach);
        aim.copy(aimBase).lerp(dotWorld, smooth(ramp(final, 0, 0.45)));
        camera.lookAt(aim);
        if (reach < DOT_RADIUS * 1.1) paperOn = 1;
        const halfDiagonal = Math.atan(Math.tan(MathUtils.degToRad(camera.fov / 2)) * Math.hypot(1, camera.aspect));
        covered = paperOn === 1 || reach < DOT_RADIUS / Math.sin(halfDiagonal);
      } else {
        camera.position.copy(orbit);
        camera.lookAt(aimBase);
        covered = paperOn === 1;
      }
      u.uPaper.value = paperOn;
      world.visible = e > 0.35 && paperOn < 1;
      camera.updateMatrixWorld();

      projected.set(0, GROUND, 0).project(camera);
      if (Number.isFinite(projected.y) && projected.z < 1) horizonY = Math.max(-2, Math.min(2, projected.y * 0.5 + 0.5));
      u.uCoreY.value = cord.y + (horizonY - cord.y) * smooth(ramp(e, LIGHT[0], LIGHT[1]));

      const pointerPx = ((px + 1) / 2) * width;
      const pointerPy = ((py + 1) / 2) * height;
      const lineY = (1 - u.uCoreY.value) * height;
      const travelled = Math.hypot(pointerPx - lastPointerPx, pointerPy - lastPointerPy);
      if (u.uLight.value > 0.6 && Math.abs(pointerPy - lineY) < 46 && travelled > 2 && now - rippleAt > 260) {
        rippleAt = now;
        u.uRipple.value.set(pointerPx / width, Math.min(9, 3 + travelled * 0.35), 0, 0);
      }
      lastPointerPx = pointerPx;
      lastPointerPy = pointerPy;
      u.uRipple.value.z = (now - rippleAt) / 1000;
      if (travelled > 0.5) pointerMovedAt = now;
      const settle = 1 - Math.exp(-dt * 5);
      u.uHand.value += ((now - pointerMovedAt < 1400 ? 1 : 0) - u.uHand.value) * settle;
      u.uPointer.value += (pointerPx / width - u.uPointer.value) * (1 - Math.exp(-dt * 9));

      renderer.render(scene, camera);
    },
    sample(ms) {
      resolution.sample(ms);
    },
    /* true once the light dot (or the paper behind it) fills the whole screen */
    get covered() {
      return covered;
    },
    get animating() {
      return lettersT !== (progress >= LETTERS_AT ? LETTER_TIME : 0);
    },
    dispose() {
      word.geometries.forEach((g) => g.dispose());
      geometryCache.clear();
      letterMaterials.forEach((m) => m.dispose());
      letterReflection.dispose();
      dotReflection.dispose();
      dotMaterial.dispose();
      dotFlat.dispose();
      backdrop.dispose();
      backdropMesh.geometry.dispose();
      scene.environment?.dispose();
      renderer.dispose();
    },
  };
}
