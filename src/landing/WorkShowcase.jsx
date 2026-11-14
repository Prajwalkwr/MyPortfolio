import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { projects } from "../data";

const A = "/assets/";

const open = (url) => window.open(url, "_blank", "noopener");

/* the selected works: project screens standing in a dark room, scrolled through like a reel */
export default function WorkShowcase() {
  const sectionRef = useRef(null);
  const hostRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [failed, setFailed] = useState(false);
  const items = useMemo(
    () =>
      projects.map((p) => ({
        name: p.name,
        caption: p.type,
        url: p.url,
        image: A + p.img,
        tall: `${A}work/${p.slug}-1024.webp`,
        tallSmall: `${A}work/${p.slug}-720.webp`,
      })),
    []
  );
  const count = items.length;

  /* the header turns light while the room is behind it */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => document.body.classList.toggle("room-dark", entry.isIntersecting),
      { rootMargin: "0px 0px -93% 0px" }
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      document.body.classList.remove("room-dark");
    };
  }, []);

  /* the room (and three.js) only loads once the section is within a screen and a half */
  useEffect(() => {
    const section = sectionRef.current;
    const host = hostRef.current;
    if (!section || !host || failed) return;
    let room = null;
    let cancelled = false;
    let idleHandle = 0;
    const idle = window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 1));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const start = () => {
      import("./workRoom.js")
        .then(({ createWorkRoom }) => {
          if (cancelled) return;
          room = createWorkRoom({
            host,
            section,
            items,
            onChange: (next, hover) => {
              setIndex(next);
              setHovering(hover);
            },
            onOpen: (next) => open(items[next].url),
          });
          if (!room) setFailed(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        idleHandle = idle(start, { timeout: 500 });
      },
      { rootMargin: "150% 0px" }
    );
    near.observe(section);
    return () => {
      cancelled = true;
      near.disconnect();
      if (idleHandle) cancelIdle(idleHandle);
      room?.dispose();
    };
  }, [items, failed]);

  /* without WebGL: one still per project, stepped through by the scroll */
  useEffect(() => {
    if (!failed) return;
    const section = sectionRef.current;
    if (!section) return;
    const onScroll = () => {
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / range));
      setIndex(Math.round(progress * (count - 1)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [failed, count]);

  const current = items[index] ?? items[0];

  return (
    <section ref={sectionRef} className="room" id="work" aria-labelledby="room-h" style={{ "--room-count": count }}>
      <div className="room-sticky">
        <div ref={hostRef} className="room-canvas" aria-hidden="true" />
        {failed && (
          <div className="room-fallback">
            <button type="button" className="room-fallback-card" key={index} onClick={() => open(current.url)}>
              <img src={current.image} alt={`${current.name} website preview`} decoding="async" />
            </button>
          </div>
        )}
        <div className="room-overlay landing-wrap">
          <div className="room-row">
            <h2 id="room-h" className="room-title">Selected works</h2>
            <Link to="/work" className="room-aside">
              All projects, in detail
            </Link>
          </div>
          <div className="room-row">
            <p className="room-name">
              {current.name}
              <span className="room-dim"> / {current.caption}</span>
            </p>
            <p className="room-status room-dim">{hovering ? "Click to open" : `${index + 1} of ${count}`}</p>
          </div>
        </div>
        <ul className="room-links">
          {items.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {`${item.name}, ${item.caption} (opens in a new tab)`}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
