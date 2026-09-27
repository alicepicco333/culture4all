/* Culture for All: the atlas. 19,168 institutions on a canvas map.
   Zoomed out, points are counted into screen-space hexagons (click one to zoom in);
   zoomed in, every place is its own mark and opens a record card.
   Data: data/story/atlas_points.json (all points) + data/story/atlas/<region>.json
   (record details, fetched only when a card is opened). */
(function () {
  "use strict";
  const { fmt, css, reduced, showTip, hideTip } = window.C4A;
  const $ = (id) => document.getElementById(id);
  const frame = $("map-frame"), canvas = $("atlas-canvas"), ctx = canvas.getContext("2d");
  const TYPES = ["Library", "Museum", "Archive", "Heritage site"];
  const TYPE_PL = ["libraries", "museums", "archives", "heritage sites"];
  const KEYS = ["k-lib", "k-mus", "k-arc", "k-oth"];
  const COLVAR = ["--c-lib", "--c-mus", "--c-arc", "--c-oth"];
  const HEX_R = 10;             // hexagon radius in CSS px (about 20 px across)
  const DEN_TH = [3, 10, 30, 80]; // places per hexagon: 1-2, 3-9, 10-29, 30-79, 80+
  const keyOf = (s) => s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let A = null, geo = null, land = null, proj = null;
  let W = 0, H = 0, dpr = 1;
  let bx, by;                    // base projected coords (k = 1)
  let t = d3.zoomIdentity;
  let vis = [];                  // indices passing filters
  let qt = null, bins = null;
  const st = { types: [true, true, true, true], entry: "any", selected: -1, focus: -1, hover: -1 };
  const shards = new Map();
  let loading = null, pendingDraw = false;

  const zoom = d3.zoom().scaleExtent([1, 90])
    .filter((e) => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button))
    .on("zoom", (e) => { t = e.transform; hideTip(); requestDraw(); scheduleInView(); });

  // ---------------------------------------------------------------- load
  function load() {
    if (loading) return loading;
    $("atlas-count").textContent = "Loading the atlas…";
    loading = Promise.all([window.C4A.geo, d3.json("data/story/atlas_points.json")]).then(([g, a]) => {
      geo = g; A = a;
      A.nm = null; // search strings built on first search
      layout();
      applyFilters();
      d3.select(canvas).call(zoom).on("dblclick.zoom", null);
      fromHash();
      return A;
    }).catch((err) => { console.error("Could not load the atlas", err); $("atlas-count").textContent = "The atlas could not be loaded."; });
    return loading;
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: "800px 0px" }) : null;
  io ? io.observe($("atlas")) : load();
  $("q").addEventListener("focus", load, { once: true });

  function layout() {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(280, frame.clientWidth);
    H = Math.round(Math.min(W * 1.12, Math.max(420, window.innerHeight * 0.78)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = H + "px";
    proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[8, 8], [W - 8, H - 8]], geo);
    land = new Path2D(d3.geoPath(proj)(geo));
    const n = A.count;
    bx = new Float32Array(n); by = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = proj([A.x[i] / 1e4, A.y[i] / 1e4]); bx[i] = p[0]; by[i] = p[1]; }
    zoom.extent([[0, 0], [W, H]]).translateExtent([[-W * 0.2, -H * 0.2], [W * 1.2, H * 1.2]]);
    t = d3.zoomIdentity; d3.select(canvas).property("__zoom", t);
    rebuildIndex();
  }

  // ---------------------------------------------------------------- filters
  function passes(i) {
    if (!st.types[A.t[i]]) return false;
    if (st.entry === "free") return A.f[i] === 1;
    if (st.entry === "ticket") return A.f[i] === 2;
    return true;
  }
  function applyFilters() {
    vis = [];
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < A.count; i++) {
      const okEntry = st.entry === "any" || (st.entry === "free" ? A.f[i] === 1 : A.f[i] === 2);
      if (okEntry) counts[A.t[i]]++;
      if (passes(i)) vis.push(i);
    }
    document.querySelectorAll("#f-type .n").forEach((el) => { el.textContent = fmt(counts[+el.dataset.n]); });
    if (st.focus >= 0 && !passes(st.focus)) st.focus = -1;
    rebuildIndex();
    const entryTxt = st.entry === "free" ? " with free entry stated" : st.entry === "ticket" ? " with a ticket stated" : "";
    $("atlas-count").textContent = `Showing ${fmt(vis.length)} of ${fmt(A.count)} places${entryTxt}`;
    requestDraw(); scheduleInView();
  }
  function rebuildIndex() {
    if (!A || !bx) return;
    qt = d3.quadtree().x((i) => bx[i]).y((i) => by[i]).addAll(vis);
  }
  document.querySelectorAll("#f-type input").forEach((cb) => cb.addEventListener("change", () => {
    st.types[+cb.value] = cb.checked; if (A) applyFilters();
  }));
  $("f-entry").addEventListener("change", (e) => { st.entry = e.target.value; if (A) applyFilters(); });

  // ---------------------------------------------------------------- drawing
  const dotMode = () => W * t.k >= 2000;
  function requestDraw() {
    if (pendingDraw || !A) return;
    pendingDraw = true;
    requestAnimationFrame(() => { pendingDraw = false; draw(); });
  }
  function hexbin(list) {
    const dx = HEX_R * 2 * Math.sin(Math.PI / 3), dy = HEX_R * 1.5;
    const m = new Map();
    for (const i of list) {
      const x = t.applyX(bx[i]), y = t.applyY(by[i]);
      if (x < -HEX_R || y < -HEX_R || x > W + HEX_R || y > H + HEX_R) continue;
      let py = y / dy, pj = Math.round(py), px = x / dx - (pj & 1) / 2, pi = Math.round(px);
      const py1 = py - pj;
      if (Math.abs(py1) * 3 > 1) {
        const px1 = px - pi, pi2 = pi + (px < pi ? -1 : 1) / 2, pj2 = pj + (py < pj ? -1 : 1), px2 = px - pi2, py2 = py - pj2;
        if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) { pi = pi2 + (pj & 1 ? 1 : -1) / 2; pj = pj2; }
      }
      const k = pi + "," + pj;
      let b = m.get(k);
      if (!b) { b = { x: (pi + (pj & 1) / 2) * dx, y: pj * dy, n: 0, byType: [0, 0, 0, 0], ids: [] }; m.set(k, b); }
      b.n++; b.byType[A.t[i]]++; if (b.ids.length < 400) b.ids.push(i);
    }
    return m;
  }
  function hexPath(c, x, y, r) {
    c.moveTo(x, y - r);
    for (let a = 1; a < 6; a++) c.lineTo(x + r * Math.sin(a * Math.PI / 3), y - r * Math.cos(a * Math.PI / 3));
    c.closePath();
  }
  function shape(c, type, x, y, r) {
    if (type === 1) c.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
    else if (type === 2) { c.moveTo(x, y - r * 1.15); c.lineTo(x + r * 1.1, y + r * 0.85); c.lineTo(x - r * 1.1, y + r * 0.85); c.closePath(); }
    else { c.moveTo(x + r, y); c.arc(x, y, r, 0, 2 * Math.PI); }
  }
  function dotR() { return Math.max(2.6, Math.min(6, 2.6 + (t.k * W / 2000 - 1) * 0.3)); }
  function draw() {
    const paper = css("--paper"), landC = css("--land"), ink = css("--ink"), rule = css("--axis");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.k, t.k);
    ctx.fillStyle = landC; ctx.fill(land);
    ctx.strokeStyle = rule; ctx.lineWidth = 0.6 / t.k; ctx.stroke(land);
    ctx.restore();
    const legend = $("map-legend");
    if (!dotMode()) {
      bins = hexbin(vis);
      const cols = ["--den-1", "--den-2", "--den-3", "--den-4", "--den-5"].map(css);
      const q = d3.scaleThreshold().domain(DEN_TH).range(cols);
      for (const b of bins.values()) { ctx.beginPath(); hexPath(ctx, b.x, b.y, HEX_R - 0.6); ctx.fillStyle = q(b.n); ctx.fill(); }
      if (st.hover >= 0 && st.hoverBin) { ctx.beginPath(); hexPath(ctx, st.hoverBin.x, st.hoverBin.y, HEX_R); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
      if (legend.dataset.mode !== "hex") {
        legend.dataset.mode = "hex";
        legend.innerHTML = `<p>Places per hexagon</p><div class="ramp">${["1–2", "3–9", "10–29", "30–79", "80+"].map((l, i) => `<div><span style="background:var(--den-${i + 1})"></span>${l}</div>`).join("")}</div>`;
      }
      $("atlas-mode").textContent = "Counted in hexagons: zoom in to see single places";
    } else {
      bins = null;
      const r = dotR();
      const byT = [[], [], [], []];
      for (const i of vis) {
        const x = t.applyX(bx[i]), y = t.applyY(by[i]);
        if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
        byT[A.t[i]].push(x, y);
      }
      // draw heritage sites first (neutral), libraries last-but-one, archives on top (fewest)
      for (const ty of [3, 0, 1, 2]) {
        const arr = byT[ty]; if (!arr.length) continue;
        ctx.beginPath();
        for (let j = 0; j < arr.length; j += 2) shape(ctx, ty, arr[j], arr[j + 1], ty === 3 ? r * 0.85 : r);
        if (ty === 3) { ctx.lineWidth = 1.6; ctx.strokeStyle = css(COLVAR[3]); ctx.stroke(); }
        else { ctx.fillStyle = css(COLVAR[ty]); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = paper; ctx.stroke(); }
      }
      const ring = (i, rad, w, col) => {
        if (i < 0) return;
        const x = t.applyX(bx[i]), y = t.applyY(by[i]);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
      };
      ring(st.hover, r + 4, 1.5, ink);
      ring(st.focus, r + 5, 2, ink);
      if (st.focus >= 0) ring(st.focus, r + 8, 1, ink);
      ring(st.selected, r + 5, 3, css("--accent"));
      if (legend.dataset.mode !== "dot") {
        legend.dataset.mode = "dot";
        legend.innerHTML = `<p>One mark per place</p>` + TYPES.map((l, i) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:10px"><svg width="12" height="12" aria-hidden="true"><use href="#${KEYS[i]}"/></svg>${l}</span>`).join("");
      }
      $("atlas-mode").textContent = "One mark per place: click or tap to open";
    }
    // the selected place stays visible in hexagon mode too
    if (!dotMode() && st.selected >= 0) {
      const x = t.applyX(bx[st.selected]), y = t.applyY(by[st.selected]);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fillStyle = css("--accent"); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = paper; ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- picking
  function pointer(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function pick(mx, my) {
    if (!qt) return -1;
    const i = qt.find(t.invertX(mx), t.invertY(my), 12 / t.k);
    return i == null ? -1 : i;
  }
  function binAt(mx, my) {
    if (!bins) return null;
    let best = null, bd = HEX_R * HEX_R;
    for (const b of bins.values()) { const d = (b.x - mx) ** 2 + (b.y - my) ** 2; if (d < bd) { bd = d; best = b; } }
    return best;
  }
  const label = (i) => {
    const town = A.m[i] >= 0 ? A.towns[A.m[i]][0] : null;
    return `${A.n[i]}${town ? ", " + town : ""}`;
  };
  function binTip(b) {
    return `<b>${fmt(b.n)} place${b.n > 1 ? "s" : ""} here</b>` + b.byType.map((c, i) => (c ? `${fmt(c)} ${c > 1 ? TYPE_PL[i] : TYPES[i].toLowerCase()}` : null)).filter(Boolean).join(", ") + "<br>Click to zoom in";
  }
  canvas.addEventListener("mousemove", (e) => {
    if (!A) return;
    const [mx, my] = pointer(e);
    if (dotMode()) {
      const i = pick(mx, my);
      if (i !== st.hover) { st.hover = i; requestDraw(); }
      canvas.classList.toggle("pointer", i >= 0);
      if (i >= 0) showTip(`<b>${esc(A.n[i])}</b>${TYPES[A.t[i]]}${A.m[i] >= 0 ? " · " + esc(A.towns[A.m[i]][0]) : ""}`, e); else hideTip();
    } else {
      const b = binAt(mx, my);
      st.hoverBin = b; st.hover = b ? 1 : -1; requestDraw();
      canvas.classList.toggle("pointer", !!b);
      if (b) showTip(binTip(b), e); else hideTip();
    }
  });
  canvas.addEventListener("mouseleave", () => { st.hover = -1; st.hoverBin = null; hideTip(); requestDraw(); });
  canvas.addEventListener("click", (e) => {
    if (!A) return;
    const [mx, my] = pointer(e);
    if (dotMode()) {
      const i = pick(mx, my);
      if (i >= 0) { st.focus = i; openCard(i, false); }
    } else {
      const b = binAt(mx, my);
      if (b) zoomAround(b.x, b.y, 3);
    }
  });

  // ---------------------------------------------------------------- zoom helpers
  function go(tr) {
    const sel = d3.select(canvas);
    if (reduced.matches) sel.call(zoom.transform, tr); else sel.transition().duration(650).ease(d3.easeCubicOut).call(zoom.transform, tr);
  }
  function zoomAround(x, y, f) {
    const k = Math.min(90, t.k * f), px = t.invertX(x), py = t.invertY(y);
    go(d3.zoomIdentity.translate(W / 2 - px * k, H / 2 - py * k).scale(k));
  }
  function centerOn(i, minK) {
    const k = Math.max(t.k, minK);
    go(d3.zoomIdentity.translate(W / 2 - bx[i] * k, H / 2 - by[i] * k).scale(k));
  }
  function fitIndices(list) {
    if (!list.length) return;
    const xs = list.map((i) => bx[i]), ys = list.map((i) => by[i]);
    const [x0, x1] = d3.extent(xs), [y0, y1] = d3.extent(ys);
    const k = Math.min(90, 0.85 / Math.max((x1 - x0 + 4) / W, (y1 - y0 + 4) / H));
    go(d3.zoomIdentity.translate(W / 2 - ((x0 + x1) / 2) * k, H / 2 - ((y0 + y1) / 2) * k).scale(k));
  }
  $("z-in").addEventListener("click", () => A && zoomAround(W / 2, H / 2, 2));
  $("z-out").addEventListener("click", () => A && zoomAround(W / 2, H / 2, 0.5));
  $("z-reset").addEventListener("click", () => A && go(d3.zoomIdentity));
  const dotK = () => (2000 / W) * 1.6;

  // ---------------------------------------------------------------- keyboard
  const live = (msg) => { $("atlas-live").textContent = msg; };
  function onScreen(i, pad = 0) { const x = t.applyX(bx[i]), y = t.applyY(by[i]); return x >= pad && y >= pad && x <= W - pad && y <= H - pad; }
  function stepFocus(dx, dy) {
    const cand = [];
    const from = st.focus >= 0 && onScreen(st.focus) ? [t.applyX(bx[st.focus]), t.applyY(by[st.focus])] : null;
    if (!from) {
      // start with the place nearest the centre of the view
      const i = qt.find(t.invertX(W / 2), t.invertY(H / 2));
      if (i != null) st.focus = i;
      return;
    }
    const x0 = t.invertX(from[0] - 400), x1 = t.invertX(from[0] + 400), y0 = t.invertY(from[1] - 400), y1 = t.invertY(from[1] + 400);
    qt.visit((node, ax, ay, bx2, by2) => {
      if (!node.length) { let d = node; do { cand.push(d.data); } while ((d = d.next)); }
      return ax > x1 || bx2 < x0 || ay > y1 || by2 < y0;
    });
    let best = -1, bs = Infinity;
    for (const i of cand) {
      if (i === st.focus) continue;
      const vx = t.applyX(bx[i]) - from[0], vy = t.applyY(by[i]) - from[1];
      const along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
      if (along <= 0.5 || across > along * 1.8) continue;
      const s = along + across * 2;
      if (s < bs) { bs = s; best = i; }
    }
    if (best >= 0) st.focus = best; else pan(dx, dy);
  }
  function pan(dx, dy) { go(t.translate((-dx * 120) / t.k, (-dy * 120) / t.k)); }
  frame.addEventListener("keydown", (e) => {
    if (!A || e.target !== frame) return;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key]) {
      e.preventDefault();
      const [dx, dy] = dirs[e.key];
      if (e.shiftKey || !dotMode()) { pan(dx, dy); if (!dotMode()) live("Zoomed out. Press plus or Enter to zoom in, then use the arrow keys to move between places."); return; }
      stepFocus(dx, dy);
      if (st.focus >= 0) {
        if (!onScreen(st.focus, 30)) centerOn(st.focus, t.k);
        live(`${A.n[st.focus]}. ${TYPES[A.t[st.focus]]}${A.m[st.focus] >= 0 ? ", " + A.towns[A.m[st.focus]][0] : ""}. Press Enter to open.`);
      }
      requestDraw();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (dotMode() && st.focus >= 0) openCard(st.focus, true);
      else if (!dotMode()) { zoomAround(W / 2, H / 2, 3); live("Zoomed in."); }
      else { stepFocus(0, 0); requestDraw(); }
    } else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomAround(W / 2, H / 2, 2); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomAround(W / 2, H / 2, 0.5); }
    else if (e.key === "0") { e.preventDefault(); go(d3.zoomIdentity); }
    else if (e.key === "Escape") { closeCard(false); st.focus = -1; requestDraw(); }
  });
  frame.addEventListener("focus", () => { if (A && dotMode() && st.focus < 0) { stepFocus(0, 0); requestDraw(); } });

  // ---------------------------------------------------------------- places in view
  let ivT;
  function scheduleInView() { clearTimeout(ivT); ivT = setTimeout(inView, 220); }
  function inView() {
    if (!A) return;
    const sum = $("inview-sum"), ul = $("inview-list");
    if (!dotMode()) { sum.textContent = "Places in view: zoom in to list them"; ul.innerHTML = ""; return; }
    const list = vis.filter((i) => onScreen(i));
    sum.textContent = `Places in view (${fmt(list.length)})`;
    list.sort((a, b) => A.n[a].localeCompare(A.n[b], "it"));
    const shown = list.slice(0, 120);
    ul.innerHTML = shown.map((i) => `<li><button type="button" data-i="${i}"><svg width="11" height="11" aria-hidden="true" style="margin-right:6px"><use href="#${KEYS[A.t[i]]}"/></svg>${esc(A.n[i])}<span class="sub">${TYPES[A.t[i]]}${A.m[i] >= 0 ? " · " + esc(A.towns[A.m[i]][0]) : ""}</span></button></li>`).join("")
      + (list.length > shown.length ? `<li class="sub" style="padding:6px 2px;color:var(--muted);font-size:14px">and ${fmt(list.length - shown.length)} more: zoom in further</li>` : "");
  }
  $("inview-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    const i = +b.dataset.i; st.focus = i; openCard(i, true);
  });

  // ---------------------------------------------------------------- search
  function buildSearch() {
    if (A.nm) return;
    A.nm = A.n.map((n, i) => norm(n));
    A.tn = A.towns.map((tw) => norm(tw[0]));
  }
  let results = [], active = -1;
  const qEl = $("q"), resEl = $("q-results");
  function search(q) {
    buildSearch();
    const toks = norm(q).split(" ").filter((x) => x.length >= 2);
    if (!toks.length) return [];
    const out = [];
    // towns first
    const tq = norm(q);
    A.tn.forEach((tn, ti) => { if (tn.startsWith(tq)) out.push({ town: ti, s: tn === tq ? -2 : -1 }); });
    out.sort((a, b) => a.s - b.s || A.towns[a.town][0].length - A.towns[b.town][0].length);
    const towns = out.slice(0, 2);
    const places = [];
    for (let i = 0; i < A.count; i++) {
      const nm = A.nm[i], tn = A.m[i] >= 0 ? A.tn[A.m[i]] : "";
      const hay = nm + " " + tn;
      if (!toks.every((k) => hay.includes(k))) continue;
      const s = nm.startsWith(tq) ? 0 : nm.includes(tq) ? 1 : toks.every((k) => nm.includes(k)) ? 2 : 3;
      places.push({ i, s });
    }
    places.sort((a, b) => a.s - b.s || A.n[a.i].length - A.n[b.i].length);
    return { list: [...towns, ...places.slice(0, 8)], total: places.length };
  }
  function renderResults(r) {
    results = r.list || []; active = -1;
    if (!qEl.value.trim()) { resEl.hidden = true; qEl.setAttribute("aria-expanded", "false"); return; }
    if (!results.length) {
      resEl.innerHTML = `<li class="none" role="option" aria-disabled="true">No place matches. Try a town name.</li>`;
    } else {
      resEl.innerHTML = results.map((r2, k) => {
        if (r2.town != null) {
          const tw = A.towns[r2.town], prov = A.provinces[tw[1]][0];
          return `<li role="option" id="qr-${k}" data-k="${k}" aria-selected="false">Town: ${esc(tw[0])}<span class="sub">${esc(prov)} · zoom to all its places</span></li>`;
        }
        const i = r2.i;
        return `<li role="option" id="qr-${k}" data-k="${k}" aria-selected="false">${esc(A.n[i])}<span class="sub">${TYPES[A.t[i]]}${A.m[i] >= 0 ? " · " + esc(A.towns[A.m[i]][0]) : ""}</span></li>`;
      }).join("") + (r.total > 8 ? `<li class="none" role="option" aria-disabled="true">${fmt(r.total - 8)} more matches: add a word or a town</li>` : "");
    }
    resEl.hidden = false; qEl.setAttribute("aria-expanded", "true");
  }
  function setActive(k) {
    active = k;
    resEl.querySelectorAll("li[data-k]").forEach((li) => li.setAttribute("aria-selected", +li.dataset.k === k ? "true" : "false"));
    if (k >= 0) { qEl.setAttribute("aria-activedescendant", "qr-" + k); resEl.querySelector(`#qr-${k}`)?.scrollIntoView({ block: "nearest" }); }
    else qEl.removeAttribute("aria-activedescendant");
  }
  function choose(k) {
    const r = results[k]; if (!r) return;
    resEl.hidden = true; qEl.setAttribute("aria-expanded", "false"); qEl.removeAttribute("aria-activedescendant");
    if (r.town != null) {
      const list = vis.filter((i) => A.m[i] === r.town);
      const all = list.length ? list : d3.range(A.count).filter((i) => A.m[i] === r.town);
      fitIndices(all);
      live(`Zoomed to ${A.towns[r.town][0]}: ${all.length} places.`);
      return;
    }
    const i = r.i;
    if (!passes(i)) { // reveal it: re-enable its type and clear the entry filter
      st.types[A.t[i]] = true; document.querySelector(`#f-type input[value="${A.t[i]}"]`).checked = true;
      if (st.entry !== "any") { st.entry = "any"; $("f-entry").value = "any"; }
      applyFilters();
    }
    st.focus = i;
    openCard(i, true);
  }
  let sT;
  qEl.addEventListener("input", () => { clearTimeout(sT); sT = setTimeout(() => load().then(() => renderResults(search(qEl.value))), 120); });
  qEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (resEl.hidden && qEl.value) renderResults(search(qEl.value)); setActive(Math.min(results.length - 1, active + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results.length) choose(active >= 0 ? active : 0); }
    else if (e.key === "Escape") { resEl.hidden = true; qEl.setAttribute("aria-expanded", "false"); }
  });
  resEl.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-k]"); if (li) { e.preventDefault(); choose(+li.dataset.k); } });
  document.addEventListener("click", (e) => { if (!e.target.closest("#search")) { resEl.hidden = true; qEl.setAttribute("aria-expanded", "false"); } });

  // ---------------------------------------------------------------- record card
  const card = $("card");
  function shard(ri) {
    const k = keyOf(A.regions[ri]);
    if (!shards.has(k)) shards.set(k, d3.json(`data/story/atlas/${k}.json`));
    return shards.get(k);
  }
  const euro = (v) => "€" + v.toFixed(2);
  const hostOf = (u) => u.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  function row(label, html) { return html ? `<div><dt>${label}</dt><dd>${html}</dd></div>` : ""; }
  async function openCard(i, focusCard) {
    st.selected = i;
    if (!dotMode() || !onScreen(i, 40)) centerOn(i, dotK() * 3); else requestDraw();
    const id = A.id[i];
    let det = null;
    if (id) { try { det = (await shard(A.r[i]))[id] || null; } catch (e) { det = null; } }
    if (st.selected !== i) return;
    const town = A.m[i] >= 0 ? A.towns[A.m[i]] : null;
    const comp = town ? `${esc(town[0])}, ${esc(A.provinces[town[1]][0])}, ${esc(A.regions[A.r[i]])}` : esc(A.regions[A.r[i]]);
    const lat = A.y[i] / 1e4, lon = A.x[i] / 1e4;
    let html = `<div class="head"><p class="kind"><svg aria-hidden="true"><use href="#${KEYS[A.t[i]]}"/></svg>${det ? esc(det.type_en) : "Library"}</p>
      <h3 tabindex="-1" id="card-title">${esc(A.n[i])}</h3></div>
      <button type="button" class="close" id="card-close" aria-label="Close card">&times;</button><dl>`;
    if (det) {
      html += row("Type (Italian)", det.type_it !== det.type_en ? `<span lang="it">${esc(det.type_it)}</span>` : "");
      html += row("Address", det.address ? `<span lang="it">${esc(det.address)}</span>${det.postcode ? ", " + esc(det.postcode) : ""}` : "");
      html += row("Town", det.city ? `${esc(det.city)}${det.province && det.province !== det.city ? " (" + esc(det.province) + ")" : ""}${det.region ? ", " + esc(det.region) : ""}` : "");
      const entry = det.price == null ? "Not stated in the record"
        : det.price === 0 ? "Free entry <span class=\"note\">(record: “Gratuito”)</span>"
          : `${euro(det.price)} full ticket${det.reduced != null ? (det.reduced === 0 ? ", free for reduced categories" : `, ${euro(det.reduced)} reduced`) : ""}`;
      html += row("Entry", entry);
      if (det.hours) html += row("Opening hours", `<ul lang="it">${det.hours.split("|").map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`);
      if (det.web?.length) html += row("Website", det.web.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(u))}</a>`).join("<br>"));
      if (!town || !det.city || norm(det.city) !== norm(town[0])) html += row("Located in", `${comp} <span class="note">(from coordinates)</span>`);
    } else {
      html += row("Located in", town ? `${comp} <span class="note">(from coordinates)</span>` : "Outside every municipal boundary");
      html += row("Entry", "Not recorded in this register");
    }
    html += row("Coordinates", `<span class="mono" style="font-family:var(--mono);font-size:13px">${lat.toFixed(4)}, ${lon.toFixed(4)}</span> · <a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=18/${lat}/${lon}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>`);
    html += `</dl>`;
    if (det?.about) html += `<p class="about">From the record, in Italian: <span lang="it">${esc(det.about)}</span></p>`;
    if (det) {
      const uri = `http://dati.beniculturali.it/mibact/luoghi/resource/CulturalInstituteOrSite/${id}`;
      html += `<p class="foot">Source: dati.cultura.gov.it, Luoghi della cultura (2022 export)<br>Record ${esc(id)}${det.src ? " · supplied by " + esc(det.src) : ""}${det.modified ? " · updated " + esc(det.modified) : ""}<br><a href="${uri}" target="_blank" rel="noopener noreferrer">Linked-data record</a></p>`;
    } else {
      html += `<p class="note">The ICCU register extract in this repository gives only the library's name and position, so there is no address, entry or website to show.</p>
        <p class="foot">Source: ICCU, Anagrafe delle biblioteche italiane, 2022 (lat_long.json)</p>`;
    }
    card.innerHTML = html;
    card.hidden = false; $("card-empty").hidden = true;
    $("card-close").addEventListener("click", () => closeCard(true));
    if (focusCard) $("card-title").focus({ preventScroll: true });
    if (window.innerWidth < 1000) card.scrollIntoView({ block: "nearest", behavior: reduced.matches ? "auto" : "smooth" });
    if (id) history.replaceState(null, "", "#place=" + id);
  }
  function closeCard(refocus) {
    if (card.hidden) return;
    card.hidden = true; $("card-empty").hidden = false; st.selected = -1; requestDraw();
    if (/^#place=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    if (refocus) frame.focus();
  }
  card.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCard(true); } });

  function fromHash() {
    const m = /^#place=(\d+)/.exec(location.hash);
    if (!m) return;
    const i = A.id.indexOf(m[1]);
    if (i >= 0) { st.focus = i; openCard(i, false); $("atlas").scrollIntoView(); }
  }
  window.addEventListener("hashchange", () => { if (/^#place=/.test(location.hash)) load().then(fromHash); });
  if (/^#place=/.test(location.hash)) load();

  // ---------------------------------------------------------------- public API for "your place"
  window.C4A.atlas = {
    show(kind, name) {
      return load().then(() => {
        let list;
        if (kind === "region") { const ri = A.regions.indexOf(name); list = vis.filter((i) => A.r[i] === ri); }
        else { const pi = A.provinces.findIndex((p) => p[0] === name); list = vis.filter((i) => A.m[i] >= 0 && A.towns[A.m[i]][1] === pi); }
        $("atlas").scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth" });
        setTimeout(() => fitIndices(list), reduced.matches ? 0 : 500);
      });
    },
  };

  // ---------------------------------------------------------------- resize / theme
  let rT, lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (!A || window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rT);
    rT = setTimeout(() => { layout(); requestDraw(); scheduleInView(); }, 150);
  });
  document.addEventListener("c4a-theme", requestDraw);
})();
