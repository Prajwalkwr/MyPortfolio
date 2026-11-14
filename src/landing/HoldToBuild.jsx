import React, { useEffect, useRef, useState } from "react";

/* press and hold anywhere in the hero to let the rope go slack; release and it builds itself again */
export default function HoldToBuild({ areaRef, onChange }) {
  const badgeRef = useRef(null);
  const barRef = useRef(null);
  const [holding, setHolding] = useState(false);
  const [inside, setInside] = useState(false);
  const [finePointer] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let amount = 0;
    let held = false;
    let raf = 0;
    let last = performance.now();
    let targetX = 0;
    let targetY = 0;
    let badgeX = 0;
    let badgeY = 0;

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      amount = held ? Math.min(1, amount + dt / 1.1) : Math.max(0, amount - dt / 0.5);
      onChange(amount);
      if (barRef.current) barRef.current.style.transform = `scaleX(${amount})`;
      const ease = 1 - Math.exp(-dt * 14);
      badgeX += (targetX - badgeX) * ease;
      badgeY += (targetY - badgeY) * ease;
      if (badgeRef.current) badgeRef.current.style.transform = `translate3d(${badgeX}px, ${badgeY}px, 0) translate(-50%, -50%)`;
      const moving = Math.abs(targetX - badgeX) > 0.3 || Math.abs(targetY - badgeY) > 0.3;
      raf = held || amount > 0 || moving ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const track = (event) => {
      const rect = area.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
    };
    const onMove = (event) => {
      track(event);
      run();
    };
    const onDown = (event) => {
      const target = event.target;
      if (reduced || event.button !== 0) return;
      if (target.closest("a, button, input, textarea") || (target.tagName === "CANVAS" && "grab" in target.dataset)) return;
      held = true;
      setHolding(true);
      track(event);
      run();
    };
    const onUp = () => {
      if (!held) return;
      held = false;
      setHolding(false);
      run();
    };
    const onEnter = (event) => {
      track(event);
      badgeX = targetX;
      badgeY = targetY;
      setInside(true);
      run();
    };
    const onLeave = () => {
      setInside(false);
      onUp();
    };
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerdown", onDown);
    area.addEventListener("pointerenter", onEnter);
    area.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerdown", onDown);
      area.removeEventListener("pointerenter", onEnter);
      area.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [areaRef, onChange]);

  return (
    <>
      {finePointer && (
        <div ref={badgeRef} aria-hidden="true" data-dive-hide="" className={`landing-hold ${inside ? "is-inside" : ""}`}>
          <div className={`landing-hold-badge ${holding ? "is-holding" : ""}`}>
            {holding ? (
              <>
                Let go
                <br />
                to build
              </>
            ) : (
              <>
                Click
                <br />
                and hold
              </>
            )}
            <span className="landing-hold-corners" />
          </div>
        </div>
      )}
      <div aria-hidden="true" className={`landing-hold-progress ${holding ? "is-holding" : ""}`}>
        <div className="landing-wrap">
          <div className="landing-hold-track">
            <div ref={barRef} className="landing-hold-fill" />
          </div>
        </div>
      </div>
    </>
  );
}
