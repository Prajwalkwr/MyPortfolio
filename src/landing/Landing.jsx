import React, { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import RopeCanvas from "./RopeCanvas";
import LandingDive from "./LandingDive";
import { afterPreloader, createDive } from "./landingMath";
import "./landing.css";

function renderLetters(text, prefix) {
  return Array.from(text, (character, index) => (
    character === " "
      ? <span className="landing-letter-space" key={`${prefix}-${index}`}>{" "}</span>
      : <span className="landing-letter" key={`${prefix}-${index}`}>{character}</span>
  ));
}

export default function Landing({ cta }) {
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const heroRef = useRef(null);
  const headlineRef = useRef(null);
  const introRef = useRef(null);
  const slackRef = useRef(0);
  const diveRef = useRef(createDive());

  const onSlack = useCallback((amount) => {
    if (amount === slackRef.current) return;
    slackRef.current = amount;
    window.dispatchEvent(new Event("landing-slack"));
  }, []);

  /* the headline rises line by line once the preloader lifts, then the intro row fades in */
  useEffect(() => {
    if (reduced) return;
    const lines = headlineRef.current?.querySelectorAll(".landing-line-inner");
    const foot = introRef.current?.querySelector(".landing-foot-inner");
    if (!lines?.length || !foot) return;
    gsap.set(lines, { yPercent: 110 });
    gsap.set(foot, { opacity: 0, y: 16 });
    let timeline;
    const cancel = afterPreloader(() => {
      timeline = gsap
        .timeline({ delay: 0.2 })
        .to(lines, { yPercent: 0, duration: 1, ease: "power3.out", stagger: 0.35 })
        .to(foot, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.7);
    });
    return () => {
      cancel();
      timeline?.kill();
      gsap.set([...lines, foot], { clearProps: "transform,opacity" });
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const headline = headlineRef.current;
    if (!headline) return;
    let activeDrag = null;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const letter = event.target.closest(".landing-letter");
      if (!letter || !headline.contains(letter)) return;
      event.preventDefault();
      const line = letter.closest(".landing-line");
      line.classList.add("has-floating-letter");
      letter.classList.remove("is-throwing");
      gsap.killTweensOf(letter);
      activeDrag = {
        letter,
        line,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        baseX: Number(gsap.getProperty(letter, "x")) || 0,
        baseY: Number(gsap.getProperty(letter, "y")) || 0,
        baseRotation: Number(gsap.getProperty(letter, "rotation")) || 0,
        velocityX: 0,
        velocityY: 0,
        moved: false,
      };
      letter.classList.add("is-dragging");
      letter.setPointerCapture?.(event.pointerId);
      gsap.to(letter, { scale: 1.08, duration: 0.12, overwrite: true });
    };

    const onPointerMove = (event) => {
      const drag = activeDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      const now = performance.now();
      const elapsed = Math.max(1, now - drag.lastTime);
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.velocityX = ((event.clientX - drag.lastX) / elapsed) * 16;
      drag.velocityY = ((event.clientY - drag.lastY) / elapsed) * 16;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.lastTime = now;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
      gsap.set(drag.letter, {
        x: drag.baseX + dx,
        y: drag.baseY + dy,
        rotation: drag.baseRotation + clamp(dx * 0.08, -24, 24),
        scale: 1.08,
      });
    };

    const finishDrag = (throwLetter) => {
      const drag = activeDrag;
      if (!drag) return;
      activeDrag = null;
      drag.letter.classList.remove("is-dragging");
      drag.letter.classList.add("is-throwing");
      const dx = drag.lastX - drag.startX;
      const dy = drag.lastY - drag.startY;

      if (throwLetter && drag.moved) {
        window.dispatchEvent(new CustomEvent("landing-letter-throw", {
          detail: {
            clientX: drag.lastX,
            clientY: drag.lastY,
            velocityX: drag.velocityX + clamp(dx * 0.12, -20, 20),
            velocityY: drag.velocityY + clamp(dy * 0.12, -20, 20),
          },
        }));
      }

      const flightX = throwLetter && drag.moved ? clamp(drag.velocityX * 5, -280, 280) : 0;
      const flightY = throwLetter && drag.moved ? clamp(drag.velocityY * 5, -260, 260) : 0;
      const rotation = throwLetter && drag.moved
        ? drag.baseRotation + clamp(drag.velocityX * 0.7 + dx * 0.08, -150, 150)
        : drag.baseRotation;
      gsap.timeline()
        .to(drag.letter, {
          x: drag.baseX + dx + flightX,
          y: drag.baseY + dy + flightY,
          rotation,
          scale: 1,
          duration: throwLetter && drag.moved ? 0.24 : 0.12,
          ease: "power2.out",
        })
        .to(drag.letter, {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: throwLetter && drag.moved ? 0.85 : 0.45,
          ease: "elastic.out(1, 0.45)",
          onComplete: () => {
            drag.letter.classList.remove("is-throwing");
            drag.line.classList.remove("has-floating-letter");
          },
        });
    };

    const onPointerUp = (event) => {
      if (activeDrag && event.pointerId === activeDrag.pointerId) finishDrag(true);
    };
    const onPointerCancel = (event) => {
      if (activeDrag && event.pointerId === activeDrag.pointerId) finishDrag(false);
    };
    headline.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      headline.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      if (activeDrag) {
        activeDrag.letter.classList.remove("is-dragging");
        activeDrag.line.classList.remove("has-floating-letter");
        gsap.killTweensOf(activeDrag.letter);
        gsap.set(activeDrag.letter, { clearProps: "transform" });
      }
    };
  }, [reduced]);

  const seeWork = (event) => {
    const work = document.getElementById("work");
    if (!work) return;
    event.preventDefault();
    if (window.__two26Lenis) window.__two26Lenis.scrollTo(work);
    else work.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className={`landing ${reduced ? "is-static" : ""}`}>
      <section ref={heroRef} className="landing-hero" aria-labelledby="landing-hero-h">
        <RopeCanvas slackRef={slackRef} aboveRef={headlineRef} belowRef={introRef} diveRef={diveRef} />
        <div className="landing-wrap landing-hero-inner">
          <h1 ref={headlineRef} id="landing-hero-h" className="landing-headline" aria-label="Hi, I’m Prajwal Kunwor">
            <span className="landing-line" aria-hidden="true">
              <span className="landing-line-inner">{renderLetters("Hi, I’m", "hello")}</span>
            </span>
            <span className="landing-line" aria-hidden="true">
              <span className="landing-line-inner">
                {renderLetters("Prajwal ", "name")}
                <br className="landing-phone-break" />
                {renderLetters("Kunwor", "surname")}
              </span>
            </span>
          </h1>
          <div ref={introRef} className="landing-foot">
            <div className="landing-foot-inner">
              <div className="landing-actions">
                {cta}
              </div>
            </div>
          </div>
          <div className="landing-scroll-cue" aria-hidden="true">Scroll</div>
        </div>
      </section>
      <LandingDive diveRef={diveRef} heroRef={heroRef} headlineRef={headlineRef} introRef={introRef} reduced={reduced} />
    </div>
  );
}
