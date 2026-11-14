import React, { useEffect, useRef } from "react";
import {
  LINE_STOPS,
  afterPreloader,
  cappedRatio,
  clamp01,
  createAdaptiveRatio,
  diveView,
  easeInOutCubic,
  lineColorAt,
  ramp,
  rgbCss,
  smooth,
} from "./landingMath";

const SHAPE_PULL = 0.02;
const SETTLED_GRAVITY = 380;
const SETTLED_DAMPING = 0.955;
const LOOSE_GRAVITY = 2600;
const STEP = 1 / 120;
const SETTLE_MS = 1300;

/*
  The line as drawn on a 1024px-wide artboard: flat along y 163 and 11px thick, with a wave in the
  middle (a rise, a crest, a curl down into a dip, a second crest, a little settle) and two pairs
  of dots floating above it.
*/
const ART_WIDTH = 1024;
const ART_BASELINE = 163;
const ART_THICKNESS = 11;
const ART_TOP = 117;
const ART_BOTTOM = 198;
const ART_WAVE_START = 320;
const WAVE = [
  [280, 163], [300, 163], [320, 163], [340, 164.5], [360, 166.5], [380, 170], [400, 171.5], [410, 170.5], [420, 169], [432, 165],
  [440, 162], [448, 157.5], [456, 153], [464, 148], [472, 143], [480, 137.5], [488, 133.5], [496, 129.5],
  [504, 126.5], [512, 124.5], [520, 124], [530, 125], [538, 129], [543, 138], [544, 150], [541, 164],
  [537, 177], [540, 187], [548, 192.5], [556, 193.5], [564, 191], [572, 185.5], [580, 178.5], [588, 169],
  [596, 158], [604, 147.5], [612, 138.5], [620, 131.5], [628, 127.5], [636, 125], [644, 125.5], [652, 128],
  [660, 133], [668, 141], [676, 149.5], [684, 157], [692, 162.5], [700, 166], [710, 168], [720, 169],
  [732, 168], [744, 167.5], [756, 165.5], [768, 164.5], [780, 163.5], [800, 163], [820, 163], [840, 163],
];
/* [x, y, radius] */
const DOTS = [
  [387, 145, 8.5],
  [414, 146.5, 2.75],
  [714.5, 145, 8.75],
  [740.5, 146.5, 3],
];

/* the traced wave, its pixel jitter eased out, as a smooth curve through every point */
function wavePoints() {
  const eased = WAVE.map((point, i) => {
    if (i === 0 || i === WAVE.length - 1) return point;
    const [a, b, c] = [WAVE[i - 1], point, WAVE[i + 1]];
    return [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4];
  });
  const out = [eased[0]];
  for (let i = 0; i < eased.length - 1; i++) {
    const p0 = eased[Math.max(0, i - 1)];
    const p1 = eased[i];
    const p2 = eased[i + 1];
    const p3 = eased[Math.min(eased.length - 1, i + 2)];
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1].map(
          (d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3)
        )
      );
    }
  }
  return out;
}

/*
  How thick the line is at a point, relative to its flat ends: like a ribbon turning, it thins
  where it enters and leaves the wave and on the slopes, and swells at the crests.
*/
function widthAt(ax, ay, tx, ty) {
  const zone = smooth(ramp(ax, 320, 400)) * (1 - smooth(ramp(ax, 700, 790)));
  const up = clamp01((ART_BASELINE - ay) / 39);
  const down = clamp01((ay - ART_BASELINE) / 30) * 0.35;
  const level = (tx * tx) / Math.max(1e-6, tx * tx + ty * ty);
  const inWave = 0.65 + 0.85 * level * smooth(Math.max(up, down));
  return 1 + (inWave - 1) * zone;
}

function resample(points, spacing) {
  const out = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length; i++) {
    let [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    let length = Math.hypot(x1 - x0, y1 - y0);
    while (carried + length >= spacing) {
      const t = (spacing - carried) / length;
      x0 += (x1 - x0) * t;
      y0 += (y1 - y0) * t;
      out.push([x0, y0]);
      length = Math.hypot(x1 - x0, y1 - y0);
      carried = 0;
    }
    carried += length;
  }
  out.push(points[points.length - 1]);
  return out;
}

