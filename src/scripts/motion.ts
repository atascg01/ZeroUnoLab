import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { ParticleScene, StateConfig } from "./scene";

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) =>
  root.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(s));

const SCRAMBLE_CHARS = "01<>/{}[]#$%&*+=";

// Scene layout per section: hero sits to the right of the headline on desktop
const sceneStates = (isMobile: boolean): StateConfig[] => [
  { x: isMobile ? 0 : 2.4, opacity: isMobile ? 0.65 : 1 },
  { x: 0, opacity: 0.4 },
  { x: 0, opacity: 0.55 },
  { x: 0, opacity: 0.5 },
  { x: isMobile ? 0 : -2.8, opacity: 0.55 },
];

/* ---------- Helpers ---------- */

function splitChars(el: HTMLElement) {
  if (el.dataset.splitDone) return $$(".split-char", el);
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach((word) => {
          if (!word) return;
          if (/^\s+$/.test(word)) {
            frag.appendChild(document.createTextNode(" "));
            return;
          }
          const w = document.createElement("span");
          w.style.display = "inline-block";
          w.style.whiteSpace = "nowrap";
          for (const ch of word) {
            const c = document.createElement("span");
            c.className = "split-char";
            c.textContent = ch;
            w.appendChild(c);
          }
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // background-clip:text breaks on transformed children, keep gradients whole
        const elChild = child as HTMLElement;
        if (elChild.classList.contains("text-gradient")) {
          elChild.classList.add("split-char");
          return;
        }
        walk(child);
      }
    });
  };
  walk(el);
  el.dataset.splitDone = "1";
  return $$(".split-char", el);
}

function splitWords(el: HTMLElement) {
  const words = (el.textContent ?? "").trim().split(/\s+/);
  el.innerHTML = words
    .map((w) => `<span class="split-word inline-block">${w}</span>`)
    .join(" ");
  return $$(".split-word", el);
}

function scramble(el: HTMLElement, duration = 1.2, delay = 0) {
  const final = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = final;
  const obj = { p: 0 };
  return gsap.to(obj, {
    p: 1,
    duration,
    delay,
    ease: "power2.out",
    onStart: () => {
      el.style.opacity = "1";
    },
    onUpdate: () => {
      const revealed = Math.floor(obj.p * final.length);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        if (i < revealed || final[i] === " ") out += final[i];
        else out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      el.textContent = out;
    },
    onComplete: () => {
      el.textContent = final;
    },
  });
}

/* ---------- Smooth scroll ---------- */

let lenis: Lenis | null = null;

function initLenis(scene: ParticleScene | null) {
  if (reduced) return;
  lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.stop();
  lenis.on("scroll", (e: Lenis) => {
    ScrollTrigger.update();
    scene?.setVelocity(e.velocity / 30);
  });
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target: string | HTMLElement | number) {
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else if (typeof target === "number") window.scrollTo({ top: target });
  else {
    const el = typeof target === "string" ? $(target) : target;
    el?.scrollIntoView();
  }
}

function initAnchors() {
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href")!;
      if (href === "#") {
        e.preventDefault();
        scrollToTarget(0);
        return;
      }
      const el = $(href);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(el);
    });
  });
}

/* ---------- Cursor ---------- */

function initCursor() {
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");
  if (!dot || !ring || !finePointer) return;
  const label = $(".cursor-label", ring);
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
  const dx = gsap.quickTo(dot, "x", { duration: 0.1 });
  const dy = gsap.quickTo(dot, "y", { duration: 0.1 });
  const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
  const ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
  window.addEventListener("pointermove", (e) => {
    dx(e.clientX);
    dy(e.clientY);
    rx(e.clientX);
    ry(e.clientY);
  });
  document.addEventListener("pointerover", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("a, button, [data-cursor], input, textarea");
    ring.classList.remove("is-hover", "is-label");
    if (label) label.textContent = "";
    if (!t) return;
    const text = t.dataset.cursor;
    if (text) {
      ring.classList.add("is-label");
      if (label) label.textContent = text;
    } else {
      ring.classList.add("is-hover");
    }
  });
  document.addEventListener("pointerdown", () => gsap.to(ring, { scale: 0.8, duration: 0.15 }));
  document.addEventListener("pointerup", () => gsap.to(ring, { scale: 1, duration: 0.3 }));
}

