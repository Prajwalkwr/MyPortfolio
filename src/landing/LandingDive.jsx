import React, { useEffect, useRef } from "react";
import { projects } from "../data";
import {
  afterPreloader,
  clamp01,
  diveView,
  easeOutQuart,
  ramp,
  rgbCss,
  ropeColorOnScreen,
  skyAt,
  smoother,
} from "./landingMath";

const FACTS = [
  { value: projects.length, label: "Projects built", count: true },
  { value: "BIM", label: "Student" },
  { value: "KTM", label: "Based in Kathmandu" },
];

const DIVE = [0.03, 0.3];
const SKY = [0.13, 0.27];
const TAKEOVER = 0.26;
const FALLBACK_PAPER = [0.95, 0.985];
/* the word's entrance gets a third of the scroll it would otherwise take, the rest stays one to one */
const QUICK = [0.44, 0.86];
const QUICK_RATE = 0.33;
const SCROLL_SCALE = 1 - (1 - QUICK_RATE) * (QUICK[1] - QUICK[0]);
function progressFromScroll(s) {
  const t = s * SCROLL_SCALE;
  const [from, to] = QUICK;
  if (t <= from) return t;
  if (t <= from + QUICK_RATE * (to - from)) return from + (t - from) / QUICK_RATE;
  return Math.min(1, t + (1 - QUICK_RATE) * (to - from));
}

function Horizon({ horizon = "62%" }) {
  return (
    <div aria-hidden="true" className="landing-horizon" style={{ "--horizon": horizon }}>
      <div className="landing-horizon-glow" />
      <div className="landing-horizon-line" />
    </div>
  );
}

