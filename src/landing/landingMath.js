export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const ramp = (v, from, to) => clamp01((v - from) / (to - from));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function mixStops(stops, value) {
  const t = clamp01(value);
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [from, a] = stops[i];
  const [to, b] = stops[i + 1];
  const m = (t - from) / (to - from);
  return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * m);
}

export const rgbCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

/* the dusk scene's warm light: amber -> brand orange -> ember, left to right */
export const ROPE_HEX = ["#FFA24C", "#FF5400", "#C8340E"];
export const ROPE_STOPS_AT = [0, 0.55, 1];
const ropeStops = ROPE_HEX.map((hex, i) => [ROPE_STOPS_AT[i], hexToRgb(hex)]);
export const ropeColorAt = (t) => mixStops(ropeStops, t);

/* the hero line: orange -> coral -> pink -> magenta -> violet -> blue, left to right */
export const LINE_STOPS = [
  [0, "#FF975E"],
  [0.1, "#FE7E59"],
  [0.2, "#FE6266"],
  [0.3, "#F0567F"],
  [0.43, "#E33CA0"],
  [0.51, "#C840B6"],
  [0.57, "#AA3BD4"],
  [0.63, "#9638EE"],
  [0.72, "#8240FC"],
  [0.8, "#744EFE"],
  [0.88, "#6469FF"],
  [1, "#4F94FF"],
];
const lineStops = LINE_STOPS.map(([at, hex]) => [at, hexToRgb(hex)]);
export const lineColorAt = (t) => mixStops(lineStops, t);

export const PAPER_HEX = "#f8eee8";
export const NIGHT_HEX = "#0c0603";
/* the hero's background as the camera dives into the rope: paper, warming, into night */
const skyStops = [
  [0, hexToRgb(PAPER_HEX)],
  [0.32, hexToRgb("#efcdb9")],
  [0.6, hexToRgb("#8a4326")],
  [0.82, hexToRgb("#2b1209")],
  [1, hexToRgb(NIGHT_HEX)],
];
export const skyAt = (t) => mixStops(skyStops, t);

/* shared between the rope canvas (which zooms into its flat left stretch) and the dive scene */
export const createDive = () => ({ p: 0, fx: 0, fy: 0, w: 20, W: 1, H: 1 });

export function diveView(dive) {
  const t = clamp01(dive.p);
  const maxZoom = Math.max(4, (2.4 * dive.H) / Math.max(1, dive.w));
  const zoom = Math.exp(Math.log(maxZoom) * t * t);
  const s = smooth(t);
  const cx = dive.fx + (dive.W / 2 - dive.fx) * s;
  const cy = dive.fy + (dive.H / 2 - dive.fy) * s;
  return { zoom, ox: cx - zoom * dive.fx, oy: cy - zoom * dive.fy };
}

export function ropeColorOnScreen(dive, screenX) {
  const view = diveView(dive);
  const x = (screenX - view.ox) / view.zoom;
  return lineColorAt((x + dive.w * 2) / (dive.W + dive.w * 4));
}

export const cappedRatio = (cap) => Math.min(window.devicePixelRatio || 1, cap);

/* steps the render resolution down when frames keep running long, never below floor */
export function createAdaptiveRatio({ start, floor, onChange }) {
  let ratio = start;
  let strikes = 0;
  const samples = [];
  return {
    get ratio() {
      return ratio;
    },
    sample(ms) {
      if (!(ms > 0) || ms > 120) return;
      samples.push(ms);
      if (samples.length > 48) samples.shift();
      if (samples.length < 16) return;
      const typical = samples.slice().sort((a, b) => a - b)[Math.floor(samples.length * 0.2)];
      strikes = ms > typical * 1.6 + 2 ? strikes + 1 : Math.max(0, strikes - 0.34);
      if (strikes >= 10 && ratio > floor) {
        ratio = Math.max(floor, Math.round((ratio - 0.25) * 100) / 100);
        strikes = 0;
        onChange(ratio);
      }
    },
  };
}

/* runs start() now, or once the intro preloader has lifted if it is still covering the page.
   The reveal event fires from inside the preloader's gsap.context, which would adopt (and later
   revert) any animation created synchronously in the listener, so start() runs on the next task. */
export function afterPreloader(start) {
  if (!document.body.classList.contains("preloader-active")) {
    start();
    return () => {};
  }
  let timer = 0;
  const onReveal = () => {
    timer = setTimeout(start, 0);
  };
  window.addEventListener("preloader:reveal", onReveal, { once: true });
  return () => {
    window.removeEventListener("preloader:reveal", onReveal);
    clearTimeout(timer);
  };
}
