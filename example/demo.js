import {
  Box,
  Button,
  Divider,
  El,
  ForEach,
  HStack,
  Input,
  LineBreak,
  Link,
  Nav,
  Paragraph,
  Section,
  Show,
  Span,
  Subtitle,
  Text,
  Title,
  VStack,
  computed,
  page,
  setupGroup,
  setupState,
  signal,
} from '../index.js';

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #e8f0ff;
    --ink-dim: rgba(232,240,255,0.5);
    --ink-ghost: rgba(232,240,255,0.22);
    --ink-whisper: rgba(232,240,255,0.08);
    --page: #080b12;
    --surface: #0d1120;
    --surface-2: #111827;
    --accent: #4ff8c8;
    --accent-2: #7c6bff;
    --accent-3: #ff6b8a;
    --accent-warm: #f5c842;
    --border: rgba(232,240,255,0.09);
    --border-accent: rgba(79,248,200,0.28);
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --font-mono: 'DM Mono', monospace;
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  html { scroll-behavior: smooth; }

  html {
    scrollbar-width: thin;
    scrollbar-color: #54b9ff #0b1220;
    scrollbar-gutter: auto !important;
    overflow-y: auto;
    overflow-x: clip;
  }

  body {
    overflow-y: auto;
    overflow-x: clip;
  }

  #app,
  .bw-route-view,
  .feather-route-view {
    overflow-x: clip !important;
  }

  .bw-route-view,
  .feather-route-view {
    overflow-y: visible !important;
    scrollbar-width: none;
  }

  .bw-route-view::-webkit-scrollbar,
  .feather-route-view::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  html::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  html::-webkit-scrollbar-track {
    background: #0b1220;
  }

  html::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #7dd3ff 0%, #3b82f6 100%);
    border-radius: 999px;
    border: 2px solid #0b1220;
  }

  html::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #9ee1ff 0%, #60a5fa 100%);
  }

  html::-webkit-scrollbar-corner {
    background: transparent;
  }

  body {
    font-family: var(--font-body);
    background:
      radial-gradient(circle at 12% 14%, rgba(84,185,255,0.18) 0%, transparent 30%),
      radial-gradient(circle at 84% 18%, rgba(59,130,246,0.16) 0%, transparent 28%),
      radial-gradient(circle at 58% 72%, rgba(96,165,250,0.12) 0%, transparent 34%),
      radial-gradient(circle at 50% 38%, rgba(125,211,255,0.08) 0%, transparent 38%),
      var(--page);
    color: var(--ink);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    cursor: none;
  }

  a, button { cursor: none; }

  /* CURSOR */
  #sc-cursor {
    position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
    width: 10px; height: 10px;
    background: var(--accent);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.3s var(--ease-spring), height 0.3s var(--ease-spring);
    mix-blend-mode: screen;
  }
  #sc-cursor-ring {
    position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9998;
    width: 36px; height: 36px;
    border: 1px solid var(--accent);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.5;
    transition: width 0.4s var(--ease-spring), height 0.4s var(--ease-spring), opacity 0.3s;
  }
  body:has(a:hover) #sc-cursor,
  body:has(button:hover) #sc-cursor,
  body:has(.sc-pill:hover) #sc-cursor { width: 20px; height: 20px; }
  body:has(a:hover) #sc-cursor-ring,
  body:has(button:hover) #sc-cursor-ring,
  body:has(.sc-pill:hover) #sc-cursor-ring { width: 56px; height: 56px; opacity: 0.2; }

  /* NOISE */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 1; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.028;
  }

  /* PROGRESS BAR */
  #sc-progress {
    position: fixed; top: 0; left: 0; z-index: 100;
    height: 2px; width: 100%;
    background: linear-gradient(90deg, #8edcff 0%, #54b9ff 45%, #2563eb 100%);
    transform-origin: left;
    transform: scaleX(0);
    transition: transform 0.05s linear;
    box-shadow: 0 0 16px rgba(84,185,255,0.45);
  }

  /* NAV */
  .sc-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 clamp(24px, 5vw, 72px);
    height: 64px;
    border-bottom: 1px solid transparent;
    transition: border-color 0.4s, background 0.4s, backdrop-filter 0.4s;
  }
  .sc-nav.scrolled {
    border-color: var(--border);
    background: rgba(8,11,18,0.72);
    backdrop-filter: blur(18px);
  }
  .sc-nav-logo {
    font-family: var(--font-display);
    font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 8px;
    text-decoration: none; color: var(--ink);
  }
  .sc-nav-mark {
    width: 22px; height: 22px;
    background: var(--accent);
    clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
    flex-shrink: 0;
  }
  .sc-nav-tags {
    display: flex; gap: 24px;
    font-size: 0.78rem; color: var(--ink-dim);
    letter-spacing: 0.04em; font-family: var(--font-mono);
  }

  /* LAYOUT */
  .sc-wrap {
    max-width: 1160px; margin: 0 auto;
    padding: 0 clamp(24px, 5vw, 72px);
  }
  section[id] { scroll-margin-top: 80px; }

  /* SECTION LABEL */
  .sc-label {
    font-family: var(--font-mono); font-size: 0.72rem;
    color: var(--accent); letter-spacing: 0.18em;
    text-transform: uppercase; margin-bottom: 16px;
    display: flex; align-items: center; gap: 10px;
  }
  .sc-label::before {
    content: ''; width: 24px; height: 1px; background: var(--accent); display: block;
  }

  /* HERO */
  .sc-hero {
    min-height: 100vh;
    justify-content: center;
    padding: 120px clamp(24px, 5vw, 72px) 80px;
    max-width: 1160px; margin: 0 auto; position: relative; z-index: 2;
  }
  .sc-hero-eyebrow {
    font-family: var(--font-mono); font-size: 0.72rem;
    letter-spacing: 0.22em; color: var(--accent);
    text-transform: uppercase; margin-bottom: 28px;
    opacity: 0; transform: translateY(16px);
    animation: sc-reveal 0.8s 0.2s var(--ease-out) forwards;
  }
  .sc-hero-title {
    font-family: var(--font-display);
    font-size: clamp(3.4rem, 9vw, 8rem); font-weight: 800;
    line-height: 0.92; letter-spacing: -0.04em; margin-bottom: 32px;
    opacity: 0; transform: translateY(24px);
    animation: sc-reveal 0.9s 0.35s var(--ease-out) forwards;
  }
  .sc-hero-title .sc-accent {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .sc-hero-sub {
    font-size: clamp(1rem, 2vw, 1.28rem); font-weight: 300; line-height: 1.65;
    color: var(--ink-dim); max-width: 540px; margin-bottom: 48px;
    opacity: 0; transform: translateY(20px);
    animation: sc-reveal 0.9s 0.5s var(--ease-out) forwards;
  }
  .sc-pills {
    display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 52px;
    opacity: 0; transform: translateY(16px);
    animation: sc-reveal 0.8s 0.65s var(--ease-out) forwards;
  }
  .sc-pill {
    padding: 6px 14px; border: 1px solid var(--border); border-radius: 99px;
    font-family: var(--font-mono); font-size: 0.75rem;
    color: var(--ink-dim); background: var(--ink-whisper);
    transition: border-color 0.25s, color 0.25s, background 0.25s;
    text-decoration: none; display: inline-block;
  }
  .sc-pill:hover { border-color: var(--border-accent); color: var(--accent); background: rgba(79,248,200,0.06); }
  .sc-hero-demo {
    display: flex; align-items: center; gap: 32px;
    flex: 1;
    width: 100%;
    height: clamp(260px, 34vh, 420px);
    opacity: 0; transform: translateY(20px);
    animation: sc-reveal 0.9s 0.78s var(--ease-out) forwards;
  }

  .sc-counter-label {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--ink-ghost); letter-spacing: 0.12em; text-transform: uppercase;
  }
  .sc-counter-display {
    font-family: var(--font-display);
    font-size: clamp(4rem, 12vw, 7rem); font-weight: 800;
    line-height: 0.85; letter-spacing: -0.06em; color: var(--accent);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 60px rgba(79,248,200,0.3);
    transition: color 0.2s, transform 0.15s var(--ease-spring);
  }
  .sc-counter-display.bump { transform: scale(1.06); color: #fff; }
  .sc-counter-note {
    font-size: 0.85rem; color: var(--ink-dim); font-style: italic;
    max-width: 200px; font-weight: 300; line-height: 1.4;
  }

  /* HERO ORBS */
  .sc-orb {
    position: absolute; border-radius: 50%; pointer-events: none; z-index: -1; filter: blur(80px);
  }
  .sc-orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(84,185,255,0.26) 0%, transparent 72%);
    top: 10%; right: -100px; animation: sc-float-a 18s ease-in-out infinite;
  }
  .sc-orb-2 {
    width: 380px; height: 380px;
    background: radial-gradient(circle, rgba(59,130,246,0.24) 0%, transparent 72%);
    bottom: 0; right: 30%; animation: sc-float-b 22s ease-in-out infinite;
  }

  .sc-backlight {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(140px);
    opacity: 0.95;
    z-index: 0;
    mix-blend-mode: screen;
  }
  .sc-backlight-a {
    width: 560px; height: 560px;
    top: 4%; left: -160px;
    background: radial-gradient(circle, rgba(125,211,255,0.32) 0%, transparent 74%);
    animation: sc-float-a 24s ease-in-out infinite;
  }
  .sc-backlight-b {
    width: 620px; height: 620px;
    top: 28%; right: -180px;
    background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 74%);
    animation: sc-float-b 26s ease-in-out infinite;
  }
  .sc-backlight-c {
    width: 520px; height: 520px;
    bottom: 10%; left: 22%;
    background: radial-gradient(circle, rgba(84,185,255,0.24) 0%, transparent 74%);
    animation: sc-float-a 28s ease-in-out infinite;
  }

  /* PRINCIPLES */
  .sc-section {
    padding: clamp(80px, 12vh, 140px) clamp(24px, 5vw, 72px);
    max-width: 1160px; margin: 0 auto;
    position: relative; z-index: 2;
  }
  .sc-section-principles {
    max-width: 1360px;
  }
  .sc-principles-intro {
    align-items: start; margin-bottom: clamp(48px, 8vh, 80px);
  }
  .sc-section-title {
    font-family: var(--font-display); font-size: clamp(2rem, 5vw, 4rem);
    font-weight: 800; line-height: 1; letter-spacing: -0.04em;
  }
  .sc-section-desc { font-size: 1rem; color: var(--ink-dim); line-height: 1.7; font-weight: 300; padding-bottom: 6px; }

  .sc-rules-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px; border: 1px solid var(--border); border-radius: 20px;
    overflow: hidden; background: var(--border);
  }
  .sc-rule-card {
    background: var(--surface); padding: clamp(24px, 4vw, 40px);
    transition: background 0.3s; position: relative; overflow: hidden;
    min-height: 320px;
  }
  .sc-rule-card::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(79,248,200,0.07), transparent 60%);
    opacity: 0; transition: opacity 0.4s;
  }
  .sc-rule-card:hover::before { opacity: 1; }
  .sc-rule-card:hover { background: #0f1826; }
  .sc-rule-num {
    font-family: var(--font-mono); font-size: 0.65rem;
    color: var(--ink-ghost); letter-spacing: 0.14em; margin-bottom: 16px;
  }
  .sc-rule-title {
    font-family: var(--font-display); font-size: 1.05rem; font-weight: 700;
    margin-bottom: 10px; letter-spacing: -0.02em;
  }
  .sc-rule-body { font-size: 0.88rem; color: var(--ink-dim); line-height: 1.65; font-weight: 300; }
  .sc-rule-code {
    margin-top: 16px; font-family: var(--font-mono); font-size: 0.75rem;
    color: var(--accent); line-height: 1.6;
    background: rgba(79,248,200,0.05); border: 1px solid rgba(79,248,200,0.1);
    border-radius: 8px; padding: 10px 12px;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* REACTIVITY DEMO */
  .sc-demo-split {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: clamp(32px, 5vw, 64px); align-items: start; margin-top: 52px;
  }
  .sc-code-pane {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px; overflow: hidden;
  }
  .sc-code-bar {
    display: flex; align-items: center; gap: 6px; padding: 12px 16px;
    border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);
  }
  .sc-dot { width: 9px; height: 9px; border-radius: 50%; }
  .sc-code-label {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--ink-ghost); margin-left: 8px; letter-spacing: 0.06em;
  }
  .sc-code-body {
    padding: 20px 24px; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.8; overflow-x: auto;
  }
  .sc-live-pane { gap: 20px; }
  .sc-live-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px; padding: 24px;
    transition: border-color 0.3s, background 0.3s;
  }
  .sc-live-card.active { border-color: var(--border-accent); background: rgba(79,248,200,0.04); }
  .sc-live-label {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--ink-ghost); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px;
  }
  .sc-live-value {
    font-family: var(--font-display); font-size: 2.4rem;
    font-weight: 700; letter-spacing: -0.04em; color: var(--accent);
    font-variant-numeric: tabular-nums; display: inline-block;
    transition: color 0.2s, transform 0.15s var(--ease-spring);
  }
  .sc-live-value.flash { transform: scale(1.1) translateY(-2px); color: #fff; }
  .sc-live-input {
    width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px; font-family: var(--font-mono); font-size: 0.85rem;
    color: var(--ink); outline: none; transition: border-color 0.25s; caret-color: var(--accent);
  }
  .sc-live-input:focus { border-color: var(--border-accent); }
  .sc-live-preview {
    font-size: 1.1rem; font-weight: 300; color: var(--ink); line-height: 1.4;
    min-height: 1.4em; font-style: italic;
  }

  /* DERIVED */
  .sc-derived-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border); border: 1px solid var(--border);
    border-radius: 20px; overflow: hidden; margin-top: 52px;
  }
  .sc-derived-cell { background: var(--surface); padding: 32px 28px; }
  .sc-derived-label {
    font-family: var(--font-mono); font-size: 0.65rem;
    color: var(--ink-ghost); letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
  }
  .sc-derived-label .arr { color: var(--accent); font-size: 0.8rem; opacity: 0.7; }
  .sc-derived-num {
    font-family: var(--font-display); font-size: clamp(2.4rem, 5vw, 4rem);
    font-weight: 800; letter-spacing: -0.06em; line-height: 1;
    transition: all 0.25s var(--ease-spring);
  }
  .sc-derived-formula {
    margin-top: 12px; font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-ghost);
  }
  .sc-derived-controls { display: flex; gap: 8px; margin-top: 20px; }
  .sc-action-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-block: 8px;
  }
  .sc-action-row .sc-btn {
    align-self: center;
  }

  /* FLOW */
  .sc-flow-canvas {
    min-height: 320px;
    margin-top: 52px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: clamp(12px, 5vw, 32px); position: relative; overflow: hidden;
    justify-content: space-evenly;
  }
  .sc-flow-canvas::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(circle at 20% 50%, rgba(79,248,200,0.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 50%, rgba(124,107,255,0.04) 0%, transparent 50%);
  }
  .sc-flow-grid {
    display: grid; grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center; position: relative; z-index: 1;
  }
  .sc-flow-node {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 14px; padding: 18px 20px;
    transition: border-color 0.3s, transform 0.2s var(--ease-spring), box-shadow 0.3s;
  }
  .sc-flow-node.sn { border-color: rgba(124,107,255,0.3); }
  .sc-flow-node.cn { border-color: rgba(79,248,200,0.3); }
  .sc-flow-node.en { border-color: rgba(255,107,138,0.3); }
  .sc-flow-node.pulse { transform: scale(1.04); box-shadow: 0 0 32px rgba(79,248,200,0.2); }
  .sc-flow-node.pulse-s { box-shadow: 0 0 32px rgba(124,107,255,0.25); }
  .sc-flow-node.pulse-e { box-shadow: 0 0 32px rgba(255,107,138,0.25); }
  .sc-flow-kind {
    font-family: var(--font-mono); font-size: 0.63rem; letter-spacing: 0.12em;
    margin-bottom: 8px; text-transform: uppercase;
  }
  .sc-flow-kind.s { color: #9b8fff; }
  .sc-flow-kind.c { color: var(--accent); }
  .sc-flow-kind.e { color: var(--accent-3); }
  .sc-flow-val {
    font-family: var(--font-display); font-size: 1.6rem; font-weight: 700;
    letter-spacing: -0.04em; font-variant-numeric: tabular-nums;
  }
  .sc-flow-name { font-family: var(--font-mono); font-size: 0.65rem; color: var(--ink-ghost); margin-top: 6px; }
  .sc-arrow { display: flex; align-items: center; justify-content: center; padding: 0 12px; }
  .sc-arrow-line {
    width: 40px; height: 2px; background: linear-gradient(90deg, var(--border), var(--accent));
    position: relative; transition: background 0.4s;
    box-shadow: none; transition: box-shadow 0.3s;
  }
  .sc-arrow-line.lit { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .sc-arrow-line::after {
    content: ''; position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
    border-left: 8px solid var(--accent); border-top: 4px solid transparent; border-bottom: 4px solid transparent;
    opacity: 0.6;
  }
  .sc-particle {
    position: absolute; width: 6px; height: 6px; background: var(--accent); border-radius: 50%;
    top: 50%; transform: translateY(-50%); opacity: 0; box-shadow: 0 0 8px var(--accent);
  }
  .sc-flow-footer {
    margin-top: 32px; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; align-items: center;
  }

  /* THEME */
  .sc-theme-canvas {
    margin-top: 52px; display: grid; grid-template-columns: auto 1fr; gap: 32px; align-items: start;
  }
  .sc-palette-list { gap: 8px; min-width: 140px; }
  .sc-palette-btn {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border: 1px solid var(--border); border-radius: 10px; background: transparent;
    color: var(--ink-dim); font-family: var(--font-mono); font-size: 0.75rem;
    transition: all 0.25s; text-align: left;
  }
  .sc-palette-btn .sw { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .sc-palette-btn.active, .sc-palette-btn:hover {
    border-color: rgba(255,255,255,0.2); color: var(--ink); background: var(--ink-whisper);
  }
  .sc-theme-preview {
    border-radius: 20px; border: 1px solid var(--border); padding: 32px;
    transition: all 0.5s var(--ease-out);
  }
  .sc-theme-pname {
    font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.14em;
    text-transform: uppercase; margin-bottom: 20px; opacity: 0.5;
    transition: color 0.5s;
  }
  .sc-theme-title {
    font-family: var(--font-display); font-size: 2rem; font-weight: 800;
    letter-spacing: -0.04em; margin-bottom: 10px; transition: color 0.5s;
  }
  .sc-theme-text { font-size: 0.9rem; line-height: 1.65; margin-bottom: 24px; transition: color 0.5s; }
  .sc-theme-btn {
    display: inline-flex; align-items: center; padding: 10px 20px;
    border-radius: 10px; border: 1px solid; font-family: var(--font-mono); font-size: 0.78rem;
    transition: all 0.5s; letter-spacing: 0.02em;
  }

  /* FINALE */
  .sc-finale {
    padding: clamp(100px, 18vh, 180px) clamp(24px, 5vw, 72px);
    text-align: center; position: relative; overflow: hidden;
    z-index: 2;
  }
  .sc-finale::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(circle at 50% 60%, rgba(79,248,200,0.07) 0%, transparent 60%),
      radial-gradient(circle at 30% 30%, rgba(124,107,255,0.06) 0%, transparent 50%);
  }
  .sc-finale-title {
    font-family: var(--font-display); font-size: clamp(3rem, 9vw, 8rem); font-weight: 800;
    line-height: 0.9; letter-spacing: -0.05em; position: relative; z-index: 1; margin-bottom: 28px;
  }
  .sc-finale-sub {
    font-size: clamp(1rem, 2vw, 1.2rem); color: var(--ink-dim); font-weight: 300; line-height: 1.7;
    max-width: 480px; margin: 0 auto 48px; position: relative; z-index: 1;
  }
  .sc-finale-status {
    font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-ghost);
    letter-spacing: 0.04em; position: relative; z-index: 1; margin-top: 40px;
  }

  /* BUTTONS */
  .sc-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 22px;
    border-radius: 10px; font-family: var(--font-mono); font-size: 0.78rem;
    border: 1px solid var(--border); background: transparent; color: var(--ink-dim);
    letter-spacing: 0.04em; transition: all 0.2s var(--ease-out); white-space: nowrap;
    position: relative; overflow: hidden;
    box-sizing: border-box;
    line-height: 1;
    height: 38px;
    vertical-align: middle;
  }
  .sc-btn:hover { border-color: rgba(232,240,255,0.2); color: var(--ink); background: var(--ink-whisper); }
  .sc-btn:active { transform: scale(0.97); }
  .sc-btn-accent { background: var(--accent); border-color: var(--accent); color: #060d14; }
  .sc-btn-accent:hover { background: #72ffda; border-color: #72ffda; color: #060d14; }
  .sc-btn-sm { padding: 0 14px; font-size: 0.72rem; height: 36px; }
  .sc-btn-lg { padding: 0 32px; font-size: 0.88rem; border-radius: 12px; height: 48px; }

  /* DIVIDER */
  .sc-divider { max-width: 1160px; margin: 0 auto; padding: 0 clamp(24px, 5vw, 72px); }
  .sc-divider hr { border: none; border-top: 1px solid var(--border); }

  /* REVEAL */
  .sc-reveal {
    opacity: 0; transform: translateY(32px);
    transition: opacity 0.7s var(--ease-out), transform 0.7s var(--ease-out);
  }
  .sc-reveal.d1 { transition-delay: 0.1s; }
  .sc-reveal.d2 { transition-delay: 0.2s; }
  .sc-reveal.d3 { transition-delay: 0.3s; }
  .sc-reveal.in-view { opacity: 1; transform: translateY(0); }

  /* CODE COLORS */
  .ck { color: #7c6bff; }
  .cf { color: #4ff8c8; }
  .cs { color: #f5c842; }
  .cc { color: rgba(232,240,255,0.3); font-style: italic; }
  .cv { color: #ff9d8a; }

  @keyframes sc-reveal { to { opacity: 1; transform: translateY(0); } }
  @keyframes sc-float-a {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(30px,-20px) scale(1.05); }
    66% { transform: translate(-20px,15px) scale(0.97); }
  }
  @keyframes sc-float-b {
    0%, 100% { transform: translate(0,0) scale(1); }
    40% { transform: translate(-25px,20px) scale(1.04); }
    70% { transform: translate(20px,-10px) scale(0.98); }
  }
  @keyframes sc-particle {
    0% { left: 0; opacity: 1; }
    100% { left: 100%; opacity: 0; }
  }

  @media (max-width: 860px) {
    .sc-rules-grid, .sc-derived-grid { grid-template-columns: 1fr; }
    .sc-demo-split { grid-template-columns: 1fr; }
    .sc-flow-grid { grid-template-columns: 1fr; gap: 16px; }
    .sc-arrow { transform: rotate(90deg); }
    .sc-theme-canvas { grid-template-columns: 1fr; }
    .sc-palette-list { flex-direction: row; flex-wrap: wrap; }
    .sc-principles-intro { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    body { cursor: auto; }
    a, button { cursor: pointer; }
    #sc-cursor, #sc-cursor-ring { display: none; }
  }
`;

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const PALETTES = [
  {
    id: 'slate', label: 'Slate', swatch: '#4ff8c8',
    bg: 'rgba(17,24,39,0.95)', border: 'rgba(79,248,200,0.2)',
    titleColor: '#e8f0ff', textColor: 'rgba(232,240,255,0.6)',
    btnBg: 'rgba(79,248,200,0.1)', btnBorder: 'rgba(79,248,200,0.4)', btnColor: '#4ff8c8',
    snippet: "setTheme({ accent: '#4ff8c8' })",
  },
  {
    id: 'violet', label: 'Violet', swatch: '#a78bfa',
    bg: 'rgba(15,13,30,0.95)', border: 'rgba(167,139,250,0.25)',
    titleColor: '#ede9fe', textColor: 'rgba(237,233,254,0.6)',
    btnBg: 'rgba(167,139,250,0.1)', btnBorder: 'rgba(167,139,250,0.4)', btnColor: '#a78bfa',
    snippet: "setTheme({ accent: '#a78bfa' })",
  },
  {
    id: 'amber', label: 'Amber', swatch: '#fbbf24',
    bg: 'rgba(23,18,9,0.95)', border: 'rgba(251,191,36,0.25)',
    titleColor: '#fef3c7', textColor: 'rgba(254,243,199,0.6)',
    btnBg: 'rgba(251,191,36,0.1)', btnBorder: 'rgba(251,191,36,0.4)', btnColor: '#fbbf24',
    snippet: "setTheme({ accent: '#fbbf24' })",
  },
  {
    id: 'rose', label: 'Rose', swatch: '#fb7185',
    bg: 'rgba(23,9,14,0.95)', border: 'rgba(251,113,133,0.25)',
    titleColor: '#ffe4e6', textColor: 'rgba(255,228,230,0.6)',
    btnBg: 'rgba(251,113,133,0.1)', btnBorder: 'rgba(251,113,133,0.4)', btnColor: '#fb7185',
    snippet: "setTheme({ accent: '#fb7185' })",
  },
  {
    id: 'ice', label: 'Ice', swatch: '#67e8f9',
    bg: 'rgba(8,17,26,0.95)', border: 'rgba(103,232,249,0.22)',
    titleColor: '#ecfeff', textColor: 'rgba(236,254,255,0.6)',
    btnBg: 'rgba(103,232,249,0.08)', btnBorder: 'rgba(103,232,249,0.35)', btnColor: '#67e8f9',
    snippet: "setTheme({ accent: '#67e8f9' })",
  },
];

function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function scrollToTop() {
  scrollToSection('sc-top');
}

// ─────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────

function HeroSection(ctx) {
  return Box(
    Box().className('sc-orb sc-orb-1'),
    Box().className('sc-orb sc-orb-2'),
    Box(
      Paragraph('Runtime-first UI engine · v2.0.0').className('sc-hero-eyebrow'),
      Title(
        'Build',
        LineBreak(),
        Span('reactive').className('sc-accent'),
        LineBreak(),
        'interfaces.',
      ).className('sc-hero-title').level(1),
      Paragraph(
        'Plain JavaScript. Fine-grained reactivity. Fluent DOM modifiers. No compiler, no virtual DOM, no hidden magic.',
      ).className('sc-hero-sub'),
      Box(
        Button('signal()').className('sc-pill').onClick(() => scrollToSection('reactivity')),
        Button('computed()').className('sc-pill').onClick(() => scrollToSection('derived')),
        Button('effect()').className('sc-pill').onClick(() => scrollToSection('flow')),
        Button('createForm()').className('sc-pill'),
        Button('createRouter()').className('sc-pill'),
        Button('page()').className('sc-pill'),
      ).className('sc-pills'),
      Box(
        VStack(
          Span('live signal value').className('sc-counter-label'),
          Span(() => String(ctx.hero.count()))
            .className(() => `sc-counter-display${ctx.hero.bump() ? ' bump' : ''}`),
          HStack(
            Button('+ increment').className('sc-btn sc-btn-accent sc-btn-sm')
              .onClick(() => ctx.hero.count(v => v + 1)),
            Button('- decrement').className('sc-btn sc-btn-sm')
              .onClick(() => ctx.hero.count(v => v - 1)),
            Button('reset').className('sc-btn sc-btn-sm')
              .onClick(() => ctx.hero.count(0)),
          ).className('sc-action-row').style({ alignItems: 'center' }),
        ).gap(12).height('200px').justifyContent('space-around'),
        Paragraph().text(() => ctx.hero.countNote()).className('sc-counter-note'),
      ).className('sc-hero-demo'),
    ).className('sc-hero').padding('12px'),
  ).style({ position: 'relative', overflow: 'hidden' });
}

function PrinciplesSection() {
  return Section(
    Box(
      Box(
        Paragraph('Core rules').className('sc-label'),
        VStack(
          Title('Small rules. Direct output.').className('sc-section-title').level(2),
          Paragraph(
            'Feather has one rule that governs everything. Functions define reactivity. Read reactive values inside functions, and the binding stays live and explicit.',
          ).className('sc-section-desc'),
        ).className('sc-principles-intro').justifyContent('space-evenly').minHeight('320px'),
      ).className('sc-reveal'),
      Box(
        RuleCard('01', 'Functions make it live.', 'Wrap reactive reads in functions and the binding stays hot. Skip the function and the current value gets captured once.',
          [
            Span('const').className('ck'), ' count = ', Span('signal').className('cf'), '(0);\n',
            Span('// ✓ live:').className('cc'), '\n',
            'Text(', Span('() => count()').className('cs'), ')\n',
            Span('// ✗ dead:').className('cc'), '\n',
            'Text(', Span('count()').className('cv'), ')',
          ],
        ),
        RuleCard('02', 'Signals are callable.', 'Call a signal with no args to read, with a value to set, or with an updater function to transform from the previous value.',
          [
            Span('const').className('ck'), ' name = ', Span('signal').className('cf'), '(', Span("'Feather'").className('cs'), ');\n',
            'name(', Span("'Updated'").className('cs'), ');\n',
            'name(v => v + ', Span("'!'").className('cs'), ');',
          ],
        ),
        RuleCard('03', 'Computed derives state.', 'Computed values re-run only when their dependencies change. They memoize the last result and skip unnecessary work.',
          [
            Span('const').className('ck'), ' full = ', Span('computed').className('cf'), '(\n',
            '  () => ', Span('`${first()} ${last()}`').className('cs'), '\n',
            ');',
          ],
        ),
      ).className('sc-rules-grid sc-reveal'),
    ).className('sc-section sc-section-principles'),
  ).id('principles');
}

function RuleCard(num, title, body, codeChildren) {
  return Box(
    Paragraph(num).className('sc-rule-num'),
    Paragraph(title).className('sc-rule-title'),
    Paragraph(body).className('sc-rule-body'),
    El('pre', { class: 'sc-rule-code' }, El('code', ...codeChildren)),
  ).className('sc-rule-card');
}

function ReactivitySection(ctx) {
  return Section(
    Box(
      Box(
        Paragraph('Reactivity in action').className('sc-label'),
        Title('Everything updates. Nothing surprises.').className('sc-section-title').level(2).style({ marginBottom: '14px' }),
        Paragraph('Type in the input. The derived preview updates instantly. The character count follows. No diffing, no reconciliation.').style({ color: 'var(--ink-dim)', fontWeight: '300', lineHeight: '1.7', maxWidth: '480px' }),
      ).className('sc-reveal'),
      Box(
        // Code pane
        Box(
          Box(
            Box().className('sc-dot').style({ background: '#ff6b8a' }),
            Box().className('sc-dot').style({ background: '#f5c842' }),
            Box().className('sc-dot').style({ background: '#4ff8c8' }),
            Span('reactive-input.js').className('sc-code-label'),
          ).className('sc-code-bar'),
          El('pre', { class: 'sc-code-body' },
            El('code',
              Span('import').className('ck'), ' { ', Span('signal').className('cf'), ', ', Span('computed').className('cf'), ' }\n',
              '  ', Span('from').className('ck'), ' ', Span("'../feather/index.js'").className('cs'), ';\n\n',
              Span('// A signal holds the raw value.').className('cc'), '\n',
              Span('const').className('ck'), ' ', Span('message').className('cv'), ' = ', Span('signal').className('cf'), '(', Span("''").className('cs'), ');\n\n',
              Span('// computed() derives without side-effects.').className('cc'), '\n',
              Span('const').className('ck'), ' ', Span('charCount').className('cv'), ' = ', Span('computed').className('cf'), '(\n',
              '  () => ', Span('message').className('cv'), '().length\n',
              ');\n\n',
              Span('// Bindings stay live because').className('cc'), '\n',
              Span("// the reactive read stays inside a function.").className('cc'), '\n\n',
              Span('Input').className('cf'), '()\n',
              '  .', Span('onInput').className('cf'), '((e) => ', Span('message').className('cv'), '(e.target.value))\n',
              '  .', Span('placeholder').className('cf'), '(', Span("'type anything…'").className('cs'), ');\n\n',
              Span('Paragraph').className('cf'), '()\n',
              '  .', Span('text').className('cf'), '(() => ', Span('charCount').className('cv'), '() + ', Span("' chars'").className('cs'), ');',
            ),
          ),
        ).className('sc-code-pane sc-reveal d1'),
        // Live pane
        VStack(
          Box(
            Paragraph('signal — message').className('sc-live-label'),
            Input()
              .id('sc-msg-input')
              .placeholder('type anything…')
              .attr('maxlength', '120')
              .className('sc-live-input')
              .onInput((e) => ctx.reactive.message(e.target.value)),
          ).className('sc-live-card').id('sc-card-input'),
          Box(
            Paragraph('computed — preview').className('sc-live-label'),
            Paragraph()
              .text(() => ctx.reactive.message() || 'Start typing…')
              .className('sc-live-preview')
              .style(() => ({
                color: ctx.reactive.message() ? 'var(--ink)' : 'var(--ink-ghost)',
                fontStyle: ctx.reactive.message() ? 'normal' : 'italic',
              })),
          ).className('sc-live-card').id('sc-card-preview'),
          HStack(
            Box(
              Paragraph('computed — chars').className('sc-live-label'),
              Span(() => String(ctx.reactive.charCount()))
                .className(() => `sc-live-value${ctx.reactive.flashChars() ? ' flash' : ''}`),
            ).className('sc-live-card').id('sc-card-chars').style({ flex: '1 1 220px' }),
            Box(
              Paragraph('computed — words').className('sc-live-label'),
              Span(() => String(ctx.reactive.wordCount()))
                .className(() => `sc-live-value${ctx.reactive.flashWords() ? ' flash' : ''}`),
            ).className('sc-live-card').id('sc-card-words').style({ flex: '1 1 220px' }),
          ).style({
            flexWrap: 'wrap',
            alignItems: 'stretch',
            columnGap: '32px',
            rowGap: '24px',
            marginTop: '4px',
          }),
        ).className('sc-live-pane sc-reveal d2').justifyContent('space-around'),
      ).className('sc-demo-split'),
    ).className('sc-section'),
  ).id('reactivity');
}

function DerivedSection(ctx) {
  return Section(
    Box(
      VStack(
        Paragraph('Computed chains').className('sc-label'),
        Title('State flows downstream.').className('sc-section-title').level(2).style({ marginBottom: '14px' }),
        Paragraph('Computed values chain. Change a source signal and the entire dependency graph updates in a single microtask flush.').style({ color: 'var(--ink-dim)', fontWeight: '300', lineHeight: '1.7', maxWidth: '480px' }),
      ).className('sc-reveal'),
      Box(
        Box(
          Paragraph('source signal').className('sc-derived-label'),
          Span(() => String(ctx.derived.a())).className('sc-derived-num').style({ color: '#9b8fff' }),
          Paragraph('const a = signal(5)').className('sc-derived-formula'),
          HStack(
            Button('+1').className('sc-btn sc-btn-sm').onClick(() => ctx.derived.a(v => v + 1)),
            Button('-1').className('sc-btn sc-btn-sm').onClick(() => ctx.derived.a(v => v - 1)),
          ).className('sc-derived-controls sc-action-row'),
        ).className('sc-derived-cell'),
        Box(
          Box(Span('→ ', { class: 'arr' }), 'computed × 2').className('sc-derived-label'),
          Span(() => String(ctx.derived.b())).className('sc-derived-num').style({ color: 'var(--accent)' }),
          Paragraph(() => `computed(() => a() * 2)`).className('sc-derived-formula'),
        ).className('sc-derived-cell'),
        Box(
          Box(Span('→→ ', { class: 'arr' }), 'computed + 100').className('sc-derived-label'),
          Span(() => String(ctx.derived.c())).className('sc-derived-num').style({ color: '#ff6b8a' }),
          Paragraph(() => `computed(() => b() + 100)`).className('sc-derived-formula'),
        ).className('sc-derived-cell'),
      ).className('sc-derived-grid sc-reveal d1'),
    ).className('sc-section'),
  ).id('derived');
}

function FlowSection(ctx) {
  return Section(
    Box(
      Box(
        Paragraph('Signal propagation').className('sc-label'),
        Title('One write. All observers fire.').className('sc-section-title').level(2).style({ marginBottom: '14px' }),
        Paragraph('Feather tracks which observers read each signal during their last run. When a signal changes, only affected observers are scheduled.').style({ color: 'var(--ink-dim)', fontWeight: '300', lineHeight: '1.7', maxWidth: '480px' }),
      ).className('sc-reveal'),
      VStack(
        Box(
          // Signal node
          Box(
            Paragraph('signal').className('sc-flow-kind s'),
            Span(() => String(ctx.flow.count())).className('sc-flow-val').style({ color: '#9b8fff' }),
            Paragraph('count').className('sc-flow-name'),
          ).className(() => `sc-flow-node sn${ctx.flow.pulseSignal() ? ' pulse-s' : ''}`),
          // Arrow 1
          Box(
            Box(
              Box().className('sc-particle').id('sc-p1'),
            ).className(() => `sc-arrow-line${ctx.flow.lit1() ? ' lit' : ''}`),
          ).className('sc-arrow'),
          // Computed node
          Box(
            Paragraph('computed').className('sc-flow-kind c'),
            Span(() => String(ctx.flow.doubled())).className('sc-flow-val').style({ color: 'var(--accent)' }),
            Paragraph('doubled').className('sc-flow-name'),
          ).className(() => `sc-flow-node cn${ctx.flow.pulseComputed() ? ' pulse' : ''}`),
          // Arrow 2
          Box(
            Box(
              Box().className('sc-particle').id('sc-p2'),
            ).className(() => `sc-arrow-line${ctx.flow.lit2() ? ' lit' : ''}`),
          ).className('sc-arrow'),
          // Effect node
          Box(
            Paragraph('effect').className('sc-flow-kind e'),
            Span(() => ctx.flow.effectLabel()).className('sc-flow-val').style({ color: 'var(--accent-3)' }),
            Paragraph('side-effect').className('sc-flow-name'),
          ).className(() => `sc-flow-node en${ctx.flow.pulseEffect() ? ' pulse-e' : ''}`),
        ).className('sc-flow-grid'),
        HStack(
          Button('trigger count(v => v + 1)').className('sc-btn sc-btn-accent sc-btn-sm').onClick(() => ctx.flow.trigger()),
          Button('reset').className('sc-btn sc-btn-sm').onClick(() => ctx.flow.reset()),
        ).style({ justifyContent: 'space-between' }).className('sc-flow-footer sc-action-row'),
      ).className('sc-flow-canvas sc-reveal d1').margin({ top: '48px' }),
    ).className('sc-section'),
  ).id('flow');
}

function ThemeSection(ctx) {
  return Section(
    Box(
      Box(
        Paragraph('Theme system').className('sc-label'),
        Title('The palette shifts. The structure stays.').className('sc-section-title').level(2).style({ marginBottom: '14px' }),
        Paragraph('One signal controls the active palette. Every bound element updates atomically. The component tree never re-renders — bindings pull the new values.').style({ color: 'var(--ink-dim)', fontWeight: '300', lineHeight: '1.7', maxWidth: '480px' }),
      ).className('sc-reveal'),
      Box(
        // Palette list
        VStack(
          ForEach(PALETTES, (p) =>
            Button(
              Box().className('sw').style({ background: p.swatch, width: '12px', height: '12px', borderRadius: '50%', flexShrink: '0' }),
              p.label,
            ).className(() => `sc-palette-btn${ctx.theme.selected() === p.id ? ' active' : ''}`).onClick(() => ctx.theme.selected(p.id)),
          ),
        ).className('sc-palette-list'),
        // Theme preview
        Box(
          Paragraph().text(() => ctx.theme.active().snippet).className('sc-theme-pname').style(() => ({ color: ctx.theme.active().btnColor })),
          Subtitle().level(3).text(() => ctx.theme.active().label).className('sc-theme-title').style(() => ({ color: ctx.theme.active().titleColor })),
          Paragraph('The structure is identical across every palette. Only the token values change. That\'s what fine-grained reactivity enables.').className('sc-theme-text').style(() => ({ color: ctx.theme.active().textColor })),
          Box('Primary action').className('sc-theme-btn').style(() => ({
            background: ctx.theme.active().btnBg,
            borderColor: ctx.theme.active().btnBorder,
            color: ctx.theme.active().btnColor,
          })),
        ).className('sc-theme-preview').style(() => ({
          background: ctx.theme.active().bg,
          borderColor: ctx.theme.active().border,
        })),
      ).className('sc-theme-canvas sc-reveal d1'),
    ).className('sc-section'),
  ).id('theme-demo');
}

function FinaleSection(ctx) {
  return Section(
    Title(
      'Simple.', LineBreak(),
      Span('Reactive.').style({
        background: 'linear-gradient(135deg,var(--accent),var(--accent-2))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }), LineBreak(),
      'Feather.',
    ).className('sc-finale-title').level(2),
    Paragraph('State is explicit. Bindings are obvious. DOM output stays close to the code that defines it.').className('sc-finale-sub'),
    HStack(
      Button('Back to top').className('sc-btn sc-btn-accent sc-btn-lg')
        .onClick(() => scrollToTop()),
      Button('Reset all demos').className('sc-btn sc-btn-lg')
        .onClick(() => ctx.actions.resetAll()),
    ).gap(12).style({ justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: '1' }),
    Paragraph()
      .text(() => `count ${ctx.hero.count()} · chars ${ctx.reactive.charCount()} · source ${ctx.derived.a()} · palette ${ctx.theme.active().label}`)
      .className('sc-finale-status'),
  ).className('sc-finale sc-reveal').id('finale');
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

const ShowcasePage = page({
  name: 'ShowcasePage',

  setup(ctx) {
    // Hero
    const heroCount = signal(0);
    const heroBump = signal(false);
    const heroCountNote = computed(() => {
      const v = heroCount();
      if (v === 0) return 'Nothing changed yet.';
      if (v === 1) return 'One signal changed.';
      if (v < 0) return `${Math.abs(v)} below zero.`;
      return `${v} direct signal calls.`;
    });

    // Reactive input
    const message = signal('');
    const charCount = computed(() => message().length);
    const wordCount = computed(() => message().trim() ? message().trim().split(/\s+/).length : 0);
    const flashChars = signal(false);
    const flashWords = signal(false);

    // Derived chain
    const derivedA = signal(5);
    const derivedB = computed(() => derivedA() * 2);
    const derivedC = computed(() => derivedB() + 100);

    // Signal flow
    const flowCount = signal(0);
    const flowDoubled = computed(() => flowCount() * 2);
    const flowEffectLabel = signal('idle');
    const flowPulseSignal = signal(false);
    const flowPulseComputed = signal(false);
    const flowPulseEffect = signal(false);
    const flowLit1 = signal(false);
    const flowLit2 = signal(false);

    const triggerFlow = () => {
      flowCount(v => v + 1);
      flowPulseSignal(true);
      ctx.timeout(() => flowPulseSignal(false), 400, 'lifetime');

      ctx.timeout(() => {
        flowLit1(true);
        const p1 = document.getElementById('sc-p1');
        if (p1) { p1.style.animation = 'none'; p1.offsetHeight; p1.style.animation = 'sc-particle 0.4s linear forwards'; }
        ctx.timeout(() => {
          flowLit1(false);
          flowPulseComputed(true);
          ctx.timeout(() => flowPulseComputed(false), 400, 'lifetime');
          ctx.timeout(() => {
            flowLit2(true);
            const p2 = document.getElementById('sc-p2');
            if (p2) { p2.style.animation = 'none'; p2.offsetHeight; p2.style.animation = 'sc-particle 0.4s linear forwards'; }
            ctx.timeout(() => {
              flowLit2(false);
              flowEffectLabel(`ran ×${flowCount()}`);
              flowPulseEffect(true);
              ctx.timeout(() => flowPulseEffect(false), 400, 'lifetime');
            }, 420, 'lifetime');
          }, 420, 'lifetime');
        }, 420, 'lifetime');
      }, 100, 'lifetime');
    };

    const resetFlow = () => {
      flowCount(0);
      flowEffectLabel('idle');
    };

    // Theme
    const selectedPalette = signal('slate');
    const activePalette = computed(() => PALETTES.find(p => p.id === selectedPalette()) || PALETTES[0]);

    // Reset all
    const resetAll = () => {
      heroCount(0);
      message('');
      derivedA(5);
      resetFlow();
      selectedPalette('slate');
      scrollToTop();
    };

    return setupState(
      setupGroup('hero', {
        count: heroCount,
        bump: heroBump,
        countNote: heroCountNote,
      }),
      setupGroup('reactive', {
        message,
        charCount,
        wordCount,
        flashChars,
        flashWords,
      }),
      setupGroup('derived', {
        a: derivedA,
        b: derivedB,
        c: derivedC,
      }),
      setupGroup('flow', {
        count: flowCount,
        doubled: flowDoubled,
        effectLabel: flowEffectLabel,
        pulseSignal: flowPulseSignal,
        pulseComputed: flowPulseComputed,
        pulseEffect: flowPulseEffect,
        lit1: flowLit1,
        lit2: flowLit2,
        trigger: triggerFlow,
        reset: resetFlow,
      }),
      setupGroup('theme', {
        selected: selectedPalette,
        active: activePalette,
      }),
      setupGroup('actions', { resetAll }),
    );
  },

  mount(ctx) {
    // Cursor
    const cursorDot = document.getElementById('sc-cursor');
    const cursorRing = document.getElementById('sc-cursor-ring');
    let cx = 0, cy = 0, rx = 0, ry = 0;
    const onMove = (e) => {
      cx = e.clientX; cy = e.clientY;
      cursorDot.style.left = cx + 'px';
      cursorDot.style.top = cy + 'px';
    };
    ctx.bind(document, 'mousemove', onMove);
    const animRing = () => {
      rx += (cx - rx) * 0.12; ry += (cy - ry) * 0.12;
      cursorRing.style.left = rx + 'px'; cursorRing.style.top = ry + 'px';
      requestAnimationFrame(animRing);
    };
    animRing();

    // Scroll progress + nav
    const progressBar = document.getElementById('sc-progress');
    const navEl = document.getElementById('sc-nav');
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = `scaleX(${window.scrollY / total})`;
      navEl.classList.toggle('scrolled', window.scrollY > 40);
    };
    ctx.bind(window, 'scroll', onScroll, { passive: true });

    // Hero count bump effect
    ctx.hero.count.subscribe(() => {
      ctx.hero.bump(true);
      ctx.timeout(() => ctx.hero.bump(false), 200, 'lifetime');
    });

    // Flash computed values on input
    ctx.reactive.charCount.subscribe(() => {
      ctx.reactive.flashChars(true);
      ctx.timeout(() => ctx.reactive.flashChars(false), 200, 'lifetime');
    });
    ctx.reactive.wordCount.subscribe(() => {
      ctx.reactive.flashWords(true);
      ctx.timeout(() => ctx.reactive.flashWords(false), 200, 'lifetime');
    });

    // Scroll reveal
    const reveals = ctx.$all('.sc-reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(n => n.classList.add('in-view'));
      return;
    }
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); revealObs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(n => revealObs.observe(n));
    ctx.cleanup(() => revealObs.disconnect(), 'lifetime');
  },

  render(ctx) {
    return Box(
      El('style', {}, STYLES),
      Box().className('sc-backlight sc-backlight-a'),
      Box().className('sc-backlight sc-backlight-b'),
      Box().className('sc-backlight sc-backlight-c'),
      Box().id('sc-cursor'),
      Box().id('sc-cursor-ring'),
      Box().id('sc-progress'),

      // NAV
      El('nav', { id: 'sc-nav', class: 'sc-nav' },
        Link(
          Box().className('sc-nav-mark'),
          'Feather',
        ).href('#').className('sc-nav-logo'),
        Box(
          Span('No JSX'),
          Span('No templates'),
          Span('No vDOM'),
        ).className('sc-nav-tags'),
      ),

      // SECTIONS
      HeroSection(ctx).id('sc-top'),
      Box(Box(Divider()).className('sc-divider')),
      PrinciplesSection(),
      Box(Box(Divider()).className('sc-divider')),
      ReactivitySection(ctx),
      Box(Box(Divider()).className('sc-divider')),
      DerivedSection(ctx),
      Box(Box(Divider()).className('sc-divider')),
      FlowSection(ctx),
      Box(Box(Divider()).className('sc-divider')),
      ThemeSection(ctx),
      Box(Box(Divider()).className('sc-divider')),
      FinaleSection(ctx),
    );
  },
});

export default ShowcasePage;
