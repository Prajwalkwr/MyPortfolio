import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  projects,
  serviceData,
  profile,
  faqs,
  aboutText,
  showcaseSlides,
} from "./data";
import "./styles.css";
gsap.registerPlugin(ScrollTrigger);
const A = "/assets/";

/* ---------- shared pieces, matching the reference markup ---------- */

const strokePath =
  "M0 21.5571C0 21.5571 6.56744 2.8501 15.4762 4.44988C25.7691 6.2982 5.66141 21.3471 12.5002 29.1915C22.9246 41.1486 29.3907 -7.93025 42.4603 1.12139C53.3211 8.6432 27.1823 26.7575 37.6982 34.7461C50.754 44.6641 58.0718 -7.92618 67.2619 5.59531C72.4564 13.2381 57.9637 30.3713 67.2619 30.3713C70.8333 30.3713 75 19.753 75 19.753";

const arrowSvg = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path
      d="M1.46439 8.53621L8.53546 1.46515M3.05538 1.28837L8.53546 1.46515L8.71223 6.94522"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function NavLink({ to, children, onClick }) {
  const pathRef = useRef(null);
  const tlRef = useRef(null);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    gsap.set(path, { strokeWidth: 0, strokeDasharray: len, strokeDashoffset: len });
    tlRef.current = gsap
      .timeline({ paused: true, defaults: { ease: "power1.inOut" } })
      .to(path, { strokeDashoffset: 0, strokeWidth: 24, duration: 0.5 });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      path.style.strokeDashoffset = 0;
      path.style.strokeWidth = "24px";
    }
  }, []);
  const play = () => tlRef.current?.timeScale(1).play();
  const reverse = () => tlRef.current?.timeScale(1.4).reverse();
  return (
    <Link
      to={to}
      className="navbar-link-btn"
      onClick={onClick}
      onMouseEnter={play}
      onMouseLeave={reverse}
      onFocus={play}
      onBlur={reverse}
    >
      <div className="navlink-text">{children}</div>
      <div className="stroke-fill" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 75 36" fill="none">
          <path ref={pathRef} d={strokePath} stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
        </svg>
      </div>
    </Link>
  );
}

function CtaButton({ onClick, className = "", label = "Let's Talk", as = "a" }) {
  const ref = useRef(null);
  const arrowRef = useRef(null);
  const fillRef = useRef(null);
  const loopRef = useRef(null);
  const enter = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(fillRef.current, { scale: 10, duration: 0.55, ease: "power2.out", overwrite: "auto" });
    loopRef.current?.kill();
    gsap.set(arrowRef.current, { transformOrigin: "center center" });
    loopRef.current = gsap
      .timeline({ repeat: -1, repeatDelay: 0.2 })
      .to(arrowRef.current, { rotation: -25, duration: 0.22, ease: "power2.out" })
      .to(arrowRef.current, { rotation: 0, duration: 0.4, ease: "back.out(2.5)" });
  };
  const move = (e) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    gsap.to(el, {
      x: (e.clientX - cx) * 0.35,
      y: (e.clientY - cy) * 0.35,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to([el.querySelector(".cta-text"), el.querySelector(".cta-btn-arrow")], {
      x: (e.clientX - cx) * 0.15,
      y: (e.clientY - cy) * 0.15,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };
  const leave = () => {
    loopRef.current?.kill();
    loopRef.current = null;
    const el = ref.current;
    if (!el) return;
    gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1.1,0.4)", overwrite: "auto" });
    gsap.to([el.querySelector(".cta-text"), el.querySelector(".cta-btn-arrow")], {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: "elastic.out(1.1,0.4)",
      overwrite: "auto",
    });
    gsap.to(el.querySelector(".cta-btn-arrow"), { rotation: 0, duration: 0.35, ease: "power2.out", overwrite: "auto" });
    gsap.to(fillRef.current, { scale: 1, duration: 0.45, ease: "power2.out", overwrite: "auto" });
  };
  const props = {
    ref,
    className: `cta-btn ${className}`,
    onMouseEnter: enter,
    onMouseMove: move,
    onMouseLeave: leave,
    onFocus: enter,
    onBlur: leave,
  };
  const inner = (
    <>
      <div className="cta-text">{label}</div>
      <div className="cta-btn-arrow" ref={arrowRef}>
        {arrowSvg}
      </div>
      <div className="cta-btn-fill-hover" ref={fillRef} />
    </>
  );
  if (as === "button")
    return (
      <button type="button" {...props} onClick={onClick}>
        {inner}
      </button>
    );
  return (
    <a
      href="#contact"
      {...props}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      {inner}
    </a>
  );
}

function Header({ onContact }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) {
      gsap.fromTo(".ham-navbar", { yPercent: -6, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: "power2.out" });
    }
  }, [open]);
  return (
    <header className="header">
      <nav className="navbar-wrap">
        <div className="navbar-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/work">Work</NavLink>
          <NavLink to="/about">About</NavLink>
        </div>
        <div className="navbar-right">
          <div className="navbar-timing">
            Based in
            <br />
            Kathmandu, Nepal
          </div>
          <div className="cta-wrap">
            <CtaButton onClick={onContact} />
          </div>
          <div className="ham-btn">
            <button
              className="two26-nav-toggle-btn"
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(!open)}
            >
              <svg className="two26-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line className="menu-icon-line menu-icon-line-top" x1="3" y1="6" x2="21" y2="6" />
                <line className="menu-icon-line menu-icon-line-middle" x1="3" y1="12" x2="21" y2="12" />
                <line className="menu-icon-line menu-icon-line-bottom" x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <nav id="mobile-menu" className={`ham-navbar ${open ? "is-open" : ""}`}>
          <div className="hamburger-links">
            <NavLink to="/" onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/work" onClick={() => setOpen(false)}>
              Work
            </NavLink>
            <NavLink to="/about" onClick={() => setOpen(false)}>
              About
            </NavLink>
            <CtaButton
              onClick={() => {
                setOpen(false);
                onContact();
              }}
              className="ham-cta"
            />
          </div>
        </nav>
      </nav>
    </header>
  );
}

function ContactModal({ close }) {
  const closingRef = useRef(false);
  const closeAnimated = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    gsap.to(".contact-wipe-path", { strokeWidth: 0, duration: 0.7, ease: "power2.inOut", onComplete: close });
  };
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeAnimated();
    window.addEventListener("keydown", onKey);
    window.__two26Lenis?.stop();
    gsap.set(".contact-wipe-path", { strokeWidth: 0 });
    gsap
      .timeline()
      .to(".contact-wipe-path", { strokeWidth: 1700, duration: 0.95, ease: "power2.inOut" })
      .to(".modal-layer", { opacity: 1, duration: 0.25 }, 0.5)
      .fromTo(
        ".modal-copy h2,.modal-copy .hello,.modal-emails>*,.modal-social>*",
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: "power3.out" },
        0.3
      );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.__two26Lenis?.start();
    };
  }, []);
  return (
    <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Contact Prajwal" onMouseDown={(e) => e.target === e.currentTarget && closeAnimated()}>
      <svg className="contact-wipe" viewBox="0 0 998 901" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path
          className="contact-wipe-path"
          d="M372.5 886C372.5 886 879.181 886 855 766.5C801.982 504.5 19.5 1042.52 19.5 646.5C19.5 316.5 952.535 583.56 978 318.5C1000 89.5 193.6 431.263 111 221C34.6544 26.6589 565 19 565 19"
          fill="none"
          stroke="#FF5400"
          strokeLinecap="round"
          strokeWidth="1700"
        />
      </svg>
      <div className="modal-layer">
        <div className="modal-top">
          <Link to="/" className="modal-home-link" onClick={closeAnimated}>Home</Link>
          <button onClick={closeAnimated} className="modal-close">
            <span aria-hidden="true">×</span>Close
          </button>
        </div>
        <div className="modal-content">
          <div className="modal-copy">
            <p className="modal-kicker">Get in touch</p>
            <h2>Have an<br />idea<br />or a<br />project?</h2>
            <p className="hello">or just say hello!</p>
          </div>
          <div className="modal-side">
            <div className="modal-emails">
              <span>Email</span>
              <a href={`mailto:${profile.email}?subject=Hello%20Prajwal`}>{profile.email}</a>
              <span>Phone</span>
              <a href={profile.phoneHref}>{profile.phone}</a>
            </div>
            <img className="modal-image" src={A + "6aaad679fdb9d914f7f5206b_contact.svg"} alt="" aria-hidden="true" />
          </div>
        </div>
        <div className="modal-social">
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={profile.instagram} target="_blank" rel="noreferrer">Instagram</a>
        </div>
      </div>
    </div>
  );
}

