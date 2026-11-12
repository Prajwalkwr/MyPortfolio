import { useEffect, useRef } from "react";

const interactiveSelector = "a, button, input, textarea, select, label, summary, [role='button'], .throwable-text, .playful-cat, .question-block, .project-item, .testimonials-body-bg, .two26-nav-toggle-btn";
const textSelector = "input, textarea, [contenteditable='true']";
const CURSORS = "/assets/cursors/";
// tip of the arrow / index fingertip, in CSS px from each image's top-left corner
const ARROW_HOTSPOT = { x: 1, y: 1 };
const HAND_HOTSPOT = { x: 3, y: 1 };

export default function EnergyCursor() {
  const cursorRef = useRef(null);
  // must match the media query in styles.css that hides the native cursor
  const coarsePointer = typeof window !== "undefined" && !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor || coarsePointer) return;

    let pointerX = -100;
    let pointerY = -100;
    const position = () => {
      const handHotspot = cursor.classList.contains("is-interactive") && !cursor.classList.contains("is-text");
      const hotspot = handHotspot ? HAND_HOTSPOT : ARROW_HOTSPOT;
      cursor.style.transform = `translate3d(${pointerX - hotspot.x}px, ${pointerY - hotspot.y}px, 0)`;
    };
    const move = (event) => {
      if (event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      position();
      cursor.classList.add("is-visible");
    };
    const updateTarget = (event) => {
      if (!(event.target instanceof Element)) return;
      cursor.classList.toggle("is-interactive", Boolean(event.target.closest(interactiveSelector)));
      cursor.classList.toggle("is-text", Boolean(event.target.closest(textSelector)));
      position();
    };
    const press = () => cursor.classList.add("is-pressed");
    const release = () => cursor.classList.remove("is-pressed");
    const hide = () => cursor.classList.remove("is-visible", "is-pressed", "is-interactive", "is-text");

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", updateTarget);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("mouseleave", hide);

    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", updateTarget);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);

  if (coarsePointer) return null;

  return (
    <div className="energy-cursor" ref={cursorRef} aria-hidden="true">
      <span className="energy-cursor-arrow">
        <img className="energy-cursor-arrow-body" src={CURSORS + "gojo-arrow-body.png"} alt="" draggable="false" />
        <img className="energy-cursor-arrow-tails" src={CURSORS + "gojo-arrow-tails.png"} alt="" draggable="false" />
      </span>
      <span className="energy-cursor-hand">
        <img src={CURSORS + "gojo-hand.png"} alt="" draggable="false" />
      </span>
    </div>
  );
}
