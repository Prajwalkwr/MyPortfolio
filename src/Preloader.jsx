import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

const INTRO = "/assets/intro/";
const LOGO = INTRO + "logo.png";
const PANEL_COLOR = "#0d275c";
const PANEL_COUNT = 8;
const SAFETY_TIMEOUT = 14000;
const PRELOAD_TIMEOUT = 1200;

// the last card is the hero shot that stays in the middle of the ring
const CARDS = [
  { src: "01.jpg", ar: 1354 / 768 },
  { src: "02.jpg", ar: 1521 / 740 },
  { src: "03.jpg", ar: 1368 / 768 },
  { src: "04.jpg", ar: 1368 / 768 },
  { src: "05.jpg", ar: 1368 / 768 },
  { src: "06.jpg", ar: 1366 / 768 },
  { src: "07.jpg", ar: 1359 / 768 },
  { src: "08.jpg", ar: 1511 / 738 },
  { src: "09.jpg", ar: 1368 / 768 },
  { src: "10.jpg", ar: 1368 / 768 },
];
const HERO = CARDS.length - 1;
const STACK = [
  { x: 0, y: 0, rot: 0, s: 1 },
  { x: -14, y: 8, rot: -2.4, s: 0.99 },
  { x: 16, y: -6, rot: 2, s: 1 },
  { x: -8, y: -12, rot: -1.4, s: 0.985 },
  { x: 12, y: 12, rot: 1.8, s: 1 },
  { x: -18, y: -4, rot: -2.8, s: 0.99 },
  { x: 10, y: -10, rot: 1.2, s: 0.995 },
  { x: -6, y: 14, rot: -1, s: 1 },
  { x: 18, y: 4, rot: 2.6, s: 0.99 },
  { x: 0, y: 0, rot: 0, s: 1 },
];
const RING_TILT = [-8, 6, -5, 9, -7, 5, -9, 7, -6];

function pickLayout() {
  const w = window.innerWidth;
  const landscape = w > window.innerHeight;
  if (w <= 900 && landscape) return { stack: 0.7, zoom: 1, mainBoom: 0.55, surround: 0.3, rx: 0.42, ry: 0.4, stagger: 0.11 };
  if (w >= 1440) return { stack: 0.72, zoom: 1, mainBoom: 0.6, surround: 0.3, rx: 0.38, ry: 0.37, stagger: 0.12 };
  if (w >= 1024) return { stack: 0.72, zoom: 1, mainBoom: 0.58, surround: 0.3, rx: 0.38, ry: 0.36, stagger: 0.12 };
  if (w >= 768) return { stack: 0.72, zoom: 1, mainBoom: 0.58, surround: 0.32, rx: 0.37, ry: 0.36, stagger: 0.13 };
  return { stack: 0.74, zoom: 1, mainBoom: 0.6, surround: 0.34, rx: 0.4, ry: 0.3, stagger: 0.11 };
}

const preloadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });

export default function Preloader() {
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  });
  const [done, setDone] = useState(false);
  const rootRef = useRef(null);
  const logoRef = useRef(null);
  const cardRefs = useRef([]);
  const panelRefs = useRef([]);

  useLayoutEffect(() => {
    if (done) return;
    let finished = false;
    let revealed = false;
    let cancelled = false;
    let ctx;

    const originalPaddingRight = document.body.style.paddingRight;
    // innerWidth - clientWidth is unreliable on phones (it grows when the page is zoomed
    // out during first paint), so measure only the width the scroll lock actually frees up
    const widthBeforeLock = document.documentElement.clientWidth;
    document.body.classList.add("preloader-active");
    const scrollbarWidth = document.documentElement.clientWidth - widthBeforeLock;
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    window.__two26Lenis?.stop();

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.dispatchEvent(new Event("preloader:reveal"));
    };
    const unlockPage = () => {
      document.body.classList.remove("preloader-active");
      document.body.style.paddingRight = originalPaddingRight;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      reveal();
      unlockPage();
      window.__two26Lenis?.start();
      setDone(true);
    };

    const safety = setTimeout(finish, SAFETY_TIMEOUT);
    const sources = reducedMotion ? [LOGO] : [LOGO, ...CARDS.map((c) => INTRO + c.src)];
    const assets = Promise.all(sources.map(preloadImage));
    const timeout = new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT));

    Promise.race([assets, timeout]).then(() => {
      if (cancelled || !rootRef.current) return;
      const logo = logoRef.current;
      const cards = cardRefs.current;
      const panels = panelRefs.current;
      const openPanels = (duration, ease, each) => ({
        yPercent: (i) => (i % 2 === 0 ? -100 : 100),
        duration,
        ease,
        stagger: { each, from: "center" },
      });

      if (reducedMotion) {
        ctx = gsap.context(() => {
          const tl = gsap.timeline({ onComplete: finish });
          tl.timeScale(4);
          gsap.set(logo, { xPercent: -50, yPercent: -50 });
          tl.fromTo(logo, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" })
            .to(logo, { autoAlpha: 0, duration: 0.35 }, "+=0.25")
            .call(reveal, null, "-=0.05")
            .to(panels, openPanels(0.5, "power3.inOut", 0.03), "<");
        }, rootRef);
        return;
      }

      ctx = gsap.context(() => {
        const cfg = pickLayout();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const ring = cards.filter((_, i) => i !== HERO);
        const ringTargets = (distance) =>
          ring.map((el, i) => {
            const angle = (-90 + i * (360 / ring.length)) * (Math.PI / 180);
            return {
              el,
              x: Math.cos(angle) * vw * cfg.rx * distance,
              y: Math.sin(angle) * vh * cfg.ry * distance,
              rot: RING_TILT[i % RING_TILT.length],
            };
          });

        gsap.set(cards, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0, autoAlpha: 0, scale: cfg.stack, force3D: true, willChange: "transform, opacity" });
        gsap.set(logo, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.72, filter: "blur(8px)" });

        const tl = gsap.timeline({ onComplete: finish });
        tl.to(logo, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "power2.out" }, 0.3)
          .to(logo, { autoAlpha: 0, duration: 0.3, ease: "power1.inOut" }, 1.5);

        tl.set(cards[0], { zIndex: 10 }, 1.8)
          .to(cards[0], { autoAlpha: 1, scale: cfg.stack * STACK[0].s, duration: 0.5, ease: "power2.out" }, 1.8);
        cards.forEach((card, i) => {
          if (i === 0) return;
          const p = STACK[i] || { x: 0, y: 0, rot: 0, s: 1 };
          gsap.set(card, { zIndex: 10 + i });
          tl.fromTo(
            card,
            { autoAlpha: 0, x: p.x * 1.6, y: p.y * 1.6 - 30, rotation: p.rot, scale: cfg.stack * 0.94 },
            { autoAlpha: 1, x: p.x, y: p.y, rotation: p.rot, scale: cfg.stack * p.s, duration: 0.5, ease: "power3.out" },
            1.9 + i * cfg.stagger
          );
        });

        const zoomAt = 1.9 + cards.length * cfg.stagger + 0.5;
        tl.set(cards[HERO], { zIndex: 80 }, zoomAt - 0.05);
        tl.to(cards, { scale: cfg.zoom, x: 0, y: 0, rotation: 0, duration: 1.7, ease: "power4.inOut" }, zoomAt + 0.05);

        const burstAt = zoomAt + 0.05 + 1.7 + 0.45;
        ringTargets(1).forEach((t) => {
          tl.to(t.el, { x: t.x, y: t.y, rotation: t.rot, scale: cfg.surround, autoAlpha: 1, duration: 1.1, ease: "expo.out" }, burstAt);
        });
        tl.to(cards[HERO], { x: 0, y: 0, rotation: 0, scale: cfg.mainBoom, duration: 1.1, ease: "expo.out" }, burstAt);

        const exitAt = burstAt + 1.1 + 0.2;
        ringTargets(1.7).forEach((t) => {
          tl.to(t.el, { x: t.x, y: t.y, autoAlpha: 0, duration: 0.55, ease: "power2.in" }, exitAt);
        });
        tl.to(cards[HERO], { scale: cfg.mainBoom * 1.08, autoAlpha: 0, x: 0, y: 0, duration: 0.45, ease: "power2.in" }, exitAt + 0.05);
        tl.call(reveal, null, exitAt + 0.4);
        tl.to(panels, openPanels(0.75, "power4.inOut", 0.05), exitAt + 0.4);
      }, rootRef);
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      ctx?.revert();
      unlockPage();
    };
  }, [done, reducedMotion]);

  if (done) return null;

  return (
    <div className="site-preloader" ref={rootRef} aria-hidden="true">
      <div className="site-preloader-panels">
        {Array.from({ length: PANEL_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => { panelRefs.current[i] = el; }}
            className="site-preloader-panel"
            style={{ left: `calc(${i} * 100% / ${PANEL_COUNT})`, width: `calc(100% / ${PANEL_COUNT} + 1px)`, background: PANEL_COLOR }}
          />
        ))}
      </div>
      <img ref={logoRef} className="site-preloader-logo" src={LOGO} alt="" draggable="false" />
      {!reducedMotion && (
        <div className="site-preloader-cards">
          {CARDS.map((card, i) => (
            <div
              key={card.src}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="site-preloader-card"
              style={{ width: `min(90vw, ${(88 * card.ar).toFixed(1)}vh)`, aspectRatio: `${card.ar}` }}
            >
              <img src={INTRO + card.src} alt="" draggable="false" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