function Facts({ listRef, countRefs, final = false, className = "" }) {
  return (
    <dl ref={listRef} className={`landing-facts ${className}`} aria-label="Prajwal in brief">
      {FACTS.map((fact, i) => (
        <div className="landing-fact" key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>
            {fact.count ? (
              <>
                <span className="landing-sr-only">{fact.value}</span>
                <span aria-hidden="true" ref={(el) => countRefs && (countRefs.current[i] = el)}>
                  {final ? fact.value : 0}
                </span>
              </>
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Label({ labelRef, className = "" }) {
  return (
    <div ref={labelRef} className={`landing-wrap landing-dive-label ${className}`}>
      <h2 id="landing-dive-h">Prajwal is a BIM student &amp; web developer</h2>
      <p>Web development</p>
    </div>
  );
}

export default function LandingDive({ diveRef, heroRef, headlineRef, introRef, reduced }) {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const sceneRef = useRef(null);
  const bandRef = useRef(null);
  const horizonRef = useRef(null);
  const paperRef = useRef(null);
  const logoRef = useRef(null);
  const labelRef = useRef(null);
  const factsRef = useRef(null);
  const countRefs = useRef([]);
  const nightRef = useRef(null);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const hideWithIntro = Array.from(document.querySelectorAll("[data-dive-hide]"));

    let top = 0;
    let range = 1;
    let scene = null;
    let failed = false;
    let disposed = false;
    let loading = false;
    const idle = window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;

    const layout = () => {
      top = section.getBoundingClientRect().top + window.scrollY;
      range = Math.max(1, section.offsetHeight - window.innerHeight);
      scene?.resize(sticky.clientWidth, sticky.clientHeight);
      wake();
    };

    const load = () => {
      if (loading || disposed) return;
      loading = true;
      import("./duskScene.js")
        .then((module) => {
          if (disposed) return;
          idle(
            () => {
              if (disposed) return;
              module.prebuild({ mobile });
              idle(
                () => {
                  if (disposed) return;
                  scene = module.createDuskScene({ mobile });
                  if (!scene) {
                    failed = true;
                    wake();
                    return;
                  }
                  sceneRef.current?.appendChild(scene.canvas);
                  scene.resize(sticky.clientWidth, sticky.clientHeight);
                  scene.prepare();
                  [bandRef.current, horizonRef.current, paperRef.current].forEach((el) => el && (el.style.display = "none"));
                  wake();
                },
                { timeout: 300 }
              );
            },
            { timeout: 300 }
          );
        })
        .catch((error) => {
          failed = true;
          console.error("The landing scene could not be loaded.", error);
          wake();
        });
    };
    let loadIdle = 0;
    let loadTimer = 0;
    const cancelPreloaderWait = afterPreloader(() => {
      loadTimer = window.setTimeout(() => {
        loadIdle = idle(load, { timeout: 400 });
      }, 2500);
    });

    let raf = 0;
    let idleTimer = 0;
    let running = false;
    let visible = false;
    let progress = -1;
    let lastT = 0;
    let counted = false;
    let pointerX = 0;
    let pointerY = 0;
    let lastSky = "";
    let lastPointerEvents = "";
    let dark = false;
    const cord = { l: [0, 0, 0], r: [0, 0, 0], y: 0.5, h: 10, bg: [0, 0, 0] };

    const fadeOut = (el, amount, transform) => {
      if (!el) return;
      el.style.transform = amount ? transform : "";
      el.style.opacity = amount ? String(1 - amount) : "";
      el.style.visibility = amount >= 1 ? "hidden" : "";
    };

    const tick = (now) => {
      raf = 0;
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
      lastT = now;
      const target = progressFromScroll(clamp01((window.scrollY - top) / range));
      if (progress < 0) progress = target;
      progress += (target - progress) * (1 - Math.exp(-dt * 10));
      if (Math.abs(target - progress) < 1e-4) progress = target;
      const e = progress;

      const dive = diveRef.current;
      const p = ramp(e, DIVE[0], DIVE[1]);
      if (p !== dive.p) {
        dive.p = p;
        window.dispatchEvent(new Event("landing-dive"));
      }
      const headlineOut = smoother(ramp(e, 0.02, 0.13));
      fadeOut(headlineRef.current, headlineOut, `translate3d(0, ${-14 * headlineOut}vh, 0)`);
      const introOut = smoother(ramp(e, 0.02, 0.09));
      fadeOut(introRef.current, introOut, `translate3d(0, ${48 * introOut}px, 0)`);
      hideWithIntro.forEach((el) => (el.style.opacity = introOut ? String(1 - introOut) : ""));

      const sky = skyAt(smoother(ramp(e, SKY[0], SKY[1])));
      const skyCss = e > SKY[0] ? rgbCss(sky) : "";
      if (heroRef.current && skyCss !== lastSky) heroRef.current.style.backgroundColor = lastSky = skyCss;

      const view = diveView(dive);
      cord.l = ropeColorOnScreen(dive, 0);
      cord.r = ropeColorOnScreen(dive, dive.W);
      cord.y = 1 - (view.oy + view.zoom * dive.fy) / Math.max(1, dive.H);
      cord.h = (view.zoom * dive.w) / 2;
      cord.bg = sky;

      if (scene) {
        scene.update(e, now, pointerX, pointerY, cord);
        if (e >= TAKEOVER && Math.abs(target - e) > 1e-4) scene.sample(dt * 1000);
      } else {
        const on = e >= TAKEOVER;
        if (bandRef.current) {
          bandRef.current.style.background = `linear-gradient(90deg, ${rgbCss(cord.l)}, ${rgbCss(cord.r)})`;
          bandRef.current.style.opacity = on ? String(1 - ramp(e, 0.27, 0.34)) : "0";
        }
        if (horizonRef.current) horizonRef.current.style.opacity = String(on ? smoother(ramp(e, 0.27, 0.4)) : 0);
        if (paperRef.current) paperRef.current.style.opacity = String(smoother(ramp(e, FALLBACK_PAPER[0], FALLBACK_PAPER[1])));
        if (logoRef.current) logoRef.current.style.opacity = failed ? String(ramp(e, 0.4, 0.56) * (1 - ramp(e, 0.86, 0.9))) : "0";
      }

      const textOut = 1 - ramp(e, 0.84, 0.87);
      if (labelRef.current) {
        const t = ramp(e, 0.56, 0.64);
        labelRef.current.style.opacity = String(t * textOut);
        labelRef.current.style.transform = `translate3d(0, ${(1 - easeOutQuart(t)) * 12}px, 0)`;
      }
      if (factsRef.current) {
        const t = ramp(e, 0.64, 0.7);
        factsRef.current.style.opacity = String(t * textOut);
        factsRef.current.style.transform = `translate3d(0, ${(1 - easeOutQuart(t)) * 16}px, 0)`;
      }
      if (e > 0.6 && !counted) {
        counted = true;
        const start = performance.now();
        const count = (t) => {
          const k = clamp01((t - start) / 1400);
          FACTS.forEach((fact, i) => {
            const el = countRefs.current[i];
            if (fact.count && el) el.textContent = String(Math.round(fact.value * easeOutQuart(clamp01(k * 1.15 - i * 0.08))));
          });
          if (k < 1) requestAnimationFrame(count);
        };
        requestAnimationFrame(count);
      }

      const pointerEvents = e >= TAKEOVER ? "auto" : "none";
      if (pointerEvents !== lastPointerEvents) sticky.style.pointerEvents = lastPointerEvents = pointerEvents;
      const nowDark = e > 0.2 && (scene ? !scene.covered : e < 0.96);
      if (nowDark !== dark) document.body.classList.toggle("landing-dark", (dark = nowDark));

      const moving = Math.abs(target - e) > 1e-4 || !!scene?.animating;
      const live = !!scene && e >= TAKEOVER && e < 0.985;
      if (!visible || !(moving || live)) {
        running = false;
        lastT = 0;
        return;
      }
      if (!moving) {
        /* holding still on the scene: keep its light moving at a calmer frame rate */
        idleTimer = window.setTimeout(() => {
          idleTimer = 0;
          raf = requestAnimationFrame(tick);
        }, 30);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    function wake() {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
        running = false;
      }
      if (running || !visible || disposed) return;
      running = true;
      raf = requestAnimationFrame(tick);
    }

    let scrollIdle = 0;
    const onScroll = () => {
      if (!loading && !scrollIdle) scrollIdle = idle(load, { timeout: 300 });
      wake();
    };
    const onPointerMove = (event) => {
      if (event.pointerType !== "mouse") return;
      pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      pointerY = (event.clientY / window.innerHeight) * 2 - 1;
      if (progress >= TAKEOVER) wake();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    const resizer = new ResizeObserver(layout);
    resizer.observe(sticky);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    visibility.observe(section);
    layout();

    return () => {
      disposed = true;
      cancelPreloaderWait();
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      window.clearTimeout(loadTimer);
      if (loadIdle) cancelIdle(loadIdle);
      if (scrollIdle) cancelIdle(scrollIdle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      resizer.disconnect();
      visibility.disconnect();
      diveRef.current.p = 0;
      hideWithIntro.forEach((el) => (el.style.opacity = ""));
      if (heroRef.current) heroRef.current.style.backgroundColor = "";
      [headlineRef.current, introRef.current].forEach((el) => {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
        el.style.visibility = "";
      });
      document.body.classList.remove("landing-dark");
      if (scene) {
        scene.canvas.remove();
        scene.dispose();
      }
    };
  }, [reduced, diveRef, heroRef, headlineRef, introRef]);

  /* reduced motion: the header still turns light while the night block is behind it */
  useEffect(() => {
    const night = nightRef.current;
    if (!reduced || !night) return;
    const observer = new IntersectionObserver(
      ([entry]) => document.body.classList.toggle("landing-dark", entry.isIntersecting),
      { rootMargin: "0px 0px -93% 0px" }
    );
    observer.observe(night);
    return () => {
      observer.disconnect();
      document.body.classList.remove("landing-dark");
    };
  }, [reduced]);

  if (reduced) {
    return (
      <section aria-labelledby="landing-dive-h" className="landing-dive-static">
        <div aria-hidden="true" className="landing-dive-static-fade" />
        <div ref={nightRef} className="landing-dive-static-night">
          <Horizon horizon="64%" />
          <Label />
          <div className="landing-dive-static-logo">
            <span className="landing-flat-logo">PRAJWAL<span className="landing-flat-dot">.</span></span>
          </div>
          <div className="landing-wrap landing-facts-wrap">
            <Facts final />
          </div>
        </div>
        <div aria-hidden="true" className="landing-dive-static-fade is-out" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} aria-labelledby="landing-dive-h" className="landing-dive">
      <div ref={stickyRef} className="landing-dive-sticky">
        <div ref={bandRef} aria-hidden="true" className="landing-dive-layer landing-dive-band" />
        <div ref={horizonRef} aria-hidden="true" className="landing-dive-layer landing-dive-fallback">
          <Horizon />
        </div>
        <div className="landing-dive-layer landing-dive-logo">
          <span ref={logoRef} className="landing-flat-logo" role="img" aria-label="Prajwal">
            PRAJWAL<span className="landing-flat-dot">.</span>
          </span>
        </div>
        <div ref={paperRef} aria-hidden="true" className="landing-dive-layer landing-dive-paper" />
        <div ref={sceneRef} aria-hidden="true" className="landing-dive-layer" />
        <Label labelRef={labelRef} />
        <div className="landing-facts-anchor">
          <div className="landing-wrap landing-facts-wrap">
            <Facts listRef={factsRef} countRefs={countRefs} />
          </div>
        </div>
      </div>
    </section>
  );
}
