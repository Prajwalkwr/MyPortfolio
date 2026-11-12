import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./ref.css";
import "./styles.css";
import HomePage, { Header, ContactModal } from "./HomePage";
import PlayfulCat from "./PlayfulCat";
import EnergyCursor from "./EnergyCursor";
import Preloader from "./Preloader";
import { projects, profile } from "./data";
gsap.registerPlugin(ScrollTrigger);
const A = "/assets/";

const workList = [
  ...projects.slice(0, 6).map((p) => ({ n: p.name, t: p.type, y: "2026", img: p.img, url: p.url })),
  { n: "MERCI", t: "Brand identity, Packaging", y: "2024", img: "6ab3bf3752f80352a9f32c66_Header_Merci.jpg.webp" },
  { n: "TWO26", t: "Brand identity, Motion design, Web design", y: "2023", img: "6ab3c2fafc7e090ef49c1b1f_LP1_header.jpg.webp" },
];

const catShots = [
  "6ab3e86d80e745532cd7cd98_1a.webp",
  "6ab3e86e5e13def3136341b5_2a.webp",
  "6ab3e86d7cf5fe576e1057a7_3a.webp",
  "6ab3e86d8dda4486bc2ab589_4a.webp",
  "6ab3e86e3ffcf5b9ea631006_5a.webp",
  "6ab3e86d8fbaf5fd698728ad_6a.webp",
  "6ab3e86daaea7c4041bd4a7a_7a.webp",
  "6ab3e86d7c19d95b234b37d7_8a.webp",
  "6ab3e86d733701e801cdf01d_9a.webp",
  "6ab3e86ed5b7b2690124aa67_10a.webp",
];

function PageTop({ kicker, title, copy }) {
  return (
    <section className="page-intro">
      <div className="page-kicker">{kicker}</div>
      <h1 className="page-title">{title}</h1>
      {copy && <p className="page-copy">{copy}</p>}
    </section>
  );
}

function WorkPage({ openContact }) {
  return (
    <>
      <main className="inner-page" id="top">
        <PageTop kicker="All projects" title="Selected Works" copy="A selection of the products and projects I’ve been building. Open a project to visit its live site." />
        <section className="work-list">
          {workList.map((p, i) => {
            const details = (
              <>
                <span className="work-row-index">{String(i + 1).padStart(2, "0")}</span>
                <span className="work-row-name">{p.n}</span>
                <span className="work-row-type">{p.t}</span>
                <span className="work-row-year">{p.y}</span>
                <span className="work-row-thumb"><img src={A + p.img} alt={p.n} loading="lazy" /></span>
                {p.url && <span className="work-row-arrow" aria-hidden="true">↗</span>}
              </>
            );
            return p.url ? (
              <a className="work-row" key={p.n} href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`${p.n} — opens in a new tab`}>
                {details}
              </a>
            ) : (
              <div className="work-row" key={p.n}>{details}</div>
            );
          })}
        </section>
        <section className="catwork">
          <div className="page-kicker">And the cats</div>
          <h2 className="catwork-title">Caught on camera</h2>
          <div className="catwork-grid">
            {catShots.map((src) => (
              <div className="catwork-cell" key={src}><img src={A + src} alt="Two26 studio cat" loading="lazy" /></div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function AboutPage() {
  return (
    <main className="inner-page" id="top">
      <PageTop kicker="About me" title="Hi, I’m Prajwal" copy="I’m a BIM student from Kathmandu, Nepal. I’m interested in web development and software projects." />
      <section className="about-page-media"><img src={A + "6aaad679fdb9d914f7f52069_about-hero.svg"} alt="" aria-hidden="true" /></section>
      <section className="about-blocks">
        <div className="about-block"><span>01 — Who I am</span><p>I’m Prajwal Kunwor, a BIM student based in Kathmandu, Nepal. I enjoy creating practical digital solutions.</p></div>
        <div className="about-block"><span>02 — What I use</span><p>Frontend: HTML, CSS, JavaScript, React and Vite, with responsive design. Backend: Node.js, Express.js, MongoDB and REST APIs.</p></div>
        <div className="about-block"><span>03 — How I work</span><p>I learn modern tools by building real-world projects. I use Git and GitHub to manage my code and work with others.</p></div>
      </section>
      <section className="about-values">
        {["Practical solutions", "Always learning", "Real-world projects", "Building together"].map((v) => (
          <div className="about-value" key={v}><span>{v}</span><span>↗</span></div>
        ))}
      </section>
      <section className="about-illustration"><img src={A + "6aaad679fdb9d914f7f5206f_illustration_5.svg"} alt="" aria-hidden="true" /></section>
    </main>
  );
}

function Footer() {
  return (
    <footer className="footer inner-footer">
      <div className="footer-overlay-bg" aria-hidden="true"><img src={A + "footer-lines.svg"} alt="" className="footer-texture" /><div className="footer-overlay" /></div>
      <div className="footer-wrapper">
        <div className="footer-top">
          <div className="footer-top-left">
            <h2 className="footer-heading"><span className="footer-heading-line-mask"><div className="footer-heading-line">Let’s build</div></span><span className="footer-heading-line-mask"><div className="footer-heading-line">something</div></span><span className="footer-heading-line-mask"><div className="footer-heading-line">useful</div></span></h2>
            <div className="footer-links-block email">
              <div className="footer-link-header">Email me</div>
              <a className="footer-link" href={`mailto:${profile.email}`}>{profile.email}</a>
            </div>
          </div>
          <div className="footer-top-right">
            <div className="footer-top-right-top">
              <div className="footer-links-block">
                <div className="footer-link-header">Main Menu</div>
                <Link className="footer-link" to="/work">Work</Link>
                <Link className="footer-link" to="/about">About</Link>
              </div>
              <div className="footer-links-block socials">
                <a className="footer-link" href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
                <a className="footer-link" href={profile.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>
              </div>
            </div>
            <div className="footer-top-right-btm">
              <div className="footer-link footer-brand-note">BIM student &amp;<br />web developer</div>
              <div className="footer-address">Kathmandu,<br />Nepal</div>
            </div>
          </div>
        </div>
        <div className="footer-btm">
          <div className="footer-rights-text">© 2026 – Prajwal Kunwor</div>
          <img className="footer-svg-logo" src={A + "footer-logo.svg"} alt="Prajwal Kunwor" />
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setTimeout(() => ScrollTrigger.refresh(), 250);
  }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle("modal-open", contactOpen);
  }, [contactOpen]);
  return (
    <>
      <Header onContact={() => setContactOpen(true)} />
      <Routes>
        <Route path="/" element={<HomePage openContact={() => setContactOpen(true)} />} />
        <Route path="/work" element={<WorkPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<HomePage openContact={() => setContactOpen(true)} />} />
      </Routes>
      {(location.pathname === "/work" || location.pathname === "/about") && <Footer />}
      <PlayfulCat />
      <EnergyCursor />
      {contactOpen && <ContactModal close={() => setContactOpen(false)} />}
      <Preloader />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
);