/* ---------- Pointer effects ---------- */

function initMagnetic() {
  if (!finePointer || reduced) return;
  $$("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.35;
    const inner = $("[data-magnetic-inner]", el);
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      xTo(x * strength);
      yTo(y * strength);
      if (inner) gsap.to(inner, { x: x * strength * 0.5, y: y * strength * 0.5, duration: 0.6, ease: "power3" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.35)" });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.35)" });
    });
  });
}

function initCards() {
  $$("[data-spotlight]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
  if (!finePointer || reduced) return;
  $$("[data-tilt]").forEach((el) => {
    const max = Number(el.dataset.tilt) || 8;
    gsap.set(el, { transformPerspective: 1000 });
    const rX = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
    const rY = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      rY(px * max);
      rX(-py * max);
    });
    el.addEventListener("pointerleave", () => {
      rX(0);
      rY(0);
    });
  });
}

/* ---------- Header & menu ---------- */

let menuOpen = false;
let menuTl: gsap.core.Timeline | null = null;

function initHeader() {
  const header = $("[data-header]");
  if (!header) return;
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const y = self.scroll();
      header.classList.toggle("is-scrolled", y > 40);
      if (menuOpen) return;
      if (y > lastY && y > 300) gsap.to(header, { yPercent: -150, duration: 0.5, ease: "power3.out" });
      else gsap.to(header, { yPercent: 0, duration: 0.5, ease: "power3.out" });
      lastY = y;
    },
  });

  const toggle = $<HTMLButtonElement>("[data-menu-toggle]");
  const menu = $("[data-menu]");
  if (!toggle || !menu) return;
  const links = $$("[data-menu-link]", menu);
  menuTl = gsap
    .timeline({ paused: true })
    .set(menu, { display: "flex" })
    .fromTo(menu, { clipPath: "circle(0% at 100% 0%)" }, { clipPath: "circle(150% at 100% 0%)", duration: 0.8, ease: "power4.inOut" })
    .fromTo(links, { yPercent: 120, rotate: 6 }, { yPercent: 0, rotate: 0, stagger: 0.07, duration: 0.7, ease: "power4.out" }, "-=0.35");
  toggle.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
}

function openMenu() {
  const toggle = $("[data-menu-toggle]");
  menuOpen = true;
  toggle?.setAttribute("aria-expanded", "true");
  toggle?.classList.add("is-open");
  lenis?.stop();
  menuTl?.timeScale(1).play();
}

function closeMenu() {
  if (!menuOpen) return;
  const toggle = $("[data-menu-toggle]");
  menuOpen = false;
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.classList.remove("is-open");
  lenis?.start();
  menuTl?.timeScale(1.6).reverse();
}

/* ---------- Preloader & hero intro ---------- */

function runPreloader(): Promise<void> {
  const loader = $("#preloader");
  if (!loader) return Promise.resolve();
  let visited = false;
  try {
    visited = sessionStorage.getItem("zul-visited") === "1";
    sessionStorage.setItem("zul-visited", "1");
  } catch {}
  if (reduced) {
    loader.remove();
    return Promise.resolve();
  }
  const counter = $("[data-loader-count]", loader)!;
  const bar = $("[data-loader-bar]", loader)!;
  const bits = $("[data-loader-bits]", loader)!;
  const duration = visited ? 0.6 : 2;

  return new Promise((resolve) => {
    const obj = { v: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        loader.remove();
      },
    });
    tl.to(obj, {
      v: 100,
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        const v = Math.round(obj.v);
        counter.textContent = String(v).padStart(3, "0");
        bar.style.transform = `scaleX(${obj.v / 100})`;
        bits.textContent = Array.from({ length: 24 }, () => (Math.random() > 0.5 ? "1" : "0")).join("");
      },
    })
      .to("[data-loader-inner]", { yPercent: -120, opacity: 0, duration: 0.5, ease: "power3.in" })
      .add(() => resolve(), "-=0.1")
      .to("[data-loader-panel='top']", { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "<")
      .to("[data-loader-panel='bottom']", { yPercent: 100, duration: 0.9, ease: "power4.inOut" }, "<");
  });
}