const cardMaskPath =
  "M25.007 729.507C25.007 729.507 136.507 1065.7 290.007 969.007C506.711 832.495 -164.765 175.16 89.5069 44.5066C315.057 -71.3883 462.507 559.507 615.507 515.007C768.507 470.507 615.507 25.0068 615.507 25.0068";

function DeferredImage({ src, ...props }) {
  const imageRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "200px" }
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  return <img ref={imageRef} {...props} src={visible ? src : undefined} loading="lazy" decoding="async" />;
}

function ProjectCard({ p, i }) {
  const CardLink = p.url ? "a" : Link;
  const cardLinkProps = p.url
    ? { href: p.url, target: "_blank", rel: "noopener noreferrer" }
    : { to: "/work" };

  return (
    <div className="project-item" role="listitem">
      <div className="project-card-clip-mask">
        <CardLink
          {...cardLinkProps}
          className={`project-card${p.screenshot ? " project-card-screenshot" : ""}`}
          aria-label={`${p.name} — ${p.type}${p.url ? " (opens in a new tab)" : ""}`}
        >
          <div className="project-card-img-wrapper">
            <DeferredImage className="project-img-hover" src={A + p.hover} alt="" />
            <div className="project-img-svg">
              <svg width="100%" height="100%" viewBox="0 0 728 1020" fill="none" preserveAspectRatio="xMidYMid slice">
                <path
                  className="project-hover-path"
                  d={cardMaskPath}
                  stroke="currentColor"
                  strokeWidth="50"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <DeferredImage className="project-img" src={A + p.img} alt={`${p.name} website preview`} />
          </div>
          <div className="project-detail">
            <div className="project-logo">
              {p.mark ? (
                <img className="project-logo-img" src={A + p.mark} alt="" loading="lazy" />
              ) : (
                <span className="project-logo-text" aria-hidden="true">{p.monogram}</span>
              )}
            </div>
            <div className="project-detail-header">
              <div className="project-detail-btm">
                <div className="project-name-text">{p.name}</div>
              </div>
              <div className="project-detail-text">{p.type}</div>
            </div>
            <div className="projects-arrow">
              <svg width="100%" viewBox="0 0 20 20" fill="none">
                <path
                  d="M1.17273 17.9405L18.6533 2.29983M5.84177 1.17288L18.6533 2.29983L18.3543 15.1573"
                  stroke="currentColor"
                  strokeWidth="2.34564"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </CardLink>
      </div>
    </div>
  );
}

/* runs onChange(true/false) as el enters/leaves the viewport; returns a disconnect function */
function watchVisibility(el, onChange, rootMargin = "100px 0px") {
  if (!el || !("IntersectionObserver" in window)) {
    onChange(true);
    return () => {};
  }
  const observer = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), { rootMargin });
  observer.observe(el);
  return () => observer.disconnect();
}

/* runs start() now, or once the intro preloader has lifted if it is still covering the page */
function afterPreloader(start) {
  if (!document.body.classList.contains("preloader-active")) {
    start();
    return () => {};
  }
  window.addEventListener("preloader:reveal", start, { once: true });
  return () => window.removeEventListener("preloader:reveal", start);
}

function HeroMarquee() {
  const wrapRef = useRef(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const bgPath = wrap.querySelector(".hero-marquee-bg");
    const maskPath = wrap.querySelector(".hero-marquee-mask-path");
    const textPath = wrap.querySelector(".hero-marquee-tp");
    const textGroup = wrap.querySelector(".hero-marquee-text-group");
    const unit = wrap.querySelector(".marquee-unit");
    if (!bgPath || !maskPath || !textPath) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = () => {
      const len = bgPath.getTotalLength();
      gsap.set([bgPath, maskPath], { strokeDasharray: len, strokeDashoffset: 0 });
      gsap.fromTo(
        [bgPath, maskPath],
        { strokeDashoffset: -len },
        {
          strokeDashoffset: 0,
          delay: window.innerWidth < 991 ? 0.3 : 0,
          duration: 1.3,
          ease: "power2.out",
          scrollTrigger: { trigger: wrap, start: "top 85%", once: true },
          onComplete: () => textGroup && textGroup.removeAttribute("mask"),
        }
      );
    };
    if (reduced) {
      gsap.set([bgPath, maskPath], { strokeDasharray: "none", strokeDashoffset: 0 });
      gsap.set(textPath, { attr: { startOffset: -394.875 } });
      return;
    }
    const cancelReveal = afterPreloader(reveal);
    const unitLength = unit ? unit.getComputedTextLength() : 1600;
    const loop = gsap.to(textPath, {
      attr: { startOffset: -unitLength - 394.875 },
      duration: unitLength / 75,
      ease: "none",
      repeat: -1,
    });
    // re-laying out SVG textPath every frame is costly on phones; skip it while off screen
    const stopWatching = watchVisibility(wrap, (visible) => (visible ? loop.resume() : loop.pause()));
    return () => {
      cancelReveal();
      stopWatching();
      loop.kill();
      gsap.killTweensOf([bgPath, maskPath]);
    };
  }, []);

  const label = "LET’S BUILD SOMETHING USEFUL \u00a0•\u00a0 ALWAYS LEARNING \u00a0•\u00a0 ";
  return (
    <div className="hero-marquee" aria-hidden="true" ref={wrapRef}>
      <svg viewBox="0 0 1440 370" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path
            id="hero-marquee-curve"
            d="M-43.0867 292.81C179.631 174.299 464.078 116.458 712.699 90.6403C934.59 67.5984 1166.5 74.6231 1436.89 105.117 L 5000 507"
            fill="none"
          />
          <mask id="hero-marquee-text-mask" maskUnits="userSpaceOnUse">
            <path
              className="hero-marquee-mask-path"
              d="M-43.0867 292.81C179.631 174.299 464.078 116.458 712.699 90.6403C934.59 67.5984 1166.5 74.6231 1436.89 105.117"
              stroke="#FFFFFF"
              strokeWidth="220"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </mask>
        </defs>
        <path
          className="hero-marquee-bg"
          d="M-43.0867 292.81C179.631 174.299 464.078 116.458 712.699 90.6403C934.59 67.5984 1166.5 74.6231 1436.89 105.117"
          stroke="#FF5400"
          strokeWidth="154"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <g className="hero-marquee-text-group" mask="url(#hero-marquee-text-mask)">
          <text
            className="hero-marquee-text"
            fill="#FFFFFF"
            dominantBaseline="central"
            alignmentBaseline="central"
            fontSize="80"
            fontWeight="800"
          >
            <textPath
              href="#hero-marquee-curve"
              className="hero-marquee-tp"
              startOffset="-394.875"
              dominantBaseline="central"
              alignmentBaseline="central"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                <tspan className="marquee-unit" key={k}>
                  {label}
                </tspan>
              ))}
            </textPath>
          </text>
        </g>
      </svg>
    </div>
  );
}

