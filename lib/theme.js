export const C = {
  bg: "#07070f",
  surface: "rgba(255,255,255,0.034)",
  border: "rgba(255,255,255,0.07)",
  accent: "#7c6bff",
  accentSoft: "rgba(124,107,255,0.15)",
  accentBorder: "rgba(124,107,255,0.28)",
  green: "#22d3a0",
  amber: "#f6a430",
  red: "#f05c7a",
  text: "rgba(255,255,255,0.88)",
  muted: "rgba(255,255,255,0.42)",
  faint: "rgba(255,255,255,0.12)",
};

export const FONTS = {
  title: "'Instrument Serif', serif",
  body: "'Syne', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07070f; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(120,100,255,0.3); border-radius: 4px; }
  input, textarea, button { font-family: inherit; }
  textarea:focus, input:focus { outline: none; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px);} to { opacity:1; transform:translateY(0);} }
  @keyframes fadeIn { from { opacity:0;} to { opacity:1;} }
  @keyframes pulse { 0%,100%{opacity:.35;} 50%{opacity:1;} }
  @keyframes blink { 0%,100%{opacity:0;} 40%{opacity:1;} }
  @keyframes shimmer { 0%{background-position:-400px 0;} 100%{background-position:400px 0;} }
`;