function heroIntro(scene: ParticleScene | null) {
  document.documentElement.classList.remove("is-loading");
  scene?.intro(reduced ? 0.01 : 2.8);
  lenis?.start();
  if (reduced) return;

  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.fromTo("[data-header]", { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 0.2);
  tl.fromTo("[data-hero-eyebrow]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);

  $$("[data-hero-line]").forEach((line, i) => {
    const target = line.hasAttribute("data-no-split") ? $$(":scope > *", line) : splitChars(line);
    tl.fromTo(
      target,
      { yPercent: 115, rotate: 8, opacity: 0 },
      { yPercent: 0, rotate: 0, opacity: 1, duration: 1.3, stagger: 0.025 },
      0.2 + i * 0.15,
    );
  });

  const sub = $("[data-hero-sub]");
  if (sub) tl.add(scramble(sub, 1.4), 0.8);
  tl.fromTo("[data-hero-cta]", { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 1 }, 1);
  tl.fromTo("[data-hero-meta]", { opacity: 0 }, { opacity: 1, stagger: 0.1, duration: 1 }, 1.3);
}

/* ---------- Scroll animations ---------- */

function initScrollAnimations(scene: ParticleScene | null) {
  // Particle morphs per section
  $$("[data-scene-state]").forEach((section) => {
    const i = Number(section.dataset.sceneState);
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => self.isActive && scene?.goTo(i),
    });
  });

  // Hero content drifts and fades on scroll out
  gsap.to("[data-hero-content]", {
    yPercent: -25,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true },
  });

  if (reduced) return;

  // Generic reveal
  $$("[data-reveal]").forEach((el) => {
    const type = el.dataset.reveal;
    const st = { trigger: el, start: "top 88%" };
    if (type === "clip") {
      gsap.fromTo(
        el,
        { clipPath: "inset(30% 10% 30% 10% round 2rem)", opacity: 0, scale: 0.92 },
        { clipPath: "inset(0% 0% 0% 0% round 1.5rem)", opacity: 1, scale: 1, duration: 1.4, ease: "power4.out", clearProps: "clipPath", scrollTrigger: st },
      );
    } else if (type === "stagger") {
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(
        el.children,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out", scrollTrigger: st },
      );
    } else {
      gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", scrollTrigger: st });
    }
  });

  // Section titles: per-character rise
  $$("[data-split-title]").forEach((el) => {
    const chars = splitChars(el);
    gsap.fromTo(
      chars,
      { yPercent: 110, rotateX: -80, opacity: 0 },
      {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 1.1,
        stagger: 0.025,
        ease: "power4.out",
        scrollTrigger: { trigger: el, start: "top 85%" },
      },
    );
  });

  $$("[data-scramble]").forEach((el) => {
    el.style.opacity = "0";
    ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => scramble(el, 1) });
  });

  // Parallax
  $$("[data-parallax]").forEach((el) => {
    const speed = Number(el.dataset.parallax) || 0.2;
    gsap.fromTo(
      el,
      { yPercent: -speed * 100 },
      { yPercent: speed * 100, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
    );
  });

  // Manifesto: words light up as you scroll
  const manifesto = $("[data-manifesto]");
  if (manifesto) {
    const words = splitWords(manifesto);
    gsap.fromTo(
      words,
      { opacity: 0.12, filter: "blur(6px)" },
      {
        opacity: 1,
        filter: "blur(0px)",
        stagger: 0.1,
        ease: "none",
        scrollTrigger: { trigger: manifesto, start: "top 80%", end: "bottom 45%", scrub: true },
      },
    );
  }

  // Marquee speeds up and skews with scroll velocity
  const rows = $$("[data-marquee]");
  if (rows.length) {
    const skewTo = rows.map((r) => gsap.quickTo(r, "skewX", { duration: 0.5, ease: "power3" }));
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = gsap.utils.clamp(-12, 12, self.getVelocity() / -250);
        skewTo.forEach((fn) => fn(v));
      },
    });
  }

  // Process: horizontal pinned scroll on large screens
  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px)", () => {
    const section = $("[data-hscroll]");
    const track = $("[data-hscroll-track]");
    if (!section || !track) return;
    const distance = () => track.scrollWidth - window.innerWidth + 96;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
    gsap.fromTo("[data-hscroll-progress]", { scaleX: 0 }, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: () => `+=${distance()}`, scrub: true },
    });
    $$("[data-step]", track).forEach((step) => {
      // Cards already on screen when the pin starts animate with the section itself
      const visibleAtStart = step.offsetLeft < window.innerWidth * 0.85;
      gsap.fromTo(
        $$("[data-step-anim]", step),
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: visibleAtStart
            ? { trigger: section, start: "top 60%" }
            : { trigger: step, containerAnimation: tween, start: "left 85%" },
        },
      );
    });
  });
  mm.add("(max-width: 1023px)", () => {
    $$("[data-step]").forEach((step) => {
      gsap.fromTo(
        $$("[data-step-anim]", step),
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 1, ease: "power3.out", scrollTrigger: { trigger: step, start: "top 85%" } },
      );
    });
  });

  // SVG line drawing
  $$<SVGPathElement>("[data-draw]").forEach((path) => {
    const len = path.getTotalLength();
    gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", scrollTrigger: { trigger: path, start: "top 85%" } },
    );
  });

  // Counters
  $$("[data-counter]").forEach((el) => {
    const end = Number(el.dataset.counter);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end,
      duration: 2,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%" },
      onUpdate: () => (el.textContent = String(Math.round(obj.v))),
    });
  });

  // Bars & charts in service cards
  $$("[data-bar]").forEach((bar, i) => {
    gsap.fromTo(
      bar,
      { scaleY: 0 },
      {
        scaleY: 1,
        duration: 1.2,
        delay: i * 0.05,
        ease: "elastic.out(1, 0.6)",
        scrollTrigger: { trigger: bar, start: "top 95%" },
      },
    );
  });

  // Footer giant wordmark
  const wordmark = $("[data-wordmark]");
  if (wordmark) {
    const chars = splitChars(wordmark);
    gsap.fromTo(
      chars,
      { yPercent: 100, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        stagger: 0.05,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: { trigger: wordmark, start: "top 95%" },
      },
    );
  }
}