function ShowcaseVideo({ src, alt }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setPlayback = (shouldPlay) => {
      if (disposed) return;
      if (!shouldPlay) {
        video.pause();
        return;
      }
      if (!video.hasAttribute("src")) {
        video.src = A + src;
        video.load();
      }
      if (!reducedMotion.matches) {
        video.play().catch((error) => {
          if (error.name !== "AbortError") console.error("Showcase video playback failed.", error);
        });
      } else {
        video.pause();
      }
    };

    if (!("IntersectionObserver" in window)) {
      setPlayback(true);
      return () => {
        disposed = true;
        video.pause();
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setPlayback(entry.isIntersecting),
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(video);

    return () => {
      disposed = true;
      observer.disconnect();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return <video ref={videoRef} className="showcase-slide-img" preload="none" loop muted playsInline aria-label={alt} />;
}

function HeroChars({ text }) {
  return text.split("").map((c, i) => (
    <ThrowOnDrag className="hero-letter" key={i}>
      <span className="hero-char">{c === " " ? "\u00a0" : c}</span>
    </ThrowOnDrag>
  ));
}

function DraggableChars({ text }) {
  return text.split("").map((character, i) =>
    character === " " ? (
      <span className="hero-pill-space" key={i}>{"\u00a0"}</span>
    ) : (
      <ThrowOnDrag className="hero-pill-letter" key={i}>{character}</ThrowOnDrag>
    )
  );
}

function ThrowOnDrag({ children, className = "" }) {
  const ref = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => () => gsap.killTweensOf(ref.current), []);

  const handlePointerDown = (event) => {
    const element = ref.current;
    if (!element) return;
    gsap.killTweensOf(element);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      x: Number(gsap.getProperty(element, "x")) || 0,
      y: Number(gsap.getProperty(element, "y")) || 0,
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    const element = ref.current;
    if (!drag || drag.pointerId !== event.pointerId || !element) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.pointerX, event.clientY - drag.pointerY) < 4) return;

    const elapsed = Math.max((event.timeStamp - drag.lastTime) / 1000, 0.008);
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.moved = true;
    drag.vx = deltaX / elapsed;
    drag.vy = deltaY / elapsed;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.x += deltaX;
    drag.y += deltaY;
    gsap.set(element, { x: drag.x, y: drag.y });
  };

  const returnToOrigin = (element) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: reducedMotion ? 0.2 : 0.8,
      ease: reducedMotion ? "power1.out" : "elastic.out(1, 0.45)",
      overwrite: true,
    });
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    const element = ref.current;
    if (!drag || drag.pointerId !== event.pointerId || !element) return;
    dragRef.current = null;
    if (!drag.moved) {
      returnToOrigin(element);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(element, {
      x: drag.x + (reducedMotion ? 0 : gsap.utils.clamp(-220, 220, drag.vx * 0.16)),
      y: drag.y + (reducedMotion ? 0 : gsap.utils.clamp(-180, 180, drag.vy * 0.16)),
      duration: reducedMotion ? 0.15 : 0.3,
      ease: "power2.out",
      overwrite: true,
      onComplete: () => returnToOrigin(element),
    });
  };

  const handlePointerCancel = (event) => {
    const drag = dragRef.current;
    const element = ref.current;
    if (!drag || drag.pointerId !== event.pointerId || !element) return;
    dragRef.current = null;
    returnToOrigin(element);
  };

  return (
    <span
      ref={ref}
      className={`throwable-text ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {children}
    </span>
  );
}

function SectionHeader({ kicker, title, className = "" }) {
  return (
    <div className="section-projects-header">
      <div className="section-about-text">{kicker}</div>
      <div className="section-heading-wrapper">
        <h2 className={`section-heading ${className}`}>{title}</h2>
      </div>
    </div>
  );
}

/* ------------------------------- homepage ------------------------------- */

function HomePage({ openContact }) {
  const [activeFaq, setActiveFaq] = useState(0);
  const aboutRef = useRef(null);

  /* ---------------- scroll / entrance animations ---------------- */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lenis = null;
    let raf;
    let cancelled = false;
    if (!reduced) {
      import("lenis")
        .then(({ default: Lenis }) => {
          if (cancelled) return;
          lenis = new Lenis({ duration: 1.1, smoothWheel: true });
          window.__two26Lenis = lenis;
          if (document.body.classList.contains("preloader-active")) lenis.stop();
          lenis.on("scroll", ScrollTrigger.update);
          raf = (t) => lenis.raf(t * 1000);
          gsap.ticker.add(raf);
          gsap.ticker.lagSmoothing(0);
        })
        .catch((error) => console.error("Smooth scrolling could not be initialized.", error));
    }
    const mm = gsap.matchMedia();
    let galleryTicker, galleryResize, galleryObserver, onPreloaderReveal, stopHeroIdleWatch;
    const ctx = gsap.context(() => {
      /* hero entrance */
      const heroTl = gsap.timeline({
        defaults: { ease: "power2.out" },
        paused: reduced,
      });
      let heroReady = false;
      /* idle loops record the letters' and labels' current transform as their resting point,
         so they may only start once the entrance (which waits for the preloader) has landed */
      const startHeroIdle = () => {
        if (reduced) return;
        const after = (delay) => Math.max(0, delay - heroTl.duration());
        const loops = [];
        ctx.add(() => {
          /* headline: a soft wave runs through the letters every few seconds */
          loops.push(
            gsap
              .timeline({ repeat: -1, repeatDelay: 4, delay: after(2.6) })
              .to(".hero-char", { yPercent: -10, duration: 0.25, stagger: 0.04, ease: "power2.out", yoyo: true, repeat: 1 })
          );
          loops.push(gsap.to(".hero-heading-spark", { rotate: 14, transformOrigin: "0% 100%", duration: 0.5, repeat: -1, yoyo: true, repeatDelay: 1.2, ease: "sine.inOut", delay: after(1.6) }));
          /* labels float gently once they have landed */
          gsap.utils.toArray(".hero-pill").forEach((pill, i) => {
            loops.push(gsap.to(pill, { y: -6, duration: 1.8 + i * 0.3, delay: after(1.6 + i * 0.2), repeat: -1, yoyo: true, ease: "sine.inOut" }));
          });
        });
        stopHeroIdleWatch = watchVisibility(document.querySelector(".section-hero"), (visible) =>
          loops.forEach((loop) => (visible ? loop.resume() : loop.pause()))
        );
      };
      heroTl
        .fromTo(
          ".hero-char",
          { yPercent: 110, rotate: 8, opacity: 0 },
          { yPercent: 0, rotate: 0, opacity: 1, duration: 0.8, stagger: 0.035, ease: "back.out(1.6)" }
        )
        .fromTo(".hero-heading-spark path", { strokeDasharray: 40, strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.35, stagger: 0.1, ease: "power2.out" }, 0.7)
        .fromTo(".hero-pill", { opacity: 0, scale: 0.4, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, stagger: 0.18, ease: "back.out(2.5)" }, 0.45)
        .fromTo(".hero-pill-text", { yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.18, ease: "back.out(1.6)" }, 0.6)
        .fromTo(".hero-bg-img", { scale: 1.08 }, { scale: 1, duration: 1.1, ease: "power3.out" }, 0)
        .fromTo(".hero-scene-floor", { opacity: 0 }, { opacity: 1, duration: 1 }, 0.3)
        .call(() => {
          gsap.set(".hero-line-mask", { overflow: "visible" });
          heroReady = true;
          startHeroIdle();
        });
      if (reduced) {
        heroTl.progress(1);
      } else if (document.body.classList.contains("preloader-active")) {
        heroTl.pause(0);
        onPreloaderReveal = () => heroTl.play();
        window.addEventListener("preloader:reveal", onPreloaderReveal, { once: true });
      }
      if (!reduced) {
        /* headline: letters lift and turn orange under the pointer */
        gsap.utils.toArray(".hero-char").forEach((char) => {
          const base = getComputedStyle(char).color;
          char.addEventListener("pointerenter", () => {
            if (!heroReady) return;
            gsap.to(char, { y: -char.offsetHeight * 0.14, rotate: gsap.utils.random(-6, 6), color: "#FF5400", duration: 0.25, ease: "power2.out", overwrite: "auto" });
          });
          char.addEventListener("pointerleave", () => {
            if (!heroReady) return;
            gsap.to(char, { y: 0, rotate: 0, color: base, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
          });
        });
        gsap.to(".hero-scene-bg", {
          yPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: ".section-hero", start: "top top", end: "bottom top", scrub: true },
        });
      }
      /* hero marquee: ribbon draw + masked text reveal + loop is handled by <HeroMarquee /> */

      /* about: character reveal + pills */
      if (!reduced)
        mm.add(
          { desktop: "(min-width: 992px)", tablet: "(min-width: 480px) and (max-width: 991px)", mobile: "(max-width: 479px)" },
          () => {
            const section = aboutRef.current;
            if (!section) return;
            const chars = Array.from(section.querySelectorAll(".about-char"));
            const pills = section.querySelectorAll(".about-pill");
            const tablet = window.innerWidth < 992;
            const mobile = window.innerWidth < 480;
            const dist = mobile ? 1150 : tablet ? 1550 : 2200;
            const scrollerEl = document.querySelector(".page") || window;
            const spacer = document.createElement("div");
            spacer.className = "about-pin-spacer";
            if (scrollerEl === window) {
              spacer.style.height = `${dist}px`;
            } else {
              spacer.style.height = `${dist}px`;
            }
            section.parentNode.insertBefore(spacer, section.nextSibling);
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                scroller: scrollerEl,
                start: "center center",
                end: `+=${dist}`,
                pin: section,
                pinSpacing: false,
                scrub: tablet ? 0.6 : 0.8,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });
            const total = chars.length || 1;
            chars.forEach((char, i) => {
              const start = (i / total) * 85;
              tl.to(char, { color: "#FF5400", scale: 1.12, duration: 3.5, ease: "power1.out" }, start).to(
                char,
                { color: "#000", scale: 1, duration: 3.5, ease: "power1.inOut" },
                start + 3.5
              );
            });
            const rotations = [4, -4, -4.5];
            pills.forEach((pill, i) =>
              tl.fromTo(
                pill,
                { opacity: 0, scale: 0.6, y: 24, rotation: rotations[i], transformOrigin: "center center" },
                { opacity: 1, scale: 1, y: 0, rotation: rotations[i], duration: 6, ease: "back.out(2)" },
                [35, 72, 96][i]
              )
            );
            return () => {
              tl.scrollTrigger?.kill();
              spacer.remove();
            };
          }
        );

      /* showcase marquee: idle drift + scroll velocity, direction follows scroll, centre cards dip to 0.95 */
      (() => {
        const wrapper = document.querySelector(".section-slider-wrapper");
        const track = document.querySelector(".showcase-slider");
        if (!wrapper || !track) return;
        const slides = Array.from(track.querySelectorAll(".showcase-slide"));
        if (!slides.length) return;
        const initialCount = slides.length / 3;
        let setWidth = 0;
        let x = 0, targetDir = -1, dir = -1, boost = 0;
        let slideCenters = [];
        let slideHalfWidths = [];
        let wrapperCenter = 0;
        let wrapperHalf = 0;
        const measure = () => {
          const first = slides[0];
          const clone = slides[initialCount];
          const d = clone && first ? clone.offsetLeft - first.offsetLeft : 0;
          setWidth = d > 0 ? d : track.scrollWidth / 3;
          const wrapperRect = wrapper.getBoundingClientRect();
          wrapperCenter = wrapperRect.left + wrapperRect.width / 2;
          wrapperHalf = wrapperRect.width * 0.45 || 400;
          slides.forEach((slide, i) => {
            const rect = slide.getBoundingClientRect();
            slideCenters[i] = rect.left - x + rect.width / 2;
            slideHalfWidths[i] = rect.width / 2;
          });
        };
        measure();
        galleryResize = () => {
          measure();
          ScrollTrigger.refresh();
        };
        window.addEventListener("resize", galleryResize);
        window.addEventListener("load", measure);
        if (!reduced) {
          ScrollTrigger.create({
            trigger: document.body,
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
              targetDir = self.direction === 1 ? -1 : 1;
              boost = Math.min(Math.abs(self.getVelocity() || 0) / 220, 10) * targetDir;
            },
          });
          galleryTicker = () => {
            dir += (targetDir - dir) * 0.06;
            boost *= 0.92;
            x += 1.5 * dir + boost;
            if (setWidth > 0) {
              while (x <= -setWidth) x += setWidth;
              while (x > 0) x -= setWidth;
            }
            gsap.set(track, { x, force3D: true });
            slides.forEach((slide, i) => {
              const distance = Math.abs(slideCenters[i] + x - wrapperCenter);
              if (distance > wrapperHalf + slideHalfWidths[i]) return;
              const norm = Math.min(1, distance / wrapperHalf);
              gsap.set(slide, { scale: 0.95 + 0.05 * norm, force3D: true });
            });
          };
          let galleryActive = false;
          const setGalleryActive = (active) => {
            if (active === galleryActive) return;
            galleryActive = active;
            if (active) gsap.ticker.add(galleryTicker);
            else gsap.ticker.remove(galleryTicker);
          };
          if ("IntersectionObserver" in window) {
            galleryObserver = new IntersectionObserver(
              ([entry]) => setGalleryActive(entry.isIntersecting),
              { rootMargin: "150px 0px" }
            );
            galleryObserver.observe(wrapper);
          } else {
            setGalleryActive(true);
          }
        }
      })();

      /* project cards: clip-mask + 3d tilt reveal (reversible, like the reference) */
      if (!reduced) {
        gsap.utils.toArray(".project-card-clip-mask").forEach((mask, i) => {
          const card = mask.querySelector(".project-card");
          gsap.set(mask, {
            clipPath: "inset(42.5% 42.5% 42.5% 42.5%)",
            webkitClipPath: "inset(42.5% 42.5% 42.5% 42.5%)",
            borderRadius: "36px",
            overflow: "hidden",
            willChange: "clip-path, border-radius",
          });
          gsap.set(card, {
            scale: 1.45,
            rotateX: 25,
            rotateY: i % 2 === 0 ? -16 : 16,
            rotate: i % 2 === 0 ? -4 : 4,
            transformPerspective: 800,
            transformOrigin: "center center",
            willChange: "transform",
          });
          const cardTl = gsap.timeline({
            scrollTrigger: { trigger: mask, start: "top 85%", toggleActions: "play none none reverse", invalidateOnRefresh: true },
          });
          cardTl
            .to(mask, { clipPath: "inset(0% 0% 0% 0%)", webkitClipPath: "inset(0% 0% 0% 0%)", borderRadius: "0px", duration: 1.25, ease: "power3.out" }, 0)
            .to(card, { scale: 1, rotateX: 0, rotateY: 0, rotate: 0, duration: 1.25, ease: "power3.out" }, 0);
        });

        /* project card hover: brush stroke draw + image swap + arrow spring */
        gsap.utils.toArray(".project-card").forEach((card) => {
          const path = card.querySelector(".project-hover-path");
          const hoverImg = card.querySelector(".project-img-hover");
          const mainImg = card.querySelector(".project-img");
          const arrow = card.querySelector(".projects-arrow");
          if (!path) return;
          path.style.strokeLinecap = "round";
          path.style.strokeLinejoin = "round";
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, strokeWidth: 0 });
          if (arrow) gsap.set(arrow, { transformOrigin: "center center", rotation: 0, scale: 1 });
          const tl = gsap.timeline({ paused: true, defaults: { ease: "power1.inOut" } });
          tl.to(path, { strokeDashoffset: 0, strokeWidth: 340, duration: 0.95 }, 0)
            .to(hoverImg, { opacity: 1, duration: 0.5 }, 0.3)
            .to(mainImg, { opacity: 0, duration: 0.5 }, 0.3);
          if (arrow)
            tl.to(arrow, { rotation: -45, duration: 0.28, ease: "power2.out" }, 0)
              .to(arrow, { rotation: 0, duration: 0.65, ease: "elastic.out(1.15, 0.35)" }, 0.28);
          card.addEventListener("mouseenter", () => tl.timeScale(1).play());
          card.addEventListener("mouseleave", () => tl.timeScale(1.3).reverse());
        });
      }

      /* projects end: line-by-line heading, milestone pills, button */
      (() => {
        const endEl = document.querySelector(".projects-end");
        if (!endEl) return;
        const lines = gsap.utils.toArray(".projects-end .project-line");
        const pills = gsap.utils.toArray(".projects-end .projects-pill");
        const btn = endEl.querySelector(".project-btn");
        if (reduced) {
          gsap.set(lines, { opacity: 1, yPercent: 0 });
          gsap.set(pills, { opacity: 1, scale: 1, y: 0 });
          if (btn) gsap.set(btn, { opacity: 1, scale: 1, y: 0 });
          return;
        }
        gsap.set(lines, { yPercent: 115, opacity: 0 });
        pills.forEach((pill) => {
          gsap.set(pill, { opacity: 0, scale: 0.4, y: 20, transformOrigin: "center center" });
          const inner = pill.querySelector(".hero-pill-text");
          if (inner) gsap.set(inner, { opacity: 0, y: 15 });
        });
        if (btn) {
          gsap.set(btn, { opacity: 0, scale: 0.4, y: 20, transformOrigin: "center center" });
          const t = btn.querySelector(".cta-text");
          if (t) gsap.set(t, { opacity: 0, y: 15 });
        }
        const masterTl = gsap.timeline({
          paused: true,
          scrollTrigger: {
            trigger: endEl,
            start: "top 80%",
            toggleActions: "play none none none",
            invalidateOnRefresh: true,
            onEnter: () => masterTl.play(),
          },
        });
        masterTl.timeScale(0.75);
        masterTl.to(lines, { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.12, ease: "back.out(1.4)" }, 0);
        const totalLinesTime = lines.length * 0.12 + 0.5;
        pills.forEach((pill, i) => {
          const start = 0.2 + (i / Math.max(1, pills.length)) * totalLinesTime * 0.7;
          const inner = pill.querySelector(".hero-pill-text");
          masterTl.to(pill, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2.5)" }, start);
          if (inner) masterTl.to(inner, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }, start + 0.15);
        });
        if (btn) {
          const btnStart = totalLinesTime + 0.15;
          const t = btn.querySelector(".cta-text");
          masterTl.to(btn, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2.5)" }, btnStart);
          if (t) masterTl.to(t, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }, btnStart + 0.15);
        }
      })();

      /* services: scrubbed proximity expansion + drawn path (reference behaviour) */
      if (!reduced) {
        mm.add("(min-width: 993px)", () => {
          const bodyEl = document.querySelector(".section-services-body");
          if (!bodyEl) return;
          const layers = gsap.utils.toArray(".services-layers .service-layer");
          const darkPaths = gsap.utils.toArray(
            ".services-path-svg-dark path, .service-path-mobile-dark path"
          );
          darkPaths.forEach((path) => {
            path.style.strokeLinecap = "round";
            path.style.strokeLinejoin = "round";
            const len = path.getTotalLength ? path.getTotalLength() : 2500;
            gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          });
          const targets = [];
          layers.forEach((layer) => {
            const block = layer.querySelector(".service-block") || layer;
            const svg = block.querySelector(".service-svg");
            const para = block.querySelector(".service-block-para-wrapper");
            if (svg) {
              const natural = svg.getBoundingClientRect().width || 116;
              svg.dataset.targetWidth = natural;
              gsap.set(svg, { width: 0, scale: 0, opacity: 0, overflow: "hidden", margin: "0px" });
            }
            if (para) gsap.set(para, { scale: 0, rotation: 0, opacity: 0 });
            targets.push({ svg, para });
          });
          const masterTl = gsap.timeline({
            scrollTrigger: {
              trigger: bodyEl,
              start: "top 70%",
              end: "bottom 70%",
              scrub: 1.2,
              invalidateOnRefresh: true,
            },
          });
          masterTl.to(darkPaths, { strokeDashoffset: 0, ease: "none", duration: 1 }, 0);
          targets.forEach(({ svg, para }, i) => {
            const point = targets.length > 1 ? i / (targets.length - 1) : 0;
            const startAt = Math.max(0, point - 0.04);
            if (svg)
              masterTl.to(
                svg,
                { width: () => parseFloat(svg.dataset.targetWidth) || "auto", scale: 1, opacity: 1, duration: 0.14, ease: "back.out(3.5)" },
                startAt
              );
            if (para)
              masterTl.to(
                para,
                { scale: 1, rotation: -5, opacity: 1, duration: 0.14, ease: "back.out(3.5)" },
                startAt + 0.02
              );
          });
        });
      }

      /* faq: identical initial state to the reference accordion */
      gsap.utils.toArray(".faq-item").forEach((item, index) => {
        const q = item.querySelector(".question-block");
        const btm = item.querySelector(".faq-block-btm");
        const logo = item.querySelector(".faq-logo");
        const ans = item.querySelector(".faq-answer");
        if (index === 0) {
          gsap.set(q, { borderWidth: "1px", width: window.innerWidth >= 992 ? "50%" : "75%" });
          gsap.set(btm, { height: "auto", display: "flex", flexDirection: "row", justifyContent: "flex-end", overflow: "visible", scale: 1, opacity: 1, transformOrigin: "right bottom" });
          if (logo) gsap.set(logo, { scale: 1 });
          if (ans) gsap.set(ans, { opacity: 1, y: 0 });
        } else {
          gsap.set(q, { borderWidth: "0px", width: "100%" });
          gsap.set(btm, { height: 0, display: "none", overflow: "hidden", scale: 0, opacity: 0, transformOrigin: "right bottom" });
          if (logo) gsap.set(logo, { scale: 0 });
          if (ans) gsap.set(ans, { opacity: 0, y: 20 });
        }
      });

      /* footer: line reveal + elastic signature logo */
      (() => {
        const footerEl = document.querySelector(".footer");
        if (!footerEl || reduced) return;
        const lines = gsap.utils.toArray(".footer-heading-line");
        gsap.set(lines, { yPercent: 115, opacity: 0 });
        gsap.to(lines, {
          yPercent: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "back.out(1.6)",
          scrollTrigger: { trigger: footerEl, start: "top 80%", toggleActions: "play none none none", invalidateOnRefresh: true },
        });
        /* kinetic letter-pop hover on footer links (reference behaviour) */
        footerEl.querySelectorAll(".footer-link").forEach((link) => {
          if (link.closest(".footer-link-header") || link.querySelector(".footer-link-char")) return;
          if (!link.hasAttribute("aria-label")) link.setAttribute("aria-label", link.textContent.trim());
          Array.from(link.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
              const span = document.createElement("span");
              span.className = "footer-link-text-wrap";
              span.setAttribute("aria-hidden", "true");
              span.style.display = "inline-block";
              span.innerHTML = node.textContent
                .split("")
                .map((c) => (c === " " ? "&nbsp;" : `<span class="footer-link-char">${c}</span>`))
                .join("");
              node.parentNode.replaceChild(span, node);
            }
          });
          const chars = Array.from(link.querySelectorAll(".footer-link-char"));
          if (!chars.length) return;
          gsap.set(chars, { display: "inline-block", transformOrigin: "center center", scale: 1, rotation: 0, textShadow: "0px 0px 0px rgba(0,0,0,0)" });
          link.addEventListener("mouseenter", () => {
            chars.forEach((char, idx) => {
              gsap.to(char, {
                scale: 1.14,
                rotation: gsap.utils.random(-7, 7),
                textShadow: "0.4px 0.4px 0 currentColor, -0.4px -0.4px 0 currentColor, 0.4px -0.4px 0 currentColor, -0.4px 0.4px 0 currentColor",
                duration: 0.38,
                delay: idx * 0.035,
                ease: "back.out(1.8)",
                overwrite: "auto",
                onComplete: () =>
                  gsap.to(char, { scale: 1, rotation: 0, textShadow: "0px 0px 0px rgba(0,0,0,0)", duration: 0.5, ease: "power2.out", overwrite: "auto" }),
              });
            });
          });
          link.addEventListener("mouseleave", () => {
            gsap.to(chars, { scale: 1, rotation: 0, textShadow: "0px 0px 0px rgba(0,0,0,0)", duration: 0.35, stagger: 0.018, ease: "power2.out", overwrite: "auto" });
          });
        });

        const btmLogo = footerEl.querySelector(".footer-btm");
        if (btmLogo) {
          gsap.set(btmLogo, { scaleY: 0.15, transformOrigin: "bottom center", willChange: "transform" });
          let bounced = false;
          ScrollTrigger.create({
            trigger: footerEl,
            start: "top bottom",
            end: "bottom bottom",
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const vel = Math.abs(self.getVelocity() || 0);
              const velStretch = Math.min(vel / 1500, 0.25);
              if (self.progress >= 0.9) {
                if (!bounced) {
                  bounced = true;
                  gsap.killTweensOf(btmLogo);
                  gsap.to(btmLogo, { scaleY: 1, duration: 1.4, ease: "elastic.out(1.2, 0.35)", overwrite: "auto" });
                }
              } else {
                bounced = false;
                const base = self.direction === 1 ? 0.15 + self.progress * 1.15 + velStretch : 0.15 + self.progress * 0.95;
                gsap.to(btmLogo, {
                  scaleY: Math.max(0.15, Math.min(base, 1.4)),
                  duration: 0.1,
                  ease: "power1.out",
                  overwrite: "auto",
                });
              }
            },
            onLeaveBack: () => {
              bounced = false;
              gsap.killTweensOf(btmLogo);
              gsap.to(btmLogo, { scaleY: 0.15, duration: 0.25, ease: "power2.out", overwrite: "auto" });
            },
          });
        }
      })();

      if (reduced) {
        gsap.set(
          ".hero-line,.hero-char,.hero-pill,.hero-pill-text,.hero-bg-img,.project-card-clip-mask,.project-card,.project-line,.projects-pill,.footer-heading-line,.about-char,.service-svg,.service-block-para-wrapper,.footer-btm",
          { clearProps: "all", opacity: 1, scale: 1, y: 0, yPercent: 0, rotate: 0, rotateX: 0, rotateY: 0, strokeDashoffset: 0, clipPath: "none" }
        );
      }
      if (reduced) {
        gsap.set(".about-pill", { opacity: 1, scale: 1, y: 0, position: "static" });
      }
      ScrollTrigger.refresh();
      document.fonts?.ready?.then(() => ScrollTrigger.refresh());
    }, document.body);
    return () => {
      cancelled = true;
      ctx.revert();
      mm.revert();
      if (onPreloaderReveal) window.removeEventListener("preloader:reveal", onPreloaderReveal);
      stopHeroIdleWatch?.();
      galleryObserver?.disconnect();
      if (galleryTicker) gsap.ticker.remove(galleryTicker);
      if (galleryResize) window.removeEventListener("resize", galleryResize);
      if (lenis) {
        gsap.ticker.remove(raf);
        lenis.destroy();
        delete window.__two26Lenis;
      }
    };
  }, []);

  /* lottie service icons */
  useEffect(() => {
    let cancelled = false;
    let observer;
    let stopWatching = [];
    let animations = [];
    const loadAnimations = () => {
      import("lottie-web")
        .then(({ default: lottie }) => {
          if (cancelled) return;
          const autoplay = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const containers = [...document.querySelectorAll(".service-svg .lottie-animation")];
          animations = containers.map((el, i) =>
            lottie.loadAnimation({
              container: el,
              renderer: "svg",
              loop: true,
              autoplay,
              path: `${A}service-${i + 1}.json`,
            })
          );
          // seven looping SVG animations repaint every frame; each one only runs while it is on screen
          if (autoplay)
            stopWatching = containers.map((el, i) =>
              watchVisibility(el.closest(".service-block") || el, (visible) =>
                visible ? animations[i].play() : animations[i].pause()
              )
            );
        })
        .catch((error) => console.error("Service animations could not be loaded.", error));
    };

    const services = document.querySelector(".section-services");
    if (!services || !("IntersectionObserver" in window)) {
      loadAnimations();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            loadAnimations();
          }
        },
        { rootMargin: "200px 0px" }
      );
      observer.observe(services);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      stopWatching.forEach((stop) => stop());
      animations.forEach((animation) => animation.destroy());
    };
  }, []);

  /* ---------------- faq accordion (one always open, GSAP scrub) ---------------- */
  const openWidth = () => (window.innerWidth >= 992 ? "50%" : "75%");
  const faqOpen = (item) => {
    const q = item.querySelector(".question-block");
    const btm = item.querySelector(".faq-block-btm");
    const logo = item.querySelector(".faq-logo");
    const ans = item.querySelector(".faq-answer");
    item.classList.add("is-open");
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    gsap.set(q, { borderWidth: "1px", willChange: "width, border-width" });
    tl.to(q, { width: openWidth(), duration: 0.45 }, 0);
    gsap.set(btm, { display: "flex", flexDirection: "row", justifyContent: "flex-end", overflow: "hidden", opacity: 1, transformOrigin: "right bottom" });
    tl.fromTo(btm, { height: 0, scale: 0 }, { height: "auto", scale: 1, duration: 0.5, ease: "back.out(1.6)", onComplete: () => gsap.set(btm, { overflow: "visible" }) }, 0.05);
    tl.to(logo, { scale: 1, duration: 0.45, ease: "back.out(2)" }, 0.15);
    tl.to(ans, { opacity: 1, y: 0, duration: 0.4 }, 0.35);
  };
  const faqClose = (item) => {
    const q = item.querySelector(".question-block");
    const btm = item.querySelector(".faq-block-btm");
    const logo = item.querySelector(".faq-logo");
    const ans = item.querySelector(".faq-answer");
    item.classList.remove("is-open");
    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    tl.to(ans, { opacity: 0, y: 15, duration: 0.22, ease: "power2.in" }, 0);
    tl.to(logo, { scale: 0, duration: 0.25, ease: "power2.in" }, 0.12);
    gsap.set(btm, { overflow: "hidden" });
    tl.to(btm, { scale: 0, height: 0, opacity: 0, duration: 0.4, onComplete: () => gsap.set(btm, { display: "none" }) }, 0.15);
    tl.to(q, { width: "100%", borderWidth: "0px", duration: 0.45, ease: "power2.out" }, 0.18);
  };
  const toggleFaq = (i, el) => {
    const item = el.closest(".faq-item");
    if (!item || item.classList.contains("is-open")) return;
    const prev = el.closest(".faq-list").querySelector(".faq-item.is-open");
    if (prev) faqClose(prev);
    faqOpen(item);
    setActiveFaq(i);
  };

  return (
    <main className="page-home">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="section-hero">
        <div className="section-hero-wrapper">
          <div className="hero-text">
            <div className="hero-pill-position two">
              <div className="hero-pill"><span className="hero-pill-text"><DraggableChars text="BIM student" /></span></div>
            </div>
            <h1 className="heading" aria-label="Hi, I'm Prajwal Kunwor">
              <span className="hero-line-mask">
                <div className="hero-line" aria-hidden="true">
                  <HeroChars text="HI," />
                  {"\u00a0"}
                  <HeroChars text="I’M" />
                  <span className="hero-heading-spark" aria-hidden="true">
                    <svg viewBox="0 0 40 34" fill="none">
                      <path d="M4 32C10 24 20 14 34 6" stroke="#FF5400" strokeWidth="5" strokeLinecap="round" />
                      <path d="M15 28C19 21 26 14 34 10" stroke="#FF5400" strokeWidth="5" strokeLinecap="round" />
                      <path d="M26 25C30 20 34 16 38 14" stroke="#FF5400" strokeWidth="5" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
              </span>
              <span className="hero-line-mask">
                <div className="hero-line" aria-hidden="true">
                  <HeroChars text="PRAJWAL" />
                </div>
              </span>
              <span className="hero-line-mask">
                <div className="hero-line" aria-hidden="true">
                  <HeroChars text="KUNWOR" />
                </div>
              </span>
            </h1>
            <div className="hero-pill-position one">
              <div className="hero-pill"><span className="hero-pill-text"><DraggableChars text="Web developer" /></span></div>
            </div>
            <div className="hero-pill-position three">
              <div className="hero-pill"><span className="hero-pill-text"><DraggableChars text="Kathmandu, Nepal" /></span></div>
            </div>
          </div>

          {/* scenic illustration with a slow parallax */}
          <div className="hero-scene" aria-hidden="true">
            <div className="hero-scene-bg">
              <img
                className="hero-bg-img"
                src={A + "hero/hero-bg.webp"}
                srcSet={`${A}hero/hero-bg-480.webp 480w, ${A}hero/hero-bg-768.webp 768w, ${A}hero/hero-bg-1024.webp 1024w, ${A}hero/hero-bg-1440.webp 1440w, ${A}hero/hero-bg.webp 1672w`}
                sizes="(max-width: 991px) 150vw, 100vw"
                alt=""
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="hero-scene-floor" />
          </div>
        </div>
      </section>

      {/* ------------------------------ MARQUEE ----------------------------- */}
      <section className="section-hero-marquee">
        <HeroMarquee />
      </section>

      {/* ------------------------------- ABOUT ------------------------------ */}
      <section className="section-about" ref={aboutRef}>
        <div className="section-about-wrapper">
          <div className="about-pinned">
            <div className="about-text">A BIT ABOUT ME</div>
            <p className="about-para" aria-label={aboutText}>
              {aboutText.split(" ").map((word, wi) => (
                <React.Fragment key={wi}>
                  <span className="about-word" aria-hidden="true">
                    {word.split("").map((c, ci) => (
                      <span className="about-char" aria-hidden="true" key={ci}>
                        {c}
                      </span>
                    ))}
                  </span>{" "}
                </React.Fragment>
              ))}
            </p>
            <div className="about-pill second">
              <span className="hero-pill-text">Always learning</span>
            </div>
            <div className="about-pill first">
              <span className="hero-pill-text">Web development</span>
            </div>
            <div className="about-pill third">
              <span className="hero-pill-text">Real-world projects</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- SHOWCASE ----------------------------- */}
      <section className="section-slider-showcase">
        <div className="section-slider-wrapper">
          <div className="showcase-slider">
            {[...showcaseSlides, ...showcaseSlides, ...showcaseSlides].map((s, i) => (
              <div className={`showcase-slide ${i >= 6 ? "is-marquee-clone" : ""}`} key={i}>
                {s.video ? (
                  <ShowcaseVideo src={s.src} alt={s.alt} />
                ) : (
                  <DeferredImage className="showcase-slide-img" src={A + s.src} alt={s.alt} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- PROJECTS ----------------------------- */}
      <section className="section-projects" id="work">
        <div className="section-projects-wrapper">
          <SectionHeader kicker="Featured Projects" title="Selected Works" className="less-max-w" />
          <div className="projects-vertical-wrapper">
            <div className="projects-list" role="list">
              {projects.map((p, i) => (
                <ProjectCard p={p} i={i} key={p.slug} />
              ))}
            </div>
          <div className="projects-end">
            <div className="projects-end-inner-wrapper">
              <h2 className="projects-end-para">
                <span className="project-line-mask">
                  <span className="project-line">WE COULD KEEP</span>
                </span>
                <span className="project-line-mask">
                  <span className="project-line">GOING, BUT THERE’S A</span>
                </span>
                <span className="project-line-mask">
                  <span className="project-line">WHOLE PAGE FOR THAT.</span>
                </span>
              </h2>
              <div className="projects-pill projects-pill-first">
                <span className="hero-pill-text">The plot thickens</span>
              </div>
              <div className="projects-pill projects-pill-second">
                <span className="hero-pill-text">Very convenient</span>
              </div>
              <div className="projects-pill projects-pill-fourth">
                <span className="hero-pill-text">There’s more</span>
              </div>
              <Link to="/work" className="cta-btn project-btn">
                <div className="cta-text">See all projects</div>
                <div className="cta-btn-arrow">{arrowSvg}</div>
                <div className="cta-btn-fill-hover" />
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- SERVICES ----------------------------- */}
      <section className="section-services" id="services">
        <div className="section-services-wrapper">
          <SectionHeader kicker="My Skills" title="WHAT I WORK WITH" />
          <div className="section-services-body">
            <div className="services-layers">
              {serviceData.map((s, i) => (
                <div className="service-layer" key={i}>
                  <div className={`service-block ${["one", "two", "three", "four", "five", "six", "seven"][i]}`}>
                    <div className="service-text">{s.a}</div>
                    <div className="service-svg" aria-hidden="true">
                      <div className="lottie-animation" />
                    </div>
                    {s.b && <div className="service-text">{s.b}</div>}
                    <div className="service-block-para-wrapper">
                      <p className="service-block-para">{s.para}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="services-path" aria-hidden="true">
              <div className="services-path-svg-dark">
                <svg width="100%" viewBox="0 0 1616 2187" fill="none">
                  <path d={servicePath} stroke="#FF5400" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="services-path-svg">
                <svg width="100%" viewBox="0 0 1616 2187" fill="none">
                  <path d={servicePath} stroke="#FF5400" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="blockhole-start">
                <svg width="100%" viewBox="0 0 33 38" fill="none" aria-hidden="true">
                  <ellipse cx="20.5" cy="34.5" rx="12.5" ry="3.5" fill="black" />
                  <ellipse cx="12.4585" cy="18.0159" rx="12.4357" ry="18" fill="#FF5400" />
                  <path
                    d="M12.4808 0.51593C15.7039 0.520059 18.673 2.41469 20.8561 5.5833C23.0378 8.74988 24.4002 13.1493 24.3939 18.0312C24.3877 22.9131 23.014 27.309 20.8243 30.47C18.633 33.633 15.659 35.52 12.436 35.5159C9.21293 35.5117 6.24369 33.6171 4.06061 30.4485C1.87899 27.282 0.516586 22.8824 0.52284 18.0006C0.529093 13.1188 1.90276 8.72279 4.09249 5.56183C6.28368 2.39886 9.25776 0.511855 12.4808 0.51593Z"
                    stroke="black"
                  />
                </svg>
              </div>
              <div className="blackhole-end">
                <svg width="100%" viewBox="0 0 33 38" fill="none" aria-hidden="true">
                  <ellipse cx="12.5" cy="3.5" rx="12.5" ry="3.5" transform="matrix(-1 0 0 1 25 31)" fill="black" />
                  <ellipse cx="12.4357" cy="18" rx="12.4357" ry="18" transform="matrix(-0.999999 0.00128102 0.00128102 0.999999 32.9541 0)" fill="#FF5400" />
                  <path
                    d="M20.5192 0.51593C17.2961 0.520059 14.327 2.41469 12.1439 5.5833C9.96218 8.74988 8.59983 13.1493 8.60609 18.0312C8.61234 22.9131 9.98596 27.309 12.1757 30.47C14.367 33.633 17.341 35.52 20.564 35.5159C23.7871 35.5117 26.7563 33.6171 28.9394 30.4485C31.121 27.282 32.4834 22.8824 32.4772 18.0006C32.4709 13.1188 31.0972 8.72279 28.9075 5.56183C26.7163 2.39886 23.7422 0.511855 20.5192 0.51593Z"
                    stroke="black"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------- */}
      <section className="section-faq" id="faq">
        <div className="section-faq-wrapper">
          <div className="faq-left">
            <div className="section-faq-header">
              <div className="about-text">Frequently Asked Questions</div>
              <div className="section-heading-wrapper">
                <h2 className="section-heading left-align">GOOD TO KNOW</h2>
              </div>
            </div>
            <div className="cat-svg" aria-hidden="true">
              <img src={A + "cat.svg"} alt="" width="559" height="358" />
            </div>
          </div>
          <div className="faq-right">
            <div className="faq-list-wrapper">
              <div className="faq-list" role="list">
                {faqs.map(([q, a], i) => (
                  <div className={`faq-item ${i === 0 ? "is-open" : ""}`} role="listitem" key={q}>
                    <div className="faq-block">
                      <button
                        type="button"
                        className="question-block"
                        aria-expanded={activeFaq === i}
                        aria-controls={`faq-answer-${i}`}
                        onClick={(e) => toggleFaq(i, e.currentTarget)}
                        style={{ width: i === 0 ? "50%" : "100%", borderWidth: i === 0 ? "1px" : "0px" }}
                      >
                        <span className="faq-ques">{q}</span>
                      </button>
                      <div
                        id={`faq-answer-${i}`}
                        className="faq-block-btm"
                        aria-hidden={activeFaq !== i}
                        style={i === 0 ? undefined : { display: "none", height: 0 }}
                      >
                        <div className="answer-block">
                          <p className="faq-answer">{a}</p>
                        </div>
                        <div className="faq-logo" aria-hidden="true">
                          <div className="faq-logo-svg">
                            <img src={A + "faq-26.svg"} alt="" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ FOOTER ------------------------------ */}
      <footer className="footer" id="contact">
        <div className="footer-overlay-bg" aria-hidden="true">
          <img src={A + "footer-lines.svg"} alt="" className="footer-texture" />
          <div className="footer-overlay" />
        </div>
        <div className="footer-wrapper">
          <div className="footer-top">
            <div className="footer-top-left">
              <h2 className="footer-heading" aria-label="Let's build something useful">
                <span className="footer-heading-line-mask"><div className="footer-heading-line">Let’s build</div></span>
                <span className="footer-heading-line-mask"><div className="footer-heading-line">something</div></span>
                <span className="footer-heading-line-mask"><div className="footer-heading-line">useful</div></span>
              </h2>
              <CtaButton onClick={openContact} />

              <div className="footer-contact-panel">
                <div className="footer-contact-item">
                  <div className="footer-link-header">Email</div>
                  <a className="footer-link" href={`mailto:${profile.email}?subject=Hello%20Prajwal`}>{profile.email}</a>
                </div>
                <div className="footer-contact-item">
                  <div className="footer-link-header">Phone</div>
                  <a className="footer-link" href={profile.phoneHref}>{profile.phone}</a>
                </div>
              </div>
            </div>

            <div className="footer-top-right">
              <div className="footer-talk-card" aria-label="Let's talk">
                <div className="footer-talk-text">LET’S TALK</div>
                <div className="footer-smiley" aria-hidden="true">
                  <span className="footer-smile-eye" />
                  <span className="footer-smile-eye" />
                  <span className="footer-smile-mouth" />
                </div>
              </div>

              <div className="footer-links-block">
                <div className="footer-link-header">Main Menu</div>
                <Link className="footer-link" to="/work">Work</Link>
                <Link className="footer-link" to="/about">About</Link>
              </div>
              <div className="footer-links-block socials">
                <a className="footer-link" href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
                <a className="footer-link" href={profile.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>
              </div>
              <div className="footer-brand-note">BIM student &amp;<br />web developer</div>
              <div className="footer-address">Kathmandu,<br />Nepal</div>
            </div>
          </div>
          <div className="footer-btm">
            <div className="footer-rights-text">© 2026 – Prajwal Kunwor</div>
            <img className="footer-svg-logo" src={A + "footer-logo.svg"} alt="Prajwal Kunwor" />
          </div>
        </div>
      </footer>
    </main>
  );
}

const servicePath =
  "M1601 15C1241.24 56.6913 1025.14 308.977 1139.71 377.393C1191.45 408.29 1240.74 339.444 1181.39 282.059C1075.45 179.627 937.582 215.243 741.458 298.287C701.638 315.147 622.383 350.59 552.298 410.201C487.298 465.486 487.725 549.018 534.765 563.77C581.804 578.523 632.714 579.634 681.058 587.392C729.731 595.202 767.011 617.17 797.836 657.756C833.766 705.065 838.864 772.034 862.127 825.767C890.491 891.283 966.341 911.2 1033.5 915.638C1130.56 922.052 1195.74 891.215 1286.16 899.069C1347.7 904.414 1457.75 932.208 1466.92 1059.42C1477.81 1210.68 1340.4 1252.99 1221.76 1286.05C1118.2 1314.91 997.775 1397.54 862.127 1334.5C757.468 1285.86 666.411 1293.34 650.401 1384.21C634.391 1475.07 710.968 1532.13 837.283 1542.81C963.598 1553.5 1146.44 1534.93 1181.39 1676C1226.53 1858.21 954.075 1839.5 797.836 1839.5C661.891 1839.5 422.283 1807.72 385.5 1700C340.427 1568 635.939 1584.37 465.5 1917C414.516 2016.5 310 2165.31 15 2165.31";

export { Header, ContactModal };
export default HomePage;
