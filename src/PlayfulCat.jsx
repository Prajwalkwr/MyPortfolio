import { useEffect, useRef } from "react";

const POSITION_KEY = "prajwal-playful-cat-progress";
const Y_POSITION_KEY = "prajwal-playful-cat-y";
const DIRECTION_KEY = "prajwal-playful-cat-direction";
const LEGACY_POSITION_KEY = "prajwal-home-cat-progress";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function PlayfulCat() {
  const catRef = useRef(null);
  const motionRef = useRef({ x: 0, y: 0, walkY: 0, direction: 1, mode: "walk" });
  const pointerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const savePositionRef = useRef(() => {});
  const startAnimationRef = useRef(() => {});

  useEffect(() => {
    const cat = catRef.current;
    const artwork = cat?.querySelector("img");
    if (!cat || !artwork) return;

    const motion = motionRef.current;
    // cached so the per-frame walk loop never forces a synchronous layout
    let catWidth = cat.offsetWidth;
    let catHeight = cat.offsetHeight;
    const measureCat = () => {
      catWidth = cat.offsetWidth;
      catHeight = cat.offsetHeight;
    };
    const maxX = () => Math.max(0, window.innerWidth - catWidth);
    const maxY = () => Math.max(0, window.innerHeight - catHeight);
    let storageAvailable = true;
    let lastSavedAt = 0;

    try {
      const saved = window.localStorage.getItem(POSITION_KEY);
      const legacy = window.localStorage.getItem(LEGACY_POSITION_KEY);
      const progress = Number(saved ?? legacy ?? 0);
      if (Number.isFinite(progress)) motion.x = clamp(progress, 0, 1) * maxX();
      if (window.localStorage.getItem(DIRECTION_KEY) === "-1") motion.direction = -1;
      const savedY = Number(window.localStorage.getItem(Y_POSITION_KEY));
      motion.y = window.localStorage.getItem(Y_POSITION_KEY) === null || !Number.isFinite(savedY)
        ? maxY()
        : clamp(savedY, 0, 1) * maxY();
      window.localStorage.removeItem(LEGACY_POSITION_KEY);
    } catch (error) {
      storageAvailable = false;
      console.warn("Could not restore the cat's position.", error);
    }
    motion.walkY = motion.y;
    const render = () => {
      cat.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
      artwork.style.setProperty("--cat-direction", String(motion.direction));
    };
    const savePosition = () => {
      if (!storageAvailable) return;
      try {
        window.localStorage.setItem(POSITION_KEY, String(maxX() ? motion.x / maxX() : 0));
        window.localStorage.setItem(Y_POSITION_KEY, String(maxY() ? motion.y / maxY() : 1));
        window.localStorage.setItem(DIRECTION_KEY, String(motion.direction));
      } catch (error) {
        storageAvailable = false;
        console.warn("Could not save the cat's position.", error);
      }
    };

    savePositionRef.current = savePosition;
    render();
    let previousTime = performance.now();
    let animationFrame = null;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) motion.mode = "paused";
    const tick = (now) => {
      animationFrame = null;
      const dt = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;

      if (motion.mode === "walk") {
        motion.x += motion.direction * (reducedMotion ? 75 : 140) * dt;
        if (motion.x <= 0 || motion.x >= maxX()) {
          motion.x = clamp(motion.x, 0, maxX());
          motion.direction *= -1;
        }
        motion.walkY = clamp(motion.walkY, 0, maxY());
        motion.y = motion.walkY;
      }

      render();
      if (motion.mode === "walk") {
        if (now - lastSavedAt >= 750) {
          savePosition();
          lastSavedAt = now;
        }
        animationFrame = requestAnimationFrame(tick);
      }
    };
    const startAnimation = () => {
      if (animationFrame === null && motion.mode === "walk") {
        previousTime = performance.now();
        animationFrame = requestAnimationFrame(tick);
      }
    };
    startAnimationRef.current = startAnimation;
    startAnimation();

    const handleResize = () => {
      measureCat();
      motion.x = clamp(motion.x, 0, maxX());
      motion.walkY = motion.mode === "walk" ? maxY() : clamp(motion.walkY, 0, maxY());
      motion.y = motion.mode === "walk" ? motion.walkY : clamp(motion.y, 0, maxY());
      render();
      startAnimation();
    };
    const handlePageHide = () => savePosition();
    const handleMotionPreference = (event) => {
      reducedMotion = event.matches;
      if (reducedMotion && motion.mode === "walk") {
        motion.mode = "paused";
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
        savePosition();
      }
    };
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    artwork.addEventListener("load", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("pagehide", handlePageHide);
    motionPreference.addEventListener("change", handleMotionPreference);

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      artwork.removeEventListener("load", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pagehide", handlePageHide);
      motionPreference.removeEventListener("change", handleMotionPreference);
      savePosition();
      savePositionRef.current = () => {};
      startAnimationRef.current = () => {};
    };
  }, []);

  const handlePointerDown = (event) => {
    const rect = catRef.current.getBoundingClientRect();
    const motion = motionRef.current;
    const wasWalking = motion.mode === "walk";
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.mode = "pending";
    pointerRef.current = {
      id: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      wasWalking,
      dragging: false,
    };
  };

  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    if (!pointer.dragging && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 6) return;

    const cat = catRef.current;
    const motion = motionRef.current;
    pointer.dragging = true;
    motion.mode = "drag";
    const nextX = clamp(event.clientX - pointer.offsetX, 0, Math.max(0, window.innerWidth - cat.offsetWidth));
    const nextY = clamp(event.clientY - pointer.offsetY, 0, Math.max(0, window.innerHeight - cat.offsetHeight));
    motion.x = nextX;
    motion.y = nextY;
    motion.walkY = nextY;
    cat.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
  };

  const handlePointerUp = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const motion = motionRef.current;
    if (pointer.dragging) {
      motion.mode = "paused";
      savePositionRef.current();
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    } else {
      motion.mode = pointer.wasWalking ? "walk" : "paused";
      startAnimationRef.current();
    }
    pointerRef.current = null;
  };

  const handlePointerCancel = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    motionRef.current.mode = pointer.dragging ? "paused" : pointer.wasWalking ? "walk" : "paused";
    startAnimationRef.current();
    pointerRef.current = null;
  };

  const handleClick = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }

    const motion = motionRef.current;
    if (motion.mode === "walk") {
      motion.mode = "paused";
    } else {
      motion.mode = "walk";
      motion.walkY = motion.y;
      startAnimationRef.current();
    }
    savePositionRef.current();
  };

  const handleKeyDown = (event) => {
    const motion = motionRef.current;
    const distance = 32;
    const moves = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
    };

    if (!moves[event.key]) return;

    event.preventDefault();
    motion.mode = "walk";
    if (event.key === "ArrowLeft") motion.direction = -1;
    if (event.key === "ArrowRight") motion.direction = 1;
    motion.x = clamp(motion.x + moves[event.key][0], 0, Math.max(0, window.innerWidth - catRef.current.offsetWidth));
    motion.walkY = clamp(motion.y + moves[event.key][1], 0, Math.max(0, window.innerHeight - catRef.current.offsetHeight));
    motion.y = motion.walkY;
    savePositionRef.current();
    startAnimationRef.current();
  };

  return (
    <button
      ref={catRef}
      className="playful-cat"
      type="button"
      aria-label="Playful cat. Tap to pause or resume walking. Drag to place it; use arrow keys to move."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <img src="/assets/cat.svg" alt="" draggable="false" />
    </button>
  );
}