/* ---------- Typing code in the web card ---------- */

function initTyping() {
  $$("[data-typing]").forEach((el) => {
    const lines = $$("[data-type-line]", el);
    const texts = lines.map((l) => l.textContent ?? "");
    lines.forEach((l) => (l.textContent = ""));
    let started = false;
    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      onEnter: () => {
        if (started) return;
        started = true;
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.5 });
        lines.forEach((l, i) => {
          const o = { n: 0 };
          tl.to(o, {
            n: texts[i].length,
            duration: texts[i].length * 0.03,
            ease: "none",
            onUpdate: () => (l.textContent = texts[i].slice(0, Math.round(o.n))),
          });
        });
        tl.to(lines, { opacity: 0, duration: 0.4, delay: 1.5 }).add(() => {
          lines.forEach((l) => (l.textContent = ""));
          gsap.set(lines, { opacity: 1 });
        });
      },
    });
  });
}

/* ---------- Boot ---------- */

async function boot() {
  const canvas = $<HTMLCanvasElement>("#webgl");
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const preloader = runPreloader();

  let scene: ParticleScene | null = null;
  if (canvas) {
    const [{ createScene }] = await Promise.all([import("./scene"), fontsReady]);
    scene = createScene(canvas, sceneStates);
    if (!scene) canvas.remove();
  }

  initLenis(scene);
  initAnchors();
  initCursor();
  initMagnetic();
  initCards();
  initHeader();
  initTyping();

  // Hide hero pieces until the intro plays
  if (!reduced) {
    gsap.set(["[data-header]", "[data-hero-eyebrow]", "[data-hero-cta]", "[data-hero-meta]"], { opacity: 0 });
    gsap.set("[data-hero-sub]", { opacity: 0 });
  }
  initScrollAnimations(scene);

  await preloader;
  heroIntro(scene);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

boot();