export default function RopeCanvas({ className = "", cx = 0.5, cy = 0.5, slackRef, aboveRef, belowRef, diveRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let lineWidth = 20;
    let count = 0;
    let spacing = 0;
    let x = new Float32Array(0);
    let y = new Float32Array(0);
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    let homeX = new Float32Array(0);
    let homeY = new Float32Array(0);
    let pin = new Float32Array(0);
    let widths = new Float32Array(0);
    let leftX = new Float32Array(0);
    let leftY = new Float32Array(0);
    let rightX = new Float32Array(0);
    let rightY = new Float32Array(0);
    let dots = [];
    let dotsOn = reduced ? 1 : 0;
    let floorY = 0;
    let band = null;
    let gravity = LOOSE_GRAVITY;
    let pull = 0;
    let damping = 0.986;
    const iterations = mobile ? 6 : 8;

    const resolution = createAdaptiveRatio({
      start: cappedRatio(1.5),
      floor: Math.min(1.25, window.devicePixelRatio || 1),
      onChange: (ratio) => {
        dpr = ratio;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        draw();
      },
    });

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = resolution.ratio;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      /* the artboard's proportions at the screen's width, made smaller if the gap between the texts is tight */
      const waveHeight = ART_BOTTOM - ART_TOP;
      let s = Math.min(Math.max(W / ART_WIDTH, mobile ? 0.6 : 0.5), 2.4);
      let midY = H * cy;
      const diving = !!diveRef && diveRef.current.p > 0.001;
      if (diving && band) {
        midY = band[0] * H;
        s = band[1];
      } else if (aboveRef?.current && belowRef?.current) {
        const top = aboveRef.current.getBoundingClientRect().bottom - rect.top;
        const gap = belowRef.current.getBoundingClientRect().top - rect.top - top;
        if (gap > 0) {
          midY = top + gap / 2;
          s = Math.max(0.4, Math.min(s, (gap * 0.8) / waveHeight));
        }
      }
      if (!diving) band = [midY / H, s];
      lineWidth = ART_THICKNESS * s;
      const originX = W * cx;
      const baseline = midY + (ART_BASELINE - (ART_TOP + ART_BOTTOM) / 2) * s;
      const toX = (a) => originX + (a - ART_WIDTH / 2) * s;
      const toY = (b) => baseline + (b - ART_BASELINE) * s;
      const shaped = wavePoints().map(([a, b]) => [toX(a), toY(b)]);
      spacing = lineWidth * (mobile ? 0.7 : 0.4);
      const points = resample([[-lineWidth * 2, baseline], ...shaped, [W + lineWidth * 2, baseline]], spacing);
      count = points.length;
      x = new Float32Array(count);
      y = new Float32Array(count);
      px = new Float32Array(count);
      py = new Float32Array(count);
      homeX = new Float32Array(count);
      homeY = new Float32Array(count);
      pin = new Float32Array(count).fill(1);
      points.forEach(([a, b], i) => {
        homeX[i] = x[i] = px[i] = a;
        homeY[i] = y[i] = py[i] = b;
      });
      floorY = H * 4;

      /* each point keeps the thickness of its place on the artboard, wherever the rope throws it */
      widths = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(count - 1, i + 1);
        const artX = (homeX[i] - originX) / s + ART_WIDTH / 2;
        const artY = (homeY[i] - baseline) / s + ART_BASELINE;
        widths[i] = widthAt(artX, artY, homeX[b] - homeX[a], homeY[b] - homeY[a]);
      }
      leftX = new Float32Array(count);
      leftY = new Float32Array(count);
      rightX = new Float32Array(count);
      rightY = new Float32Array(count);

      /* the dots ride along with the bit of rope beneath them */
      dots = DOTS.map(([a, b, r]) => {
        const dx = toX(a);
        let near = 0;
        let best = Infinity;
        for (let i = 0; i < count; i++) {
          const d = Math.abs(homeX[i] - dx) + Math.abs(homeY[i] - toY(ART_BASELINE)) * 0.25;
          if (d < best) {
            best = d;
            near = i;
          }
        }
        return { x: dx, y: toY(b), r: r * s, near, color: rgbCss(lineColorAt((dx + lineWidth * 2) / (W + lineWidth * 4))) };
      });

      /* the dive goes into the middle of the flat stretch left of the wave, where the line is still orange */
      if (diveRef) {
        const dive = diveRef.current;
        dive.fx = toX(ART_WAVE_START) / 2;
        dive.fy = baseline;
        dive.w = lineWidth;
        dive.W = W;
        dive.H = H;
      }
    };

    const step = () => {
      const g = gravity * STEP * STEP;
      for (let i = 1; i < count - 1; i++) {
        const vx = (x[i] - px[i]) * damping;
        const vy = (y[i] - py[i]) * damping;
        px[i] = x[i];
        py[i] = y[i];
        x[i] += vx;
        y[i] += vy + g;
        const k = pull * pin[i];
        if (k > 0) {
          x[i] += (homeX[i] - x[i]) * k;
          y[i] += (homeY[i] - y[i]) * k;
        }
      }
      for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < count - 1; i++) {
          const dx = x[i + 1] - x[i];
          const dy = y[i + 1] - y[i];
          const dist = Math.hypot(dx, dy) || 1e-4;
          const diff = ((dist - spacing) / dist) * 0.5;
          const ox = dx * diff;
          const oy = dy * diff;
          if (i > 0) {
            x[i] += ox;
            y[i] += oy;
          }
          if (i + 1 < count - 1) {
            x[i + 1] -= ox;
            y[i + 1] -= oy;
          }
        }
        for (let i = 1; i < count - 1; i++) if (y[i] > floorY) y[i] = floorY;
      }
      x[0] = homeX[0];
      y[0] = homeY[0];
      x[count - 1] = homeX[count - 1];
      y[count - 1] = homeY[count - 1];
      for (let i = 1; i < count - 1; i++) {
        if (homeX[i] < -lineWidth * 0.5 || homeX[i] > W + lineWidth * 0.5) {
          x[i] = px[i] = homeX[i];
          y[i] = py[i] = homeY[i];
        }
      }
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dive = diveRef?.current;
      const p = dive ? dive.p : 0;
      if (dive && p > 0) {
        const view = diveView(dive);
        ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.ox, dpr * view.oy);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const exact = ramp(p, 0.3, 0.5);
      const X = (i) => x[i] + (homeX[i] - x[i]) * exact;
      const Y = (i) => y[i] + (homeY[i] - y[i]) * exact;
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        for (let i = 1; i < count - 1; i++) {
          ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
        }
        ctx.lineTo(X(count - 1), Y(count - 1));
      };
      const gradient = ctx.createLinearGradient(x[0], 0, x[count - 1], 0);
      LINE_STOPS.forEach(([at, hex]) => gradient.addColorStop(at, hex));
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      /* a faint glow in the line's own colours */
      const glow = 1 - ramp(p, 0.55, 0.8);
      if (glow > 0) {
        ctx.strokeStyle = gradient;
        trace();
        for (const widthScale of [1.8, 2.6, 3.5, 4.5, 5.7, 7]) {
          ctx.globalAlpha = 0.012 * glow;
          ctx.lineWidth = lineWidth * widthScale;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      /* the line itself: a ribbon, its two edges offset from the middle by each point's own half-thickness */
      for (let i = 0; i < count; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(count - 1, i + 1);
        const tx = X(b) - X(a);
        const ty = Y(b) - Y(a);
        const length = Math.hypot(tx, ty) || 1;
        const half = (lineWidth * widths[i]) / 2;
        const nx = (-ty / length) * half;
        const ny = (tx / length) * half;
        leftX[i] = X(i) + nx;
        leftY[i] = Y(i) + ny;
        rightX[i] = X(i) - nx;
        rightY[i] = Y(i) - ny;
      }
      const last = count - 1;
      ctx.beginPath();
      ctx.moveTo(leftX[0], leftY[0]);
      for (let i = 1; i < last; i++) {
        ctx.quadraticCurveTo(leftX[i], leftY[i], (leftX[i] + leftX[i + 1]) / 2, (leftY[i] + leftY[i + 1]) / 2);
      }
      ctx.lineTo(leftX[last], leftY[last]);
      ctx.lineTo(rightX[last], rightY[last]);
      for (let i = last - 1; i > 0; i--) {
        ctx.quadraticCurveTo(rightX[i], rightY[i], (rightX[i] + rightX[i - 1]) / 2, (rightY[i] + rightY[i - 1]) / 2);
      }
      ctx.lineTo(rightX[0], rightY[0]);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      if (dotsOn > 0) {
        ctx.globalAlpha = dotsOn;
        for (const dot of dots) {
          ctx.beginPath();
          ctx.arc(dot.x + (X(dot.near) - homeX[dot.near]) * 0.8, dot.y + (Y(dot.near) - homeY[dot.near]) * 0.8, dot.r, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    layout();
    if (reduced) {
      draw();
      const onResize = () => {
        layout();
        draw();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    /* it starts hanging loose, then pulls itself into the wave once the page is revealed */
    for (let i = 0; i < 240; i++) step();
    let settleAt = Infinity;
    let settled = false;
    let pointerX = -1e4;
    let pointerY = -1e4;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let grabbed = -1;

    const nearest = (gx, gy, maxDist) => {
      let found = -1;
      let best = maxDist;
      for (let i = 1; i < count - 1; i++) {
        const d = Math.hypot(x[i] - gx, y[i] - gy);
        if (d < best) {
          best = d;
          found = i;
        }
      }
      return found;
    };
    const toLocal = (event) => {
      const rect = canvas.getBoundingClientRect();
      const lx = event.clientX - rect.left;
      const ly = event.clientY - rect.top;
      const dive = diveRef?.current;
      if (!dive || dive.p <= 0) return [lx, ly];
      const view = diveView(dive);
      return [(lx - view.ox) / view.zoom, (ly - view.oy) / view.zoom];
    };
    const locked = () => !!diveRef && diveRef.current.p > 0.3;

    const onPointerMove = (event) => {
      if (locked()) {
        delete canvas.dataset.grab;
        return;
      }
      const [gx, gy] = toLocal(event);
      if (grabbed < 0) {
        if (nearest(gx, gy, lineWidth * 2.2) >= 0) canvas.dataset.grab = "";
        else delete canvas.dataset.grab;
      }
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const vx = ((gx - lastX) / dt) * 16;
      const vy = ((gy - lastY) / dt) * 16;
      lastX = gx;
      lastY = gy;
      lastT = now;
      pointerX = gx;
      pointerY = gy;
      if (grabbed < 0 && Math.abs(vx) + Math.abs(vy) > 0.5) {
        const sigma = lineWidth * 2;
        for (let i = 1; i < count - 1; i++) {
          const d = Math.hypot(x[i] - gx, y[i] - gy);
          if (d < lineWidth * 1.6) {
            const k = Math.exp(-(d * d) / (2 * sigma * sigma)) * 0.35;
            px[i] -= Math.max(-40, Math.min(40, vx * k));
            py[i] -= Math.max(-40, Math.min(40, vy * k));
          }
        }
      }
      wake();
    };
    const onPointerDown = (event) => {
      if (locked()) return;
      const [gx, gy] = toLocal(event);
      const found = nearest(gx, gy, lineWidth * 2.2);
      if (found < 0) return;
      grabbed = found;
      pointerX = gx;
      pointerY = gy;
      canvas.setPointerCapture?.(event.pointerId);
      for (let i = Math.max(1, found - 10); i < Math.min(count - 1, found + 11); i++) pin[i] = 0;
      wake();
    };
    const onPointerUp = () => {
      if (grabbed < 0) return;
      grabbed = -1;
      wake();
    };
    const onLetterThrow = ({ detail }) => {
      if (locked()) return;
      const [gx] = toLocal(detail);
      const sigma = lineWidth * 2;
      const vx = Math.max(-40, Math.min(40, detail.velocityX || 0));
      const vy = Math.max(-40, Math.min(40, detail.velocityY || 0));
      for (let i = 1; i < count - 1; i++) {
        const distance = Math.abs(x[i] - gx);
        if (distance > sigma * 3) continue;
        const impulse = Math.exp(-(distance * distance) / (2 * sigma * sigma)) * 0.35;
        px[i] -= vx * impulse;
        py[i] -= vy * impulse;
      }
      wake();
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("landing-letter-throw", onLetterThrow);

    let raf = 0;
    let running = false;
    let visible = true;
    let accumulator = 0;
    let lastFrame = performance.now();
    let stillFrames = 0;
    let lastP = 0;
    const frozen = () => !!diveRef && diveRef.current.p >= 0.95;

    const frame = (now) => {
      raf = 0;
      if (frozen()) {
        draw();
        running = false;
        return;
      }
      let shaped = 1;
      if (!settled) {
        const k = clamp01((now - settleAt) / SETTLE_MS);
        const e = easeInOutCubic(k);
        pull = SHAPE_PULL * e;
        gravity = LOOSE_GRAVITY + (SETTLED_GRAVITY - LOOSE_GRAVITY) * e;
        damping = 0.9 + (SETTLED_DAMPING - 0.9) * e;
        shaped = smooth(ramp(k, 0.55, 1));
        if (k >= 1) settled = true;
      }
      let slack = 0;
      if (settled && slackRef) {
        slack = clamp01(slackRef.current);
        pull = SHAPE_PULL * (1 - slack) * (1 - slack);
        gravity = SETTLED_GRAVITY + (LOOSE_GRAVITY - SETTLED_GRAVITY) * slack;
        damping = SETTLED_DAMPING - 0.02 * slack;
      }
      dotsOn = shaped * (1 - smooth(clamp01(slack * 2.5)));
      const p = diveRef ? diveRef.current.p : 0;
      if (p > 0.3 && settled) {
        const k = Math.min(1, (p - 0.3) / 0.2);
        pull = Math.max(pull, 0.12 * k);
        damping = Math.min(damping, SETTLED_DAMPING - 0.08 * k);
        grabbed = -1;
      }
      const diveMoved = Math.abs(p - lastP) > 1e-6;
      lastP = p;
      if (settled) resolution.sample(now - lastFrame);
      accumulator += Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
      }
      if (grabbed < 0) for (let i = 0; i < count; i++) pin[i] += (1 - pin[i]) * 0.03;
      else {
        x[grabbed] += (pointerX - x[grabbed]) * 0.35;
        y[grabbed] += (pointerY - y[grabbed]) * 0.35;
        px[grabbed] = x[grabbed];
        py[grabbed] = y[grabbed];
      }
      draw();
      let motion = 0;
      for (let i = 1; i < count - 1; i++) motion = Math.max(motion, Math.abs(x[i] - px[i]) + Math.abs(y[i] - py[i]));
      let pinning = false;
      for (let i = 0; i < count; i++) if (pin[i] < 0.995) pinning = true;
      const waiting = settleAt === Infinity;
      stillFrames = motion < 0.05 && (settled || waiting) && grabbed < 0 && !pinning && !diveMoved ? stillFrames + 1 : 0;
      if (stillFrames > 30 || !visible) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    function wake() {
      if (running || !visible || frozen()) return;
      running = true;
      stillFrames = 0;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    visibility.observe(canvas);

    let lastSlack = -1;
    const onExternal = () => {
      if (diveRef && Math.abs(diveRef.current.p - lastP) > 1e-6) wake();
      if (slackRef && Math.abs(slackRef.current - lastSlack) > 0.002) {
        lastSlack = slackRef.current;
        wake();
      }
    };
    window.addEventListener("scroll", onExternal, { passive: true });
    window.addEventListener("landing-slack", onExternal);
    window.addEventListener("landing-dive", wake);

    let fontsReady = false;
    let laidW = W;
    let laidH = H;
    const relayout = () => {
      const rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - laidW) < 1 && Math.abs(rect.height - laidH) < 1 && !fontsReady) return;
      fontsReady = false;
      laidW = rect.width;
      laidH = rect.height;
      layout();
      for (let i = 0; i < (settled ? 60 : 240); i++) step();
      draw();
      wake();
    };
    document.fonts?.ready.then(() => {
      fontsReady = true;
      relayout();
    });
    const resizer = new ResizeObserver(relayout);
    resizer.observe(canvas);

    draw();
    wake();
    const cancelStart = afterPreloader(() => {
      settleAt = performance.now() + 300;
      wake();
    });

    return () => {
      cancelStart();
      cancelAnimationFrame(raf);
      visibility.disconnect();
      resizer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("landing-letter-throw", onLetterThrow);
      window.removeEventListener("scroll", onExternal);
      window.removeEventListener("landing-slack", onExternal);
      window.removeEventListener("landing-dive", wake);
    };
  }, [cx, cy, slackRef, aboveRef, belowRef, diveRef]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`landing-rope ${className}`} />;
}
