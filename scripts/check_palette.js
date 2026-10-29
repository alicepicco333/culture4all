// WCAG 2.1 contrast and colour-vision-deficiency check for the Culture for All palette (option 4: charcoal hero panel, light khaki ground, blue-grey and terracotta), adapted from the Kyiv Biennial 2025 website
// (2025.kyivbiennial.org: --orange #ff6a25, --grey #bcc7ca, --brown #caba8d, --black #333, --white #fff), values as in assets/css/story.css.
// usage: node scripts/check_palette.js   (no dependencies). Simulation: Machado et al. 2009, severity 1.0.
const T = {
  light: {
    paper: '#EEEADF', surface: '#F8F6F0', ink: '#303234', ink2: '#47494B', muted: '#5E5F5F', rule: '#D6D1C3', grid: '#E4DFD2',
    tab: '#303234', tabInk: '#FFFFFF', accent: '#A9583A', rest: '#61737A', focus: '#303234', na: '#E4DFD2', land: '#D8D1BF',
    hl: '#C7B892', hlInk: '#303234', field: '#303234', fieldInk: '#EEEADF', heroHl: '#C7B892', heroHlInk: '#303234',
    books: ['#61737A', '#6D808A', '#56676E'], southBooks: ['#A9583A', '#B4644A', '#9A4E33'],
    seq: ['#F6F4EE', '#CBD3D6', '#9DABB0', '#5F7077', '#454F54', '#2B3336'],
  },
  dark: {
    paper: '#262626', surface: '#303030', ink: '#F2F2F0', ink2: '#CFCFCB', muted: '#A8A8A4', rule: '#454545', grid: '#303234',
    tab: '#F2F2F0', tabInk: '#262626', accent: '#E07C62', rest: '#A9B6BA', focus: '#F2F2F0', na: '#303234', land: '#313638',
    hl: '#C7B892', hlInk: '#303234', field: '#C7B892', fieldInk: '#262626', heroHl: '#EEEADF', heroHlInk: '#262626',
    books: ['#A9B6BA', '#BCC7CA', '#94A3A8'], southBooks: ['#E07C62', '#E88E76', '#D06E55'],
    seq: ['#33393B', '#435055', '#5A6C73', '#93A8AF', '#BCC9CD', '#E4EAEC'],
  },
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const sim = (h, m) => { const v = hex(h).map(lin); const o = m.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2]))); const g = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055); return '#' + o.map((c) => Math.round(g(c) * 255).toString(16).padStart(2, '0')).join(''); };
const lab = (h) => { const [r, g, b] = hex(h).map(lin); let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883; const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
let fail = 0;
for (const [mode, t] of Object.entries(T)) {
  console.log(`\n== ${mode}`);
  const pairs = [
    ['ink on paper', t.ink, t.paper, 4.5], ['ink on surface', t.ink, t.surface, 4.5], ['ink-2 on paper', t.ink2, t.paper, 4.5], ['muted on paper', t.muted, t.paper, 4.5], ['muted on surface', t.muted, t.surface, 4.5],
    ['button text on button', t.tabInk, t.tab, 4.5],
    ['South marks on paper', t.accent, t.paper, 3], ['South marks on surface', t.accent, t.surface, 3], ['South marks on land', t.accent, t.land, 3],
    ['North & centre marks on paper', t.rest, t.paper, 3], ['North & centre marks on surface', t.rest, t.surface, 3], ['North & centre marks on land', t.rest, t.land, 3],
    ['ink on the khaki accent (open tab, highlighter)', t.hlInk, t.hl, 4.5], ['focus ring on paper', t.focus, t.paper, 3],
    ['hero: type on the panel', t.fieldInk, t.field, 4.5], ['hero: ink on the highlighter', t.heroHlInk, t.heroHl, 4.5], ['hero: panel vs ground (shape)', t.field, t.paper, 1],
    ['seq-6 vs paper', t.seq[5], t.paper, 3],
    ...t.books.map((c, i) => [`hero North book ${i + 1} on paper`, c, t.paper, 3]), ...t.southBooks.map((c, i) => [`hero South book ${i + 1} on paper`, c, t.paper, 3]),
  ];
  for (const [n, a, b, min] of pairs) { const r = cr(a, b); const ok = r >= min; if (!ok) fail++; console.log(`${ok ? 'ok ' : 'LOW'} ${r.toFixed(2).padStart(5)}:1  ${n}  ${a} / ${b}  (min ${min})`); }
  console.log(`   note: khaki on paper ${cr(t.hl, t.paper).toFixed(2)}:1 -> ${cr(t.hl, t.paper) >= 3 ? 'may be a mark' : 'field only, always carrying ink'}`);
  t.seq.forEach((c, i) => { const a = cr('#303234', c), b = cr('#FFFFFF', c); console.log(`   band ${i + 1} ${c}: ink ${a.toFixed(2)}  white ${b.toFixed(2)} -> ${a >= b ? 'ink' : 'white'} ${Math.max(a, b) >= 4.5 ? 'AA' : 'LOW'}`); if (Math.max(a, b) < 4.5) fail++; });
  for (const [k, m] of [['normal', null], ...Object.entries(M)]) {
    const s = (c) => (m ? sim(c, m) : c);
    const ls = t.seq.map((c) => L(s(c)));
    const mono = ls.every((v, i) => i === 0 || (mode === 'light' ? v < ls[i - 1] : v > ls[i - 1]));
    const minStep = Math.min(...t.seq.slice(1).map((c, i) => dE(s(c), s(t.seq[i]))));
    const ar = dE(s(t.accent), s(t.rest)), ah = dE(s(t.accent), s(t.hl)), bk = dE(s(t.southBooks[0]), s(t.books[0]));
    if (!mono) fail++;
    if (ar < 20) fail++;
    console.log(`   ${k.padEnd(7)} ramp monotonic ${mono}  min step dE ${minStep.toFixed(1)}  South vs North dE ${ar.toFixed(1)}  South vs khaki dE ${ah.toFixed(1)}  hero South vs North books dE ${bk.toFixed(1)}`);
  }
}
console.log(fail ? `\n${fail} FAIL` : '\nall pass');
