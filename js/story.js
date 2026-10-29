/* Culture for All — data story charts (D3 v7). All data from data/story/*.json,
   built from the repository's own source files by scripts/build_story_data.py. */
(function () {
  "use strict";
  const fmt = d3.format(",");
  const fmt1 = d3.format(".1f");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const SOUTH = "South & islands";
  const fixName = (s) => s.replace("Forl�", "Forlì").replace("Vall�e", "Vallée");
  const regName = (s) => s.split("/")[0].trim();
  const tip = document.getElementById("tip");
  const SHORT = { "Trentino-Alto Adige": "Trentino-A. Adige", "Friuli-Venezia Giulia": "Friuli-V. Giulia" };
  const short = (l, narrow) => (narrow && SHORT[l]) || l;
  const ordinal = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt1(Math.abs(v));

  // ---------- motion: on by default, off when the system asks for less motion or the reader turns it off ----------
  // Every chart is drawn in its final state first; motion only replays how it got there, once, when it scrolls into view.
  const root = document.documentElement;
  const motionOn = () => root.dataset.motion === "full";
  const easeOut = d3.easePolyOut.exponent(4);
  const revealed = new Set();
  function onReveal(el, setup, play) {
    if (!el || !motionOn() || revealed.has(el.id)) return;
    if (el._io) el._io.disconnect();
    setup();
    el._io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      el._io.disconnect(); el._io = null; revealed.add(el.id); play();
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    el._io.observe(el);
  }
  // a number that counts to its new value instead of jumping
  function tickText(el, from, to, f, duration = 520) {
    d3.select(el).interrupt();
    if (!motionOn() || from == null || !isFinite(from) || from === to) { el.textContent = f(to); return; }
    const i = d3.interpolateNumber(from, to), whole = Number.isInteger(to);
    d3.select(el).transition().duration(duration).ease(easeOut).tween("text", () => (t) => { const v = i(t); el.textContent = f(whole ? Math.round(v) : v); });
  }
  const luminance = (hex) => {
    const c = hex.replace("#", ""); const ch = [0, 2, 4].map((k) => parseInt(c.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  let redrawForTheme = () => {};

  // ---------- display controls: motion and theme, remembered on this device ----------
  const store = () => { try { return JSON.parse(localStorage.getItem("c4a-display") || "{}"); } catch (e) { return {}; } };
  const save = (k, v) => { const s = store(); s[k] = v; try { localStorage.setItem("c4a-display", JSON.stringify(s)); } catch (e) { /* private mode */ } };
  const motionBtn = document.getElementById("motion-btn"), themeBtn = document.getElementById("theme-btn");
  const isDark = () => root.dataset.theme === "dark" || (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const syncTools = () => {
    motionBtn.setAttribute("aria-pressed", motionOn() ? "true" : "false");
    motionBtn.title = motionOn() ? "Motion is on: charts animate when they change. Click to turn it off." : "Motion is off. Click to turn it on.";
    themeBtn.setAttribute("aria-pressed", isDark() ? "true" : "false");
  };
  motionBtn.addEventListener("click", () => {
    const next = motionOn() ? "reduce" : "full";
    root.dataset.motion = next; save("motion", next); syncTools();
    // turning motion off finishes every pending reveal at once
    if (next === "reduce") { d3.selectAll(".chart *, .index-map *").interrupt(); redrawForTheme(); }
  });
  themeBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next; save("theme", next); syncTools(); redrawForTheme();
  });
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => { if (!store().motion) { root.dataset.motion = e.matches ? "reduce" : "full"; syncTools(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncTools);
  syncTools();

  // ---------- folder tabs in the nav: the chapter in view comes to the front ----------
  (function tabs() {
    const box = document.getElementById("tabs");
    if (!box) return;
    const links = [...box.querySelectorAll(".folders a")];
    const ids = links.map((a) => a.getAttribute("href").slice(1));
    const owner = { team: "method" };
    const chapters = [...document.querySelectorAll("main > .chapter")];
    let active = null;
    // below 1180px the strip scrolls sideways: bring the open tab into view without moving the page
    const reveal = (a) => {
      if (box.scrollWidth <= box.clientWidth + 1) return;
      const left = a.offsetLeft - (box.clientWidth - a.offsetWidth) / 2;
      box.scrollTo({ left: Math.max(0, left), behavior: motionOn() ? "smooth" : "auto" });
    };
    const set = (id) => {
      id = owner[id] || id;
      if (!ids.includes(id)) id = null;
      if (id === active) return;
      active = id;
      links.forEach((a, i) => (ids[i] === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      chapters.forEach((c) => c.classList.toggle("is-open", (owner[c.id] || c.id) === id));
      if (id) reveal(links[ids.indexOf(id)]); else if (box.scrollLeft) box.scrollTo({ left: 0, behavior: motionOn() ? "smooth" : "auto" });
    };
    // arrow keys walk along the folder tabs; Home and End jump to the ends
    box.addEventListener("keydown", (e) => {
      const i = links.indexOf(document.activeElement);
      if (i < 0) return;
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: links.length - 1 }[e.key];
      if (j == null) return;
      e.preventDefault();
      links[(j + links.length) % links.length].focus();
    });
    const sections = [...ids, "team"].map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) set(e.target.id); });
    }, { rootMargin: "-35% 0px -60% 0px" });
    sections.forEach((s) => io.observe(s));
    new IntersectionObserver((e) => { if (e[0].isIntersecting) set(null); }, { rootMargin: "0px 0px -70% 0px" }).observe(document.getElementById("top"));
    // a folder's tab rises out of the drawer the first time its chapter comes into view
    const pull = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-pulled"); pull.unobserve(e.target); }
    }), { rootMargin: "0px 0px -12% 0px" });
    chapters.forEach((c) => (motionOn() ? pull.observe(c) : c.classList.add("is-pulled")));
  })();

  const LABEL_DARK = "#303234", LABEL_LIGHT = "#ffffff";
  // the label colour with the higher contrast on a map band (both measured >= 4.5:1 on every band, DESIGN.md)
  const labelOn = (hex) => ((luminance(hex) + 0.05) / (luminance(LABEL_DARK) + 0.05) >= (luminance(LABEL_LIGHT) + 0.05) / (luminance(hex) + 0.05) ? LABEL_DARK : LABEL_LIGHT);

  // ---------- one region, followed across every chart ----------
  // hover highlights for as long as the pointer (or keyboard focus) is on a mark; the region chosen in
  // "Follow a region" stays highlighted until it is cleared.
  const focus = { hover: null, pinned: null };
  const focusHooks = [];
  function applyFocus() {
    const r = focus.hover || focus.pinned;
    document.querySelectorAll(".chart [data-region]").forEach((el) => el.classList.toggle("is-focus", el.dataset.region === r));
    document.querySelectorAll(".chart").forEach((c) => c.classList.toggle("has-focus", !!r && !!c.querySelector(`[data-region="${CSS.escape(r)}"]`)));
    focusHooks.forEach((fn) => fn(r));
  }
  const hoverRegion = (r) => { if (focus.hover !== r) { focus.hover = r; applyFocus(); } };

  // ---------- tooltip (hover + keyboard focus) ----------
  function showTip(html, evt, el) {
    tip.innerHTML = html;
    tip.classList.add("on");
    let x, y;
    if (evt && evt.pageX != null && evt.type !== "focus") { x = evt.pageX; y = evt.pageY; }
    else { const r = el.getBoundingClientRect(); x = r.left + window.scrollX + r.width / 2; y = r.top + window.scrollY; }
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
    let left = x + 14; if (left + w > vw - 8) left = Math.max(8, x - w - 14);
    tip.style.left = left + "px"; tip.style.top = Math.max(window.scrollY + 60, y - h - 12) + "px";
  }
  const hideTip = () => tip.classList.remove("on");
  function bindTip(sel, html, regionOf) {
    const on = function (e, d) { showTip(html(d), e, this); if (regionOf) hoverRegion(regionOf(d)); };
    const off = () => { hideTip(); if (regionOf) hoverRegion(null); };
    sel.on("mousemove", on).on("mouseleave", off).on("focus", on).on("blur", off);
  }

  function table(id, cols, rows) {
    const el = document.getElementById(id);
    if (!el) return;
    const t = d3.select(el).html("").append("table");
    t.append("thead").append("tr").selectAll("th").data(cols).join("th")
      .attr("class", (c) => (c.num ? "r" : null)).attr("scope", "col").text((c) => c.h);
    t.append("tbody").selectAll("tr").data(rows).join("tr").selectAll("td")
      .data((r) => cols.map((c) => ({ c, r }))).join("td")
      .attr("class", (d) => (d.c.num ? "r" : null))
      .text((d) => { const v = d.c.v(d.r); return v == null ? "n/a" : d.c.f ? d.c.f(v) : v; });
  }

  const width = (el) => Math.max(280, el.clientWidth);

  // ---------- split screens end level: in each side-by-side pair, the shorter column's chart grows by the difference ----------
  function equalize() {
    document.querySelectorAll(".two").forEach((two) => {
      const cols = [...two.children];
      if (cols.length !== 2 || getComputedStyle(two).gridTemplateColumns.split(" ").length < 2) return;
      const fillable = (col) => [...col.querySelectorAll(".chart")].find((c) => c._fill);
      // back to natural heights, then measure
      cols.forEach((c) => { const f = fillable(c); if (f && f._extra) { f._extra = 0; f._fill(0); } });
      const h = cols.map((c) => c.getBoundingClientRect().height);
      const short = h[0] < h[1] ? 0 : 1, diff = Math.round(Math.abs(h[0] - h[1]));
      const f = fillable(cols[short]);
      if (diff >= 1 && f) { f._extra = diff; f._fill(diff); }
    });
  }

  // ---------- horizontal ranked bars ----------
  // rows: [{label, value, hi(bool), tip, region}]  opts: {ref, refLabel, fmtV, max}
  // one axis language for every chart: no domain line, no tick marks, tabular figures, light gridlines behind the marks
  const cleanAxis = (g) => { g.select(".domain").remove(); g.selectAll(".tick line").remove(); g.selectAll(".tick text").attr("dy", "0.9em"); };

  function bars(id, rows, opts = {}) {
    const el = document.getElementById(id);
    const W = width(el);
    const narrow = W < 520;
    const labelW = opts.labelW || (narrow ? 118 : 170);
    const valW = 58;
    // opts.extra: height added by equalize() so this panel ends level with the one beside it; it widens the gaps, not the bars
    const band = (opts.band || 26) + (opts.extra || 0) / rows.length, barH = Math.min(15, (opts.band || 26) - 9);
    el._fill = (extra) => bars(id, rows, { ...opts, extra });
    const top = opts.ref != null ? 24 : 6, H = top + rows.length * band + 28;
    const x = d3.scaleLinear().domain([0, opts.max || d3.max(rows, (d) => d.value)]).nice().range([labelW, W - valW]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const f = opts.fmtV || fmt;
    const ticks = x.ticks(narrow ? 3 : 5);
    svg.append("g").selectAll("line").data(ticks).join("line").attr("class", "gridline")
      .attr("x1", x).attr("x2", x).attr("y1", top - 2).attr("y2", top + rows.length * band);
    svg.append("g").attr("transform", `translate(0,${top + rows.length * band + 4})`)
      .call((() => { const a = d3.axisBottom(x).tickValues(ticks).tickSize(0);
        const tf = opts.tickFmt || "~s"; return typeof tf === "function" ? a.tickFormat(tf) : a.tickFormat(d3.format(tf)); })())
      .call(cleanAxis);
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${top + i * band})`)
      .attr("data-region", (d) => d.region || null);
    g.filter((d) => d.region).append("rect").attr("class", "hlrow").attr("x", 0).attr("y", 1).attr("width", W).attr("height", band - 2).attr("rx", 4);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("y", band / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text((d) => short(d.label, narrow));
    // bar with a 3px rounded data end, square at the baseline
    const y0 = (band - barH) / 2;
    const barPath = (v) => {
      const x0 = x(0), x1 = Math.max(x0 + 1, x(v)), r = Math.min(3, (x1 - x0) / 2);
      return `M${x0},${y0}H${x1 - r}Q${x1},${y0} ${x1},${y0 + r}V${y0 + barH - r}Q${x1},${y0 + barH} ${x1 - r},${y0 + barH}H${x0}Z`;
    };
    const bar = g.append("path").attr("class", "bar").attr("fill", (d) => (d.hi ? "var(--accent)" : "var(--rest)")).attr("d", (d) => barPath(d.value));
    const val = g.append("text").attr("class", "val").attr("x", (d) => x(d.value) + 7).attr("y", band / 2).attr("dy", "0.35em").text((d) => f(d.value));
    svg.append("line").attr("class", "baseline").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top - 2).attr("y2", top + rows.length * band);
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.label}: ${f(d.value)}`);
    bindTip(hit, (d) => d.tip || `<b>${d.label}</b>${f(d.value)}`, (d) => d.region || null);
    let ref;
    if (opts.ref != null) {
      const far = x(opts.ref) > W * 0.7;
      ref = svg.append("g");
      ref.append("line").attr("class", "ref").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", top - 6).attr("y2", top + rows.length * band);
      ref.append("text").attr("class", "ref-lbl").attr("x", x(opts.ref)).attr("y", top - 11)
        .attr("text-anchor", far ? "end" : "start").attr("dx", far ? -4 : 4).text(opts.refLabel);
    }
    // bars grow from the baseline in rank order, then the values and the reference line arrive
    onReveal(el, () => { bar.attr("d", barPath(0)); val.style("opacity", 0); if (ref) ref.style("opacity", 0); }, () => {
      bar.transition().delay((d, i) => i * 26).duration(720).ease(easeOut).attrTween("d", (d) => (t) => barPath(d.value * t));
      val.transition().delay((d, i) => 260 + i * 26).duration(320).style("opacity", null);
      if (ref) ref.transition().delay(420).duration(360).style("opacity", null);
    });
  }

  // ---------- ranked dot plot (optionally grouped by area) ----------
  // rows: [{label, value, area, hi, region}] ; opts: {groups:[...], ref, refLabel, domain, fmtV, notes:{label:text}}
  function dots(id, rows, opts = {}) {
    const el = document.getElementById(id);
    const W = width(el), narrow = W < 520;
    const labelW = opts.labelW || (narrow ? 118 : 160), band = 24, gap = opts.groups ? 30 : 0;
    const groups = opts.groups || [null];
    let y = opts.ref != null ? 22 : 8;
    const layout = [];
    groups.forEach((gname) => {
      const rs = rows.filter((r) => gname == null || r.area === gname);
      if (gname) { layout.push({ head: gname, y: y + 12 }); y += gap - 6; }
      rs.forEach((r) => { layout.push({ r, y: y + band / 2 }); y += band; });
      y += gname ? 10 : 0;
    });
    const H = y + 24;
    const x = d3.scaleLinear().domain(opts.domain || [0, d3.max(rows, (d) => d.value)]).nice().range([labelW, W - 44]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const ticks = x.ticks(narrow ? 4 : 6);
    svg.append("g").selectAll("line").data(ticks).join("line").attr("class", "gridline").attr("x1", x).attr("x2", x).attr("y1", 4).attr("y2", H - 24);
    svg.append("g").attr("transform", `translate(0,${H - 22})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickFormat(opts.tickFmt || null))
      .call(cleanAxis);
    let ref;
    if (opts.ref != null) {
      ref = svg.append("g");
      ref.append("line").attr("class", "ref").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", 16).attr("y2", H - 24);
      ref.append("text").attr("class", "ref-lbl").attr("x", x(opts.ref) + 4).attr("y", 12).text(opts.refLabel);
    }
    const f = opts.fmtV || fmt1;
    layout.filter((l) => l.head).forEach((l) => {
      svg.append("text").attr("class", "note").attr("x", 0).attr("y", l.y).text(l.head);
      svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", l.y + 8).attr("y2", l.y + 8).style("stroke", "var(--rule)");
    });
    const g = svg.append("g").selectAll("g").data(layout.filter((l) => l.r)).join("g").attr("transform", (l) => `translate(0,${l.y})`)
      .attr("data-region", (l) => l.r.region || null);
    g.filter((l) => l.r.region).append("rect").attr("class", "hlrow").attr("x", 0).attr("y", -band / 2 + 1).attr("width", W).attr("height", band - 2).attr("rx", 4);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("dy", "0.35em").attr("text-anchor", "end").text((l) => short(l.r.label, narrow));
    const stem = g.append("line").attr("class", "stem").attr("x1", labelW).attr("x2", (l) => x(l.r.value)).attr("stroke", "var(--rule)").attr("stroke-width", 1);
    const dot = g.append("circle").attr("class", "dot").attr("cx", (l) => x(l.r.value)).attr("r", 5.5)
      .attr("fill", (l) => (l.r.hi ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--surface)").attr("stroke-width", 2);
    const val = g.append("text").attr("class", "val").attr("x", (l) => x(l.r.value) + 11).attr("dy", "0.35em")
      .text((l) => (opts.labelAll || l.r.hi || l.r.label in (opts.notes || {}) ? f(l.r.value) : ""));
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", -band / 2).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (l) => `${l.r.label}: ${f(l.r.value)}`);
    bindTip(hit, (l) => l.r.tip || `<b>${l.r.label}</b>${f(l.r.value)}`, (l) => l.r.region || null);
    // each dot travels out along its stem to its value
    onReveal(el, () => { stem.attr("x2", labelW); dot.attr("cx", labelW); val.style("opacity", 0); if (ref) ref.style("opacity", 0); }, () => {
      const d = (l, i) => i * 22;
      stem.transition().delay(d).duration(700).ease(easeOut).attr("x2", (l) => x(l.r.value));
      dot.transition().delay(d).duration(700).ease(easeOut).attr("cx", (l) => x(l.r.value));
      val.transition().delay((l, i) => 300 + i * 22).duration(300).style("opacity", null);
      if (ref) ref.transition().delay(400).duration(360).style("opacity", null);
    });
  }

  // one projection for every map of Italy, fitted to the element's size
  const italyProj = (geo, W, H) => d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[4, 4], [W - 4, H - 4]], geo);

  // ---------- choropleth ----------
  function choropleth(id, rampId, geo, valueOf, thresholds, fmtT, tipOf) {
    const el = document.getElementById(id);
    const W = width(el), H = Math.round(W * 1.12);
    const colors = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map((v) => `var(${v})`);
    const q = d3.scaleThreshold().domain(thresholds).range(colors);
    const path = d3.geoPath(italyProj(geo, W, H));
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const p = svg.append("g").selectAll("path").data(geo.features).join("path").attr("class", "prov").attr("d", path)
      .attr("data-region", (f) => regName(f.properties.region))
      .attr("fill", (f) => { const v = valueOf(f); return v == null ? "var(--na)" : q(v); });
    bindTip(p, tipOf, (f) => regName(f.properties.region));
    // the map fills in from the Alps to Sicily
    onReveal(el, () => p.style("opacity", 0), () => {
      p.transition().delay((f) => (path.centroid(f)[1] / H) * 700).duration(420).ease(easeOut).style("opacity", null);
    });
    // legend: threshold ramp
    const edges = [null, ...thresholds];
    const ramp = d3.select("#" + rampId).html("");
    colors.forEach((c, i) => {
      const cell = ramp.append("div");
      cell.append("span").style("background", c);
      cell.append("div").text(i === 0 ? `< ${fmtT(thresholds[0])}` : i === colors.length - 1 ? `≥ ${fmtT(thresholds[i - 1])}` : `${fmtT(edges[i])}–${fmtT(thresholds[i])}`);
    });
  }

  // ---------- load everything ----------
  const J = (f) => d3.json("data/story/" + f);
  Promise.all([J("provinces.geojson"), J("libraries_2012.json"), J("loans_2022.json"), J("reading_2021.json"),
    J("museums_entry.json"), J("municipalities.json"), J("library_points.json"), J("reading_trend.json"),
    J("distance.json"), J("events.json"), J("regions.geojson")])
    .then(([geo, lib, loans, read, mus, mun, pts, trend, dist, events, regionsGeo]) => {
      const byKey = new Map(lib.provinces.map((p) => [p.key, p]));
      const italyEvents = (100000 * events.matched_events) / d3.sum(events.regions, (r) => r.residents);
      const draw = () => {
        pileHero();
        indexMap();
        // 01 maps
        const tipP = (f) => {
          const d = byKey.get(f.properties.key);
          const nm = fixName(f.properties.name);
          return d ? `<b>${nm}</b>${fmt(d.libraries)} libraries<br>${fmt1(d.per10k)} per 10,000 inhabitants` : `<b>${nm}</b>No 2012 value (province created 2016)`;
        };
        choropleth("map-count", "ramp-count", geo, (f) => byKey.get(f.properties.key)?.libraries, [50, 100, 150, 250, 400], fmt, tipP);
        choropleth("map-rate", "ramp-rate", geo, (f) => byKey.get(f.properties.key)?.per10k, [1.5, 2, 2.5, 3, 4], (v) => v.toFixed(1), tipP);

        // 01 the field: a tile per region, one book mark per library for 10,000 residents
        fieldTiles(lib);

        // 02 reach: a block of ten by ten squares per region, one square per 1% of its municipalities
        waffles("bars-reach", mun);

        // 02 distance: rings at true scale, and the residents as squares
        distRings.draw();
        const distUnit = spineUnit("bars-dist", 2100000, 112, [25000, 50000, 100000], 7);
        document.getElementById("dist-unit").textContent = fmt(distUnit);
        const bandLbl = ["Under 2 km", "2–5 km", "5–10 km", "10–20 km", "20 km or more"];
        shelves("bars-dist", dist.bands.map((b, i) => ({ label: bandLbl[i], value: b.residents,
          tip: `<b>${bandLbl[i]}</b>${fmt(b.residents)} residents in ${fmt(b.municipalities)} municipalities` })),
        { unit: distUnit, max: 2100000, labelW: 112, mark: "sq", fmtV: d3.format(".3~s"), tickFmt: "~s", what: "residents" });

        // 03 loans: shelves of book spines, one spine per unit of loans; the same unit on every shelf
        const lrows = loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public);
        const loansUnit = loanUnit();
        document.getElementById("loans-unit").textContent = fmt(loansUnit);
        keySpine(loansUnit);
        const placeUnit = loanUnit();
        document.getElementById("urban-unit").textContent = fmt(placeUnit);
        shelves("bars-loans", lrows.map((r) => ({ label: r.region, region: r.region, value: r.mean_public, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${fmt(r.mean_public)} loans per public library<br>${fmt(r.total)} local loans in total, all libraries` })),
        { unit: loansUnit, ref: loans.italy.mean_public, refLabel: "Italy 5,148", max: 11000 });
        const urbanLbl = ["Cities", "Towns and suburbs", "Rural areas"];
        const innerLbl = ["Hub", "Inter-municipal hub", "Belt", "Intermediate", "Peripheral", "Ultra-peripheral"];
        shelves("bars-urban", loans.urbanisation.map((r, i) => ({ label: urbanLbl[i], value: r.mean_public, hi: i === 2 })), { unit: placeUnit, max: 14000, labelW: 128 });
        shelves("bars-inner", loans.classification.map((r, i) => ({ label: innerLbl[i], value: r.mean_public, hi: i >= 4 })), { unit: placeUnit, max: 14000, labelW: 128 });

        // 04 reading: layers of readers by how many books they read
        layers("dots-read-any", read);
        scatter(loans, read);

        // 05 time
        timeLines(trend);
        gapRibbon(trend);

        // 06 museums: a constellation per region, one dot per museum
        constellation(mus);

        // 07 events: a rhythm of ticks, one per few events per 100,000 residents
        const erows = events.regions.slice().sort((a, b) => b.per100k - a.per100k);
        const evUnit = spineUnit("bars-events", 240, 170, [2, 5, 10, 20], 7);
        document.getElementById("events-unit").textContent = evUnit;
        shelves("bars-events", erows.map((r) => ({ label: r.region, region: r.region, value: r.per100k, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${fmt(r.events)} events published<br>${fmt1(r.per100k)} per 100,000 residents` })),
        { unit: evUnit, max: 240, mark: "tick", fmtV: (v) => fmt(Math.round(v)), tickFmt: ",", what: "events per 100,000 residents", ref: italyEvents, refLabel: `Italy ${Math.round(italyEvents)}` });

        dotmap.draw();
        applyFocus();
        equalize();
        applyFocus();
      };

      // tables (once)
      table("tbl-prov", [{ h: "Province", v: (d) => fixName(d.name) }, { h: "Libraries", v: (d) => d.libraries, f: fmt, num: 1 }, { h: "Per 10,000 inhabitants", v: (d) => d.per10k, f: fmt1, num: 1 }],
        lib.provinces.slice().sort((a, b) => b.per10k - a.per10k));
      table("tbl-rate", [{ h: "Region", v: (d) => d.region }, { h: "Area", v: (d) => d.area }, { h: "Libraries", v: (d) => d.libraries, f: fmt, num: 1 }, { h: "Per 10,000", v: (d) => d.per10k, f: fmt1, num: 1 }],
        lib.regions.slice().sort((a, b) => b.per10k - a.per10k));
      table("tbl-reach", [{ h: "Region", v: (d) => d.region }, { h: "Municipalities", v: (d) => d.municipalities, f: fmt, num: 1 }, { h: "With a library", v: (d) => d.with_library, f: fmt, num: 1 }, { h: "Without", v: (d) => d.without_library, f: fmt, num: 1 }, { h: "% without", v: (d) => (100 * d.without_library) / d.municipalities, f: (v) => v.toFixed(1), num: 1 }],
        mun.regions);
      table("tbl-dist", [{ h: "Municipality", v: (d) => d.name }, { h: "Region", v: (d) => d.region }, { h: "Nearest library, km", v: (d) => d.km, f: fmt1, num: 1 }, { h: "Residents 2023", v: (d) => d.pop, f: fmt, num: 1 }],
        dist.municipalities.slice().sort((a, b) => b.km - a.km));
      table("tbl-loans", [{ h: "Region", v: (d) => d.region }, { h: "Per public library", v: (d) => d.mean_public, f: fmt, num: 1 }, { h: "Per library (all)", v: (d) => d.mean_all, f: fmt, num: 1 }, { h: "Total local loans", v: (d) => d.total, f: fmt, num: 1 }],
        loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public));
      const uL = ["Cities (densely populated)", "Towns and suburbs", "Rural areas"], iL = ["Hub (polo)", "Inter-municipal hub", "Belt (cintura)", "Intermediate", "Peripheral", "Ultra-peripheral"];
      table("tbl-urban", [{ h: "Group", v: (d) => d.l }, { h: "Per public library", v: (d) => d.mean_public, f: fmt, num: 1 }, { h: "Per library (all)", v: (d) => d.mean_all, f: fmt, num: 1 }],
        [...loans.urbanisation.map((r, i) => ({ ...r, l: uL[i] })), ...loans.classification.map((r, i) => ({ ...r, l: iL[i] })),
          ...loans.macro.map((r) => ({ ...r, l: { "Nord-ovest": "North-west", "Nord-est": "North-east", Centro: "Centre", Sud: "South", Isole: "Islands" }[r.label] }))]);
      table("tbl-read", [{ h: "Region", v: (d) => d.region }, { h: "≥1 book", v: (d) => d.any, f: fmt1, num: 1 }, { h: "1–3 books", v: (d) => d.one_to_three, f: fmt1, num: 1 }, { h: "≥12 books", v: (d) => d.twelve_plus, f: fmt1, num: 1 }, { h: "Print only", v: (d) => d.print_only, f: fmt1, num: 1 }, { h: "Digital only", v: (d) => d.digital_only, f: fmt1, num: 1 }, { h: "Both", v: (d) => d.both, f: fmt1, num: 1 }],
        [...read.regions.slice().sort((a, b) => b.any - a.any), { region: "Italy", ...read.italy }]);
      table("tbl-trend", [{ h: "Region", v: (d) => d.region }, ...trend.years.map((y, i) => ({ h: String(y), v: (d) => d.values[i], f: fmt1, num: 1 })),
        { h: "Change", v: (d) => d.values[d.values.length - 1] - d.values[0], f: signed, num: 1 }],
        [...trend.regions, { region: "Italy", values: trend.italy }]);
      table("tbl-museums", [{ h: "Region", v: (d) => d.region }, { h: "Free", v: (d) => d.free, num: 1 }, { h: "Ticket", v: (d) => d.ticket, num: 1 }, { h: "% free", v: (d) => d.share_free, f: fmt1, num: 1 }],
        mus.regions.slice().sort((a, b) => b.share_free - a.share_free));
      table("tbl-events", [{ h: "Region", v: (d) => d.region }, { h: "Events published", v: (d) => d.events, f: fmt, num: 1 }, { h: "Residents 2023", v: (d) => d.residents, f: fmt, num: 1 }, { h: "Per 100,000", v: (d) => d.per100k, f: fmt1, num: 1 }],
        events.regions.slice().sort((a, b) => b.per100k - a.per100k));

      // ---------- dot map (canvas) ----------
      const sets = {
        libraries: { label: "libraries (2022)", data: pts.lonlat },
        museums: { label: "museums", src: "data/Dati_Musei/Museums_complete.json", lat: "Museum_Latitude", lon: "Museum_Longitude" },
        archives: { label: "state archives", src: "data/Dati_Archivi/Archives_Luoghi_Cultura.json", lat: "Archive_Latitude", lon: "Archive_Longitude" },
      };
      let current = "libraries";
      const dotmap = {
        draw(extra = 0) {
          const el = document.getElementById("dotmap");
          el._fill = (e) => dotmap.draw(e);
          const W = width(el), H = Math.round(W * 1.12) + extra, dpr = window.devicePixelRatio || 1;
          const s = sets[current];
          if (!s.data) return;
          el.innerHTML = "";
          const c = document.createElement("canvas");
          c.className = "map-canvas"; c.width = W * dpr; c.height = H * dpr; c.style.height = H + "px";
          el.appendChild(c);
          const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
          const proj = italyProj(geo, W, H);
          const path = d3.geoPath(proj, ctx);
          ctx.fillStyle = css("--na"); ctx.beginPath(); path(geo); ctx.fill();
          ctx.strokeStyle = css("--surface"); ctx.lineWidth = 0.6; ctx.stroke();
          ctx.fillStyle = css("--dot");
          const n = s.data.length / 2, r = current === "archives" ? 3 : Math.max(0.9, W / 520);
          ctx.globalAlpha = current === "archives" ? 1 : 0.5;
          for (let i = 0; i < n; i++) {
            const p = proj([s.data[2 * i], s.data[2 * i + 1]]);
            if (!p) continue;
            ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
          document.getElementById("dotmap-count").textContent = `${fmt(n)} ${s.label}`;
          el.setAttribute("aria-label", `Dot map of Italy with ${fmt(n)} ${s.label}, one dot each.`);
        },
      };
      document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
        current = b.dataset.set;
        document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
        const s = sets[current];
        const el = document.getElementById("dotmap");
        if (s.data) return dotmap.draw(el._extra || 0);
        document.getElementById("dotmap-count").textContent = "Loading…";
        d3.json(s.src).then((rows) => {
          s.data = rows.filter((r) => r[s.lat] && r[s.lon]).flatMap((r) => [+r[s.lon], +r[s.lat]]);
          dotmap.draw(el._extra || 0);
        });
      }));

      // ---------- distance as rings: every municipality without a library at its true distance from the nearest one ----------
      const RING_ORDER = ["Valle d'Aosta", "Piemonte", "Liguria", "Lombardia", "Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia", "Emilia-Romagna",
        "Toscana", "Umbria", "Marche", "Lazio", "Abruzzo", "Molise", "Campania", "Puglia", "Basilicata", "Calabria", "Sicilia", "Sardegna"];
      const southSet = new Set(mun.regions.filter((r) => r.area === SOUTH).map((r) => r.region));
      const distRings = {
        el: document.getElementById("map-dist"),
        draw(extra = 0) {
          const el = this.el, W = width(el), narrow = W < 400;   // below 400px the names go to the list under the chart
          el._fill = (e) => distRings.draw(e);
          const S = Math.min(W, 720), R = S / 2 - (narrow ? 22 : 118), H = (narrow ? S : 2 * R + 96) + extra, cx = W / 2, cy = H / 2;   // the box follows the circle and its names
          const rk = d3.scaleSqrt().domain([0, 40]).range([0, R]);
          const rp = d3.scaleSqrt().domain([0, d3.max(dist.municipalities, (m) => m.pop)]).range([0, narrow ? 5.5 : 8]);
          const byReg = d3.group(dist.municipalities, (m) => m.region);
          const total = dist.municipalities.length, gapA = 0.016, span = 2 * Math.PI - gapA * RING_ORDER.length;
          let a = -Math.PI / 2;
          const sectors = RING_ORDER.filter((r) => byReg.has(r)).map((r) => {
            const ms = byReg.get(r).slice().sort((p, q) => wobble(p.name) - wobble(q.name));
            const sct = { r, a0: a, a1: a + (span * ms.length) / total, ms }; a = sct.a1 + gapA; return sct;
          });
          const pts = [];
          sectors.forEach((sc) => sc.ms.forEach((m, i) => {
            const ang = sc.a0 + ((i + 0.5) / sc.ms.length) * (sc.a1 - sc.a0), rr = rk(Math.min(m.km, 40));
            pts.push({ m, ang, x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) });
          }));
          const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
          const arc = d3.arc();
          const sec = svg.append("g").selectAll("path").data(sectors).join("path").attr("class", "sector").attr("data-region", (sc) => sc.r)
            .attr("transform", `translate(${cx},${cy})`).attr("d", (sc) => arc({ innerRadius: 0, outerRadius: R + 3, startAngle: sc.a0 + Math.PI / 2, endAngle: sc.a1 + Math.PI / 2 }))
            .attr("tabindex", 0).attr("role", "img")
            .attr("aria-label", (sc) => { const far = sc.ms.reduce((p, q) => (q.km > p.km ? q : p)); return `${sc.r}: ${sc.ms.length} municipalities without a library; median distance ${fmt1(d3.median(sc.ms, (m) => m.km))} km; farthest ${far.name}, ${fmt1(far.km)} km`; });
          bindTip(sec, (sc) => `<b>${sc.r}</b>${sc.ms.length} municipalities without a library<br>median ${fmt1(d3.median(sc.ms, (m) => m.km))} km, farthest ${fmt1(d3.max(sc.ms, (m) => m.km))} km`, (sc) => sc.r);
          const rings = [2, 5, 10, 20, 30, 40];
          svg.append("g").selectAll("circle").data(rings).join("circle").attr("class", "ring").attr("cx", cx).attr("cy", cy).attr("r", rk);
          // the dots, biggest first so the small ones stay visible
          const dots = svg.append("g").selectAll("circle").data(pts.slice().sort((p, q) => q.m.pop - p.m.pop)).join("circle")
            .attr("class", (d) => "rdot" + (southSet.has(d.m.region) ? " south" : "")).attr("data-region", (d) => d.m.region)
            .attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", (d) => Math.max(1.3, rp(d.m.pop)));
          svg.append("g").selectAll("text").data(rings).join("text").attr("class", "ring-lbl")
            .attr("x", cx + 3).attr("y", (k) => cy - rk(k) - 3).text((k) => `${k} km`);
          const far = pts.reduce((p, q) => (q.m.km > p.m.km ? q : p));
          // a tick where each region's wedge starts
          svg.append("g").selectAll("line").data(sectors).join("line").attr("class", "sec-tick")
            .attr("x1", (sc) => cx + (R + 1) * Math.cos(sc.a0)).attr("y1", (sc) => cy + (R + 1) * Math.sin(sc.a0))
            .attr("x2", (sc) => cx + (R + 7) * Math.cos(sc.a0)).attr("y2", (sc) => cy + (R + 7) * Math.sin(sc.a0));
          // every region named outside the circle: names on the left and right, spread so they never overlap, each with a leader to its wedge
          if (!narrow) {
            const lab = sectors.map((sc) => { const m = (sc.a0 + sc.a1) / 2; return { sc, m, side: Math.cos(m) >= 0 ? 1 : -1, y: cy + (R + 16) * Math.sin(m) }; });
            [1, -1].forEach((side) => dodge(lab.filter((l) => l.side === side), 14, 8, H - 8));
            const lg2 = svg.append("g").selectAll("g").data(lab).join("g").attr("class", "sec-lbl-g").attr("data-region", (l) => l.sc.r);
            const ex = (l) => cx + l.side * (R + 30);
            lg2.append("path").attr("class", "sec-lead")
              .attr("d", (l) => `M${cx + (R + 9) * Math.cos(l.m)},${cy + (R + 9) * Math.sin(l.m)}L${cx + (R + 18) * Math.cos(l.m)},${l.y}H${ex(l)}`);
            lg2.append("text").attr("class", "sec-lbl").attr("data-region", (l) => l.sc.r).attr("x", (l) => ex(l) + l.side * 4).attr("y", (l) => l.y).attr("dy", "0.35em")
              .attr("text-anchor", (l) => (l.side > 0 ? "start" : "end")).text((l) => `${short(l.sc.r, true)} ${l.sc.ms.length}`);
          }
          const order = document.getElementById("ring-order");
          if (order) { order.innerHTML = `<b>Clockwise from the top</b> ${sectors.map((sc) => `${sc.r} ${sc.ms.length}`).join(", ")}.`; order.hidden = !narrow; }
          // the farthest place, named
          const left = Math.cos(far.ang) < 0, lx = far.x - Math.cos(far.ang) * 26, ly = far.y - Math.sin(far.ang) * 26;
          svg.append("line").attr("class", "ann-line").attr("x1", far.x - Math.cos(far.ang) * 5).attr("y1", far.y - Math.sin(far.ang) * 5).attr("x2", lx).attr("y2", ly);
          svg.append("text").attr("class", "ann").attr("x", lx + (left ? 3 : -3)).attr("y", ly).attr("dy", "0.35em").attr("text-anchor", left ? "start" : "end").text(`${far.m.name}, ${fmt1(far.m.km)} km`);
          // pointer: the nearest dot
          const qt = d3.quadtree(pts, (d) => d.x, (d) => d.y);
          svg.on("mousemove", (e) => {
            const [mx, my] = d3.pointer(e);
            const hit = qt.find(mx, my, 10);
            if (!hit) { hideTip(); hoverRegion(null); return; }
            const m = hit.m;
            showTip(`<b>${m.name}</b>${m.region}<br>${fmt1(m.km)} km to the nearest library<br>${fmt(m.pop)} residents`, e, el);
            hoverRegion(m.region);
          }).on("mouseleave", () => { hideTip(); hoverRegion(null); });
          el.setAttribute("aria-label", `Rings chart of the ${fmt(total)} municipalities with no library, each at its straight-line distance from the nearest library, grouped by region. Most lie within 5 km; ${far.m.name} is the farthest at ${fmt1(far.m.km)} km. The full list is in the data table.`);
          // the places move out from the centre to their distance, nearest first
          onReveal(el, () => dots.attr("cx", cx).attr("cy", cy).style("opacity", 0), () => {
            dots.transition().delay((d) => Math.min(700, d.m.km * 32) + wobble(d.m.name) * 120).duration(620).ease(easeOut)
              .attr("cx", (d) => d.x).attr("cy", (d) => d.y).style("opacity", null);
          });
        },
      };
      // the key: dot size is residents
      const dkey = d3.select("#ramp-dist").html("");
      const rpKey = d3.scaleSqrt().domain([0, d3.max(dist.municipalities, (m) => m.pop)]).range([0, 8]);
      [1000, 10000, 50000].forEach((v) => {
        const k = dkey.append("span").attr("class", "k");
        k.append("i").attr("class", "key-dot").style("width", 2 * Math.max(1.3, rpKey(v)) + "px").style("height", 2 * Math.max(1.3, rpKey(v)) + "px");
        k.append("span").text(`${fmt(v)} residents`);
      });
      dkey.append("span").attr("class", "k").html('<i class="sw" style="background:var(--accent)"></i>South &amp; islands');
      dkey.append("span").attr("class", "k").html('<i class="sw" style="background:var(--rest-2)"></i>North &amp; centre');
      dkey.append("span").attr("class", "k").text("Rings use square-root spacing");

      // ---------- follow a region: profile, deep link, share image ----------
      const readChange = new Map(trend.regions.map((r) => [r.region, r.values[r.values.length - 1] - r.values[0]]));
      const M = (arr, v) => new Map(arr.map((r) => [r.region, v(r)]));
      // unit: the short phrase printed after the value on each chapter sign
      const measures = [
        { label: "Libraries per 10,000 inhabitants", year: "2012", unit: "libraries per 10,000 people", values: M(lib.regions, (r) => r.per10k), italy: lib.areas.ITALIA, f: fmt1, anchor: "#fig-rate-regions" },
        { label: "Municipalities with no library", year: "2022", unit: "of municipalities have no library", values: M(mun.regions, (r) => (100 * r.without_library) / r.municipalities), italy: (100 * mun.without_library) / mun.municipalities, f: (v) => Math.round(v) + "%", anchor: "#fig-reach" },
        { label: "Loans per public library", year: "2022", unit: "loans per public library", values: M(loans.regions, (r) => r.mean_public), italy: loans.italy.mean_public, f: fmt, anchor: "#fig-loans" },
        { label: "Read at least one book", year: "2021", unit: "read at least one book", values: M(read.regions, (r) => r.any), italy: read.italy.any, f: (v) => fmt1(v) + "%", anchor: "#fig-read" },
        { label: "Change in readers", year: "2011–2021, points", unit: "points of readers since 2011", values: readChange, italy: trend.italy[trend.italy.length - 1] - trend.italy[0], f: signed, anchor: "#fig-slope" },
        { label: "Museums with free entry", year: "share of museums", unit: "of museums are free to enter", values: M(mus.regions, (r) => r.share_free), italy: (100 * mus.total_free) / (mus.total_free + mus.total_ticket), f: (v) => Math.round(v) + "%", anchor: "#fig-museums" },
        { label: "Ministry events per 100,000", year: "residents", unit: "Ministry events per 100,000 people", values: M(events.regions, (r) => r.per100k), italy: italyEvents, f: (v) => fmt(Math.round(v)), anchor: "#fig-events" },
      ];
      measures.forEach((m) => {
        const sorted = [...m.values.entries()].sort((a, b) => b[1] - a[1]);
        m.rank = new Map(sorted.map(([r], i) => [r, i + 1]));
        m.min = d3.min(sorted, (d) => d[1]); m.max = d3.max(sorted, (d) => d[1]);
      });
      const regionsList = lib.regions.map((r) => r.region);
      const select = document.getElementById("region-select");
      regionsList.slice().sort((a, b) => a.localeCompare(b)).forEach((r) => select.add(new Option(r, r)));
      const profile = document.getElementById("profile");
      const pill = document.getElementById("follow-pill");
      const shareBtn = document.getElementById("share-btn");

      function strip(m, region, w = 180, h = 22) {
        const x = d3.scaleLinear().domain([m.min, m.max]).range([7, w - 7]);
        const ticks = [...m.values.entries()].filter(([r]) => r !== region)
          .map(([, v]) => `<line x1="${x(v)}" x2="${x(v)}" y1="6" y2="${h - 6}" stroke="var(--rest)" stroke-width="1.5"/>`).join("");
        const it = m.italy >= m.min && m.italy <= m.max ? `<line x1="${x(m.italy)}" x2="${x(m.italy)}" y1="1" y2="${h - 1}" stroke="var(--tab)" stroke-width="2"/>` : "";
        // the region's dot starts at Italy's value and travels to its own (CSS transition on the transform)
        const from = Math.min(Math.max(m.italy, m.min), m.max);
        const me = `<circle class="pf-me" data-dx="${x(from) - x(m.values.get(region))}" cx="${x(m.values.get(region))}" cy="${h / 2}" r="6" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`;
        return `<svg class="pf-strip" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${ticks}${it}${me}</svg>`;
      }
      // ---------- the chapter tabs: Italy by default, the followed region once one is picked ----------
      const signs = [...document.querySelectorAll(".sign[data-measure]")];
      signs.forEach((s) => { s.querySelector(".sign-val").innerHTML = "<b></b><span></span>"; });
      let signTimer;
      function writeSigns(region, animate) {
        document.querySelectorAll(".folders a[data-measure]").forEach((a) => {
          const m = measures[+a.dataset.measure], has = region && m.values.has(region), v = has ? m.values.get(region) : m.italy;
          a.querySelector(".ft-val").textContent = m.f(v);
          a.title = `${has ? region : "Italy"}: ${m.f(v)} ${m.unit}`;
        });
        signs.forEach((s) => {
          const m = measures[+s.dataset.measure];
          const has = region && m.values.has(region);
          const v = has ? m.values.get(region) : m.italy;
          const b = s.querySelector(".sign-val b");
          // the figure counts from the old value to the new one; the unit never changes
          tickText(b, animate ? s._v : null, v, m.f);
          s._v = v;
          s.querySelector(".sign-val span").textContent = m.unit;
          s.querySelector(".sign-who").textContent = has ? `${region}, ${ordinal(m.rank.get(region))} of 20` : "Italy";
          // Italy stays as the trace under a followed region
          s.querySelector(".sign-ref").textContent = has ? `Italy ${m.f(m.italy)}` : "";
          s.setAttribute("aria-label", `${s.querySelector(".sign-name").textContent}. ${has ? region : "Italy"}: ${m.f(v)} ${m.unit}${has ? `, ${ordinal(m.rank.get(region))} of 20 regions; Italy ${m.f(m.italy)}` : ""}.`);
        });
      }
      function updateSigns(region, animate) {
        clearTimeout(signTimer);
        if (!animate || !motionOn()) { writeSigns(region, false); return; }
        // the name line fades out, the figure starts counting, the new name fades in
        signs.forEach((s) => s.classList.add("is-updating"));
        signTimer = setTimeout(() => { writeSigns(region, true); signs.forEach((s) => s.classList.remove("is-updating")); }, 140);
      }

      // ---------- the first screen: the twenty regions, a stack of books rising from each; each region is a button ----------
      let STACK_UNIT = loanUnit();
      const loanBy = new Map(loans.regions.map((r) => [r.region, r.mean_public]));
      const southern = new Set(loans.regions.filter((r) => r.area === SOUTH).map((r) => r.region));
      // where a stack stands (lon, lat): inside the region, and never in line with a neighbour's column,
      // so a tall stack from the south of the north never passes over another region's stack
      const LABEL_AT = { "Valle d'Aosta": [7.3, 45.8], Piemonte: [8.15, 44.8], Liguria: [8.75, 44.3], Lombardia: [9.7, 45.55], "Emilia-Romagna": [10.55, 44.6],
        "Trentino-Alto Adige": [11.35, 46.45], Toscana: [11.25, 43.25], Veneto: [12.15, 45.55], "Friuli-Venezia Giulia": [13.05, 46.15], Marche: [13.15, 43.3],
        Umbria: [12.45, 42.95], Lazio: [12.95, 41.85], Abruzzo: [13.9, 42.25], Molise: [14.55, 41.68], Campania: [14.85, 40.95], Puglia: [16.6, 40.95],
        Basilicata: [16.05, 40.5], Calabria: [16.45, 39.05] };
      const MAP_NAME = { "Trentino-Alto Adige": "Trentino-A.A.", "Friuli-Venezia Giulia": "Friuli-V.G." };
      // the two ends of the claim, set into the sea with a leader line (desktop)
      const CALLOUT = { "Emilia-Romagna": { at: [14.7, null], side: "start" }, Campania: { at: [12.75, 40.25], side: "end" } };
      const indexEl = document.getElementById("index-map");
      const heroEl = document.getElementById("top");
      let indexHi = null, indexPath = null, indexKey = "";
      // a steady pseudo-random number for a name, so books keep their small irregularities between redraws
      const jitter = (seed) => { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000; };
      // outline only the polygons big enough to carry a 2px stroke; islets under ~4px would turn into black dots
      function outlineOf(f) {
        const g = f.geometry;
        const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
        const keep = polys.filter((c) => indexPath.area({ type: "Polygon", coordinates: c }) > 60);
        return indexPath({ type: "MultiPolygon", coordinates: keep });
      }
      function indexMap() {
        const desk = window.matchMedia("(min-width: 900px)").matches;
        if (!desk) indexEl.style.height = "";
        const W = Math.max(280, indexEl.clientWidth);
        const H = desk ? Math.max(560, indexEl.clientHeight) : Math.round(Math.min(W * 1.34, Math.max(460, window.innerHeight - 110)));
        if (!desk) indexEl.style.height = H + "px";
        const me = indexEl.getBoundingClientRect();
        const x0 = 6;
        const key = `${W}x${H}x${Math.round(x0)}x${isDark()}`;
        if (key === indexKey && indexEl.querySelector("svg")) return;
        indexKey = key;
        const top = H * (desk ? 0.2 : 0.23);
        const proj = italyProj(regionsGeo, W, H).fitExtent([[x0, top], [W - (desk ? 190 : 6), H - 8]], regionsGeo);
        const path = d3.geoPath(proj);
        indexPath = path;
        const narrow = W < 520;
        const svg = d3.select(indexEl).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
        const regs = svg.append("g").selectAll("path").data(regionsGeo.features).join("path")
          .attr("class", "reg").attr("d", path).attr("data-region", (f) => f.properties.region)
          .attr("tabindex", 0).attr("role", "button")
          .attr("aria-label", (f) => `${f.properties.region}: ${fmt(loanBy.get(f.properties.region))} loans per public library. Follow this region.`);
        const tipOf = (f) => `<b>${f.properties.region}</b>${fmt(loanBy.get(f.properties.region))} loans per public library, 2022<br>Click to follow this region`;
        bindTip(regs, tipOf, (f) => f.properties.region);
        const pick = (f) => { hideTip(); follow(focus.pinned === f.properties.region ? null : f.properties.region); };
        regs.on("click", (e, f) => pick(f)).on("keydown", (e, f) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(f); } });
        indexHi = svg.append("path").attr("class", "reg-hi").attr("pathLength", 1).attr("stroke-dasharray", 1);

        // the stacks: true scale, one block = 500 loans; the tallest no higher than 30% of the stage and never off its top
        const anchors = regionsGeo.features.map((f) => { const r = f.properties.region, at = LABEL_AT[r]; return { r, p: at ? proj(at) : path.centroid(f), v: loanBy.get(r) }; });
        let k = 0.3 * H / d3.max(anchors, (a) => a.v);
        const band = desk ? Math.max(54, H * 0.075) : 14;
        anchors.forEach((a) => { k = Math.min(k, (a.p[1] - band) / a.v); });
        STACK_UNIT = loanUnit();
        document.querySelectorAll(".index-unit").forEach((e) => { e.textContent = fmt(STACK_UNIT); });
        indexEl.setAttribute("aria-label", `Map of Italy's 20 regions. From each region rises a stack of blocks: one block is ${fmt(STACK_UNIT)} local loans a year per public library, 2022. Each region is a button that follows it through the story.`);
        const bpx = STACK_UNIT * k, sw = desk ? Math.max(9, Math.min(12, W / 125)) : 7, gap = Math.min(1.5, bpx * 0.2);
        const order = anchors.slice().sort((a, b) => a.p[1] - b.p[1]); // north first: southern stacks stand in front
        const stacks = svg.append("g").selectAll("g").data(order).join("g")
          .attr("class", (a) => "stack" + (southern.has(a.r) ? " south" : "")).attr("data-region", (a) => a.r)
          .attr("transform", (a) => `translate(${a.p[0]},${a.p[1]})`);
        stacks.each(function (a) {
          const n = Math.floor(a.v / STACK_UNIT), frac = a.v / STACK_UNIT - n;
          const blocks = d3.range(n).map((i) => ({ i, h: bpx, full: true }));
          if (frac * bpx >= 0.3) blocks.push({ i: n, h: frac * bpx, full: false });
          a.blocks = blocks.length;
          // block i spans [i, i+1] units from the ground: the top of the stack is exactly the value
          d3.select(this).selectAll("rect").data(blocks).join("rect").attr("class", "blk")
            .attr("x", (b) => -sw / 2 + (jitter(a.r + b.i) - 0.5) * sw * 0.24)
            .attr("width", (b) => sw * (0.88 + jitter(b.i + a.r) * 0.24))
            .attr("y", (b) => -(b.i * bpx + b.h)).attr("height", (b) => Math.max(0.6, b.full ? b.h - gap : b.h)).attr("rx", Math.min(1.5, bpx / 4));
          d3.select(this).append("line").attr("class", "foot").attr("x1", -sw * 0.75).attr("x2", sw * 0.75).attr("y1", 0.5).attr("y2", 0.5);
        });

        // labels beside each stack's top, placed so they never overlap a stack or each other
        const fs = narrow ? 11 : 12, lh = fs + 5;
        const blocked = order.map((a) => Object.assign([a.p[0] - sw / 2 - 2, a.p[1] - a.v * k - 2, a.p[0] + sw / 2 + 2, a.p[1] + 2], { own: a.r }));
        const capEl = document.querySelector(".index-cap");
        if (desk && capEl) { const c = capEl.getBoundingClientRect(); blocked.push([c.left - me.left - 8, c.top - me.top - 8, c.right - me.left, c.bottom - me.top]); }
        const callouts = desk ? order.filter((a) => CALLOUT[a.r]) : [];
        // a callout set at a fixed point (Campania) runs level from its stack; one set in the sky (Emilia-Romagna) rises into the top band first
        const sky = band * 0.5;
        const calloutEnd = (a) => { const c = CALLOUT[a.r]; return c.at[1] == null ? [Math.max(proj([c.at[0], 45])[0], W - 176), sky] : proj(c.at); };
        const leadPath = (a) => {
          const c = CALLOUT[a.r], [ex, ey] = calloutEnd(a), tx = a.p[0], ty = a.p[1] - a.v * k;
          return c.at[1] == null ? `M${tx},${ty - 4}V${ey}H${ex}` : `M${tx + (c.side === "start" ? sw / 2 + 4 : -sw / 2 - 4)},${ty}H${ex}`;
        };
        callouts.forEach((a) => {
          const c = CALLOUT[a.r], [ex, ey] = calloutEnd(a), tx = a.p[0], ty = a.p[1] - a.v * k, w = 170;
          blocked.push(c.side === "start" ? [ex - 2, ey - 26, ex + w, ey + 54] : [ex - w, ey - 26, ex + 2, ey + 54]);
          if (c.at[1] == null) { blocked.push([tx - 3, ey - 4, tx + 3, ty]); blocked.push([Math.min(tx, ex) - 2, ey - 4, Math.max(tx, ex) + 2, ey + 4]); }
          else blocked.push([Math.min(tx, ex) - 2, ty - 5, Math.max(tx, ex) + 2, ty + 5]);
        });
        const minX = desk ? -48 : 2; // desktop: a label may reach into the 64px column gap, never the text column
        const keepPhone = new Set(["Emilia-Romagna", "Lombardia", "Trentino-Alto Adige", "Toscana", "Lazio", "Sardegna", "Puglia", "Sicilia", "Calabria", "Campania", "Piemonte", "Veneto"]);
        const labels = [];
        // the claim's two ends are labelled first, then the rest from the tallest tops down
        const first = (r) => (r === "Emilia-Romagna" || r === "Campania" ? 0 : 1);
        order.slice().sort((a, b) => first(a.r) - first(b.r) || (a.p[1] - a.v * k) - (b.p[1] - b.v * k)).forEach((a) => {
          if (CALLOUT[a.r] && desk) return;
          if (narrow && !keepPhone.has(a.r)) return;
          const name = MAP_NAME[a.r] || a.r, txt = `${name} ${fmt(a.v)}`, w = txt.length * fs * 0.55 + 8;
          const ty = a.p[1] - a.v * k;
          const tries = [[a.p[0] + sw / 2 + 3, ty + fs * 0.35, "start"], [a.p[0] - sw / 2, ty - 6, "start"], [a.p[0] + sw / 2, ty - 6, "end"],
            [a.p[0] - sw / 2, ty - 6 - lh, "start"], [a.p[0] + sw / 2, ty - 6 - lh, "end"], [a.p[0] - sw / 2 - 3, ty + fs * 0.35, "end"], [a.p[0] + sw / 2 + 3, ty - lh + fs * 0.35, "start"],
            [a.p[0] - sw / 2 - 3, ty - lh + fs * 0.35, "end"], [a.p[0] + sw / 2 + 3, ty + lh + fs * 0.35, "start"], [a.p[0] - sw / 2 - 3, ty + lh + fs * 0.35, "end"],
            [a.p[0] + sw / 2 + 3, ty + 2 * lh + fs * 0.35, "start"], [a.p[0] - sw / 2 - 3, ty - 2 * lh + fs * 0.35, "end"],
            // at the foot of the stack, on the land
            [a.p[0] + sw / 2 + 3, a.p[1] - 2, "start"], [a.p[0] - sw / 2 - 3, a.p[1] - 2, "end"], [a.p[0] + sw / 2 + 3, a.p[1] + lh - 2, "start"], [a.p[0] - sw / 2 - 3, a.p[1] + lh - 2, "end"],
            [a.p[0] + sw / 2 + 3, ty + 3 * lh + fs * 0.35, "start"], [a.p[0] - sw / 2 - 3, ty + 3 * lh + fs * 0.35, "end"], [a.p[0] + sw / 2 + 3, ty - 3 * lh + fs * 0.35, "start"],
            [a.p[0] - sw / 2 - 3, ty - 3 * lh + fs * 0.35, "end"], [a.p[0] - sw / 2, ty - 6 - 2 * lh, "start"], [a.p[0] + sw / 2, ty - 6 - 2 * lh, "end"],
            [a.p[0] + sw / 2 + 3, a.p[1] + 2 * lh - 2, "start"], [a.p[0] - sw / 2 - 3, a.p[1] + 2 * lh - 2, "end"], [a.p[0] - sw / 2 - 3, ty + 4 * lh + fs * 0.35, "end"], [a.p[0] + sw / 2 + 3, ty + 4 * lh + fs * 0.35, "start"]];
          for (const [x, y, anchor] of tries) {
            const bx = anchor === "start" ? x - 3 : x - w + 3, box = [bx, y - fs - 1, bx + w, y + 4];
            if (box[0] < minX || box[2] > W - 2 || box[1] < 2 || box[3] > H - 2) continue;
            if (blocked.some((b) => { if (b.own === a.r) return false; const p = b.own ? 10 : 0; return b[0] - p < box[2] && box[0] < b[2] + p && b[1] - p < box[3] && box[1] < b[3] + p; })) continue;
            blocked.push(box); labels.push({ a, x, y, anchor, name, box }); return;
          }
        });
        const lg = svg.append("g");
        lg.selectAll("rect").data(labels).join("rect").attr("class", "stk-hl").attr("data-region", (l) => l.a.r)
          .attr("x", (l) => l.box[0]).attr("y", (l) => l.box[1] + 1).attr("width", (l) => l.box[2] - l.box[0]).attr("height", (l) => l.box[3] - l.box[1] - 1).attr("rx", 3);
        const lt = lg.selectAll("text").data(labels).join("text").attr("class", "stk-lbl").attr("data-region", (l) => l.a.r)
          .attr("x", (l) => l.x).attr("y", (l) => l.y).attr("text-anchor", (l) => l.anchor).style("font-size", fs + "px");
        lt.append("tspan").text((l) => l.name + " ");
        lt.append("tspan").attr("class", "v").text((l) => fmt(l.a.v));

        // the claim's two ends, in the sea, with leader lines and their values on the highlighter
        const cg = svg.append("g").selectAll("g").data(callouts).join("g").attr("class", "callout-g").attr("data-region", (a) => a.r);
        cg.each(function (a) {
          const c = CALLOUT[a.r], g = d3.select(this), tx = a.p[0], ty = a.p[1] - a.v * k;
          const [ex, ey] = calloutEnd(a);
          g.append("circle").attr("class", "lead-dot").attr("cx", tx).attr("cy", ty).attr("r", 2.5);
          const ln = g.append("path").attr("class", "lead").attr("d", leadPath(a)).attr("pathLength", 1);
          const tx2 = ex + (c.side === "start" ? 6 : -6);
          g.append("text").attr("class", "callout").attr("x", tx2).attr("y", ey - 7).attr("text-anchor", c.side).append("tspan").attr("class", "nm").text(a.r);
          const val = fmt(a.v), vw = val.length * 12.6 + 14;
          const vx = c.side === "start" ? ex + 2 : ex - vw - 2;
          g.append("rect").attr("class", "callout-hl").attr("x", vx).attr("y", ey + 1).attr("width", vw).attr("height", 29).attr("rx", 3);
          g.append("text").attr("class", "callout").attr("x", vx + 7).attr("y", ey + 23).append("tspan").attr("class", "v").text(val);
          g.append("text").attr("class", "callout").attr("x", tx2).attr("y", ey + 48).attr("text-anchor", c.side).text("loans per public library");
          a.lead = ln;
        });

        paintIndex(focus.hover || focus.pinned);
        // the first time the map comes into view: the land arrives from the Alps down to Sicily, the stacks build block by block,
        // then the two ends of the claim are marked
        if (motionOn() && !revealed.has("index-map")) {
          const hidden = [...regs.nodes(), ...stacks.nodes(), lg.node(), ...cg.nodes()];
          hidden.forEach((n) => { n.style.opacity = 0; });
          if (indexEl._io) indexEl._io.disconnect();
          indexEl._io = new IntersectionObserver((en) => {
            if (!en.some((e) => e.isIntersecting)) return;
            indexEl._io.disconnect(); indexEl._io = null; revealed.add("index-map");
            hidden.forEach((n) => { n.style.opacity = ""; });
            const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
            regs.each(function (f) { this.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: (path.centroid(f)[1] / H) * 420, easing: ease, fill: "backwards" }); });
            let last = 0;
            stacks.each(function (a, si) {
              const d0 = 260 + si * 26;
              d3.select(this).selectAll("rect").each(function (b, i) {
                const d = d0 + i * 22; last = Math.max(last, d + 240);
                this.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, delay: d, easing: ease, fill: "backwards" });
              });
            });
            lg.node().animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: last - 120, easing: ease, fill: "backwards" });
            cg.each(function (a) {
              a.lead.node().animate([{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }], { duration: 420, delay: last - 160, easing: ease, fill: "backwards" });
              [...this.querySelectorAll("text, rect, circle")].forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: last + 120, easing: ease, fill: "backwards" }));
            });
          }, { threshold: 0.3 });
          indexEl._io.observe(indexEl);
        }
      }
      // ---------- the first screen: the year's loans of one public library in Emilia-Romagna and one in Campania, as two piles of books ----------
      const pileEl = document.getElementById("pile");
      function pileHero() {
        if (!pileEl) return;
        pileEl._for = focus.pinned;
        const W = Math.max(260, pileEl.clientWidth), H = Math.max(300, pileEl.clientHeight);
        const hi = loans.regions.find((r) => r.region === "Emilia-Romagna"), lo = loans.regions.find((r) => r.region === "Campania");
        const vsH = Math.round(Math.max(28, Math.min(48, W * 0.075))), head = Math.round(vsH * 0.74) + 64, floorY = H - 1; // room above the tallest pile for its name, unit and value
        // one book is the smallest round unit that keeps a book at least 5px thick
        const unit = loanUnit();
        document.getElementById("pile-key").textContent = `One book in these piles is ${fmt(unit)} loans a year.`;
        const k = (floorY - head) / hi.mean_public, bp = unit * k, gap = Math.min(1.2, bp * 0.18);
        const mine = focus.pinned && focus.pinned !== hi.region && focus.pinned !== lo.region ? loans.regions.find((r) => r.region === focus.pinned) : null;
        const narrowP = W < 400; // phone-size stage: shorter labels
        const piles = mine ? [
          { r: hi, cx: W * 0.18, bw: Math.min(160, W * 0.28), south: false },
          { r: mine, cx: W * 0.52, bw: Math.min(140, W * 0.24), south: mine.area === SOUTH, mine: true },
          { r: lo, cx: W * 0.85, bw: Math.min(100, W * 0.18), south: true },
        ] : [
          { r: hi, cx: W * 0.36, bw: Math.min(220, W * 0.4), south: false },
          { r: lo, cx: W * 0.78, bw: Math.min(140, W * 0.22), south: true },
        ];
        const svg = d3.select(pileEl).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("aria-hidden", "true");
        svg.append("line").attr("class", "floor").attr("x1", 0).attr("x2", W).attr("y1", floorY + 0.5).attr("y2", floorY + 0.5);
        const groups = svg.selectAll("g.p").data(piles).join("g").attr("class", (p) => "p" + (p.south ? " south" : "") + (p.mine ? " mine" : ""));
        groups.each(function (p) {
          const v = p.r.mean_public, n = Math.floor(v / unit), frac = v / unit - n;
          const books = d3.range(n).map((i) => ({ i, h: bp, full: true }));
          if (frac * bp >= 0.4) books.push({ i: n, h: frac * bp, full: false });
          p.books = books.length;
          // books lie flat, a little uneven in width and set slightly off one another, as in a real pile;
          // only the height of the pile carries the value
          d3.select(this).selectAll("rect").data(books).join("rect")
            .attr("class", (b) => "bk t" + Math.floor(wobble(p.r.region + "t" + b.i) * 3))
            .attr("width", (b) => p.bw * (0.74 + 0.26 * wobble(p.r.region + b.i)))
            .attr("x", (b) => p.cx - (p.bw * (0.74 + 0.26 * wobble(p.r.region + b.i))) / 2 + (wobble(b.i + p.r.region) - 0.5) * p.bw * 0.1)
            .attr("y", (b) => floorY - b.i * bp - b.h).attr("height", (b) => Math.max(0.8, b.full ? b.h - gap : b.h)).attr("rx", Math.min(1.5, bp / 3));
          const topY = floorY - v * k;
          // name, value, unit, stacked above the pile's top; the label never rises above the stage
          // every label on one shared line at the top of the stage; a short pile is joined to its label by a thin leader
          const vs = Math.round(Math.max(28, Math.min(48, W * 0.075))), cap = vs * 0.74;
          const longUnit = !p.mine && !(narrowP || mine) && (p === piles[0] || W >= 520), lw = longUnit ? 192 : p.mine ? 92 : 104; // the label's widest line
          const lx = Math.max(0, Math.min(p.cx - p.bw / 2, W - lw)), ly = Math.round(cap) + 46;
          if (topY - ly > 26) d3.select(this).append("line").attr("class", "p-lead").attr("x1", p.cx).attr("x2", p.cx).attr("y1", ly + 10).attr("y2", topY - 6);
          const t = d3.select(this).append("g").attr("class", "p-lbl").attr("transform", `translate(${lx},${ly})`);
          t.append("text").attr("class", "p-name").attr("y", -(cap + 30)).text(p.r.region);
          t.append("text").attr("class", "p-val").style("font-size", vs + "px").text(fmt(v));
          t.append("text").attr("class", "p-unit").attr("y", -(cap + 12)).text(p.mine ? "your region" : (longUnit ? "loans a year per public library" : "loans a year"));
        });
        // entrance, once: Emilia-Romagna's pile is built book by book, then Campania's one and a half books are set down, then the claim is marked
        if (motionOn() && !revealed.has("pile")) {
          revealed.add("pile");
          const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
          let t0 = 200, end = 0;
          groups.each(function (p, gi) {
            const step = p.books > 6 ? Math.min(11, 1100 / p.books) : 260, dur = p.books > 6 ? 300 : 460;
            d3.select(this).selectAll("rect").each(function (b, i) {
              const d = t0 + i * step; end = Math.max(end, d + dur);
              this.animate([{ opacity: 0, transform: "translateY(-28px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: dur, delay: d, easing: ease, fill: "backwards" });
            });
            this.querySelector(".p-lbl").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: end - 120, easing: ease, fill: "backwards" });
            t0 = end + 180;
          });
          setTimeout(() => heroEl.classList.add("is-in"), end + 80);
        } else heroEl.classList.add("is-in");
      }

      function paintIndex(r) {
        if (!indexHi) return;
        const f = r && regionsGeo.features.find((x) => x.properties.region === r);
        indexEl.classList.toggle("has-focus", !!f);
        indexEl.querySelectorAll("[data-region]").forEach((el) => el.classList.toggle("is-focus", el.dataset.region === r));
        indexEl.querySelectorAll(".reg").forEach((el) => el.setAttribute("aria-pressed", el.dataset.region === focus.pinned ? "true" : "false"));
        const was = indexHi.attr("data-region");
        if (f) indexHi.attr("d", outlineOf(f)).attr("data-region", r);
        // the outline draws itself when a region is followed; hovering only shows it
        const draw = !!f && was !== r && r === focus.pinned && !focus.hover;
        indexHi.classed("draw", false);
        if (draw) indexHi.node().getBoundingClientRect();
        indexHi.classed("draw", draw).classed("on", !!f);
      }
      focusHooks.push(paintIndex);

      function renderProfile(region) {
        pill.hidden = !region;
        shareBtn.hidden = !region;
        if (!region) { profile.innerHTML = ""; return; }
        pill.querySelector(".pill-name").textContent = region;
        profile.innerHTML = `<div class="pf-card"><div class="pf-head"><h3>Where ${region} stands</h3><p class="small" style="margin:0">Seven measures, each ranked against the other 19 regions</p></div><ol class="pf">${measures.map((m, i) => {
          const v = m.values.get(region), rk = m.rank.get(region);
          return `<li style="--i:${i}"><a href="${m.anchor}"><span class="pf-name">${m.label}<span class="pf-year">${m.year}</span></span>${strip(m, region)}<span class="pf-val"><b>${m.f(v)}</b><span>${ordinal(rk)} highest of 20</span><span>Italy ${m.f(m.italy)}</span></span></a></li>`;
        }).join("")}<li style="--i:7" aria-hidden="true"><p class="pf-key"><span><i class="k-me"></i>${region}</span><span><i class="k-other"></i>the other regions</span><span><i class="k-it"></i>Italy</span><span>lowest at left, highest at right</span></p></li></ol></div>`;
        // each dot leaves Italy's mark and settles on the region's value: the distance it travels is the gap
        if (motionOn()) profile.querySelectorAll(".pf-me").forEach((c, i) => {
          c.animate([{ transform: `translateX(${c.dataset.dx}px)` }, { transform: "translateX(0)" }], { duration: 700, delay: 180 + i * 40, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
        });
      }
      function follow(region, push = true) {
        focus.pinned = region || null;
        if (pileEl._for !== focus.pinned) pileHero();
        select.value = region || "";
        renderProfile(focus.pinned);
        updateSigns(focus.pinned, push);
        applyFocus();
        if (push) {
          const u = new URL(location.href);
          if (region) u.searchParams.set("region", region); else u.searchParams.delete("region");
          history.replaceState(null, "", u);
        }
      }
      // phones: every region as a ranked list of buttons under the map, where the map is too small to label them all
      const indexList = document.getElementById("index-list");
      if (indexList) {
        indexList.innerHTML = loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public)
          .map((r) => `<li><button type="button" data-region="${r.region}" aria-pressed="false"><span>${short(r.region, true)}</span><b>${fmt(r.mean_public)}</b></button></li>`).join("");
        indexList.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) follow(focus.pinned === b.dataset.region ? null : b.dataset.region); });
        focusHooks.push(() => indexList.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.region === focus.pinned ? "true" : "false")));
      }
      select.addEventListener("change", () => follow(select.value));
      pill.querySelector("button").addEventListener("click", () => { follow(null); select.focus(); });

      shareBtn.addEventListener("click", async () => {
        const region = focus.pinned;
        if (!region) return;
        const TXT = '"Hyperlegible Sans"', DSP = '"Haskoy"';
        try { await Promise.all([document.fonts.load(`600 40px ${DSP}`), document.fonts.load(`400 20px ${TXT}`), document.fonts.load(`700 20px ${TXT}`)]); } catch (e) { /* system font */ }
        const W = 1200, H = 630, c = document.createElement("canvas");
        c.width = W; c.height = H;
        const x = c.getContext("2d");
        const F = (w, s, fam = TXT) => `${w} ${s}px ${fam}, system-ui, sans-serif`;
        // always the light catalogue palette, whatever the reader's theme
        const INK = "#303234", INK2 = "#47494b", MUTED = "#5e5f5f", RULE = "#d6d1c3", REST = "#687b82", PAPER = "#eeeadf", CARD = "#f8f6f0", TAB = "#303234";
        x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
        // the index tab, as on every chapter
        x.font = F(600, 21, DSP);
        const bw = x.measureText("Culture for All").width;
        const rr = (x0, y0, w, h, r) => { x.beginPath(); x.moveTo(x0, y0 + h); x.lineTo(x0, y0 + r); x.arcTo(x0, y0, x0 + r, y0, r); x.lineTo(x0 + w - r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + r, r); x.lineTo(x0 + w, y0 + h); x.closePath(); };
        x.fillStyle = "#c7b892"; rr(48, 34, bw + 32, 42, 8); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.5; x.stroke(); x.fillStyle = INK; x.fillRect(48, 76, W - 96, 2);
        x.fillStyle = INK; x.fillText("Culture for All", 64, 63);
        x.fillStyle = INK2; x.font = F(400, 17); x.fillText("Access to culture across Italy's regions", 48 + bw + 52, 63);
        x.fillStyle = INK; x.font = F(600, 48, DSP); x.fillText(`Where ${region} stands`, 64, 150);
        x.fillStyle = CARD; x.strokeStyle = RULE; x.lineWidth = 1;
        x.beginPath(); x.roundRect(48, 176, W - 96, 386, 12); x.fill(); x.stroke();
        const top = 228, rowH = 50, sx = 610, sw = 270;
        measures.forEach((m, i) => {
          const y = top + i * rowH;
          if (i) { x.strokeStyle = RULE; x.lineWidth = 1; x.beginPath(); x.moveTo(72, y - 31); x.lineTo(W - 72, y - 31); x.stroke(); }
          x.fillStyle = INK; x.font = F(700, 19); x.fillText(m.label, 72, y);
          const lw = x.measureText(m.label).width;
          x.fillStyle = MUTED; x.font = F(400, 15); x.fillText(m.year, 72 + lw + 10, y);
          const sc = d3.scaleLinear().domain([m.min, m.max]).range([sx + 8, sx + sw - 8]);
          x.strokeStyle = REST; x.lineWidth = 2;
          m.values.forEach((v, r) => { if (r !== region) { x.beginPath(); x.moveTo(sc(v), y - 18); x.lineTo(sc(v), y + 2); x.stroke(); } });
          if (m.italy >= m.min && m.italy <= m.max) { x.strokeStyle = TAB; x.lineWidth = 3; x.beginPath(); x.moveTo(sc(m.italy), y - 23); x.lineTo(sc(m.italy), y + 7); x.stroke(); }
          x.fillStyle = INK; x.strokeStyle = CARD; x.lineWidth = 3;
          x.beginPath(); x.arc(sc(m.values.get(region)), y - 8, 9, 0, 6.2832); x.fill(); x.stroke();
          x.textAlign = "right";
          x.fillStyle = INK; x.font = F(600, 24, DSP); x.fillText(m.f(m.values.get(region)), W - 184, y);
          x.fillStyle = INK2; x.font = F(400, 16); x.fillText(`${ordinal(m.rank.get(region))} of 20`, W - 72, y);
          x.textAlign = "left";
        });
        x.fillStyle = MUTED; x.font = F(400, 15);
        x.fillText(`Dot: ${region}. Grey ticks: the other 19 regions. Charcoal tick: Italy.`, 64, H - 30);
        x.textAlign = "right"; x.fillText("alicepicco333.github.io/culture4all · ISTAT, Ministry of Culture", W - 64, H - 30); x.textAlign = "left";
        const a = document.createElement("a");
        a.download = `culture4all-${region.toLowerCase().replace(/[^a-z]+/g, "-")}.png`;
        a.href = c.toDataURL("image/png");
        document.body.appendChild(a); a.click(); a.remove();
      });

      draw();
      const start = new URL(location.href).searchParams.get("region");
      follow(regionsList.includes(start) ? start : null, false);
      let tmo, lastW = window.innerWidth;
      window.addEventListener("resize", () => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth; clearTimeout(tmo); tmo = setTimeout(draw, 150);
      });
      // colours drawn into canvases and map labels are read from the theme, so a theme change redraws them
      redrawForTheme = () => { draw(); };
      // web fonts change text heights: level the split screens again once they have loaded
      document.fonts?.ready.then(() => { indexMap(); equalize(); applyFocus(); });
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (!root.dataset.theme) redrawForTheme(); });
    })
    .catch((err) => { console.error("Could not load story data", err); });

  // one unit of loans for every book, block and spine on the page: 100 from 900px, 250 below, so "true scale" can be checked across charts
  const loanUnit = () => (window.matchMedia("(min-width: 900px)").matches ? 100 : 250);
  // a steady pseudo-random number for a seed: the small irregularities of books, the same on every redraw
  const wobble = (seed) => { let h = 2166136261; const t = String(seed); for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000; };

  // ---------- shelves: one mark per `unit` of the value, the last mark cut to the remainder ----------
  // marks: "spine" (books on a shelf), "sq" (squares of people), "tick" (a rhythm of ticks; the last tick is shortened)
  // rows: [{label, value, hi, region, tip}] ; opts: {unit, max, ref, refLabel, labelW, mark, fmtV, tickFmt, what}
  function shelves(id, rows, opts = {}) {
    const el = document.getElementById(id);
    const W = width(el), narrow = W < 520;
    const labelW = opts.labelW ? (narrow ? Math.min(opts.labelW, 112) : opts.labelW) : (narrow ? 112 : 170), valW = narrow ? 50 : 62;
    const base = 30, band = base + (opts.extra || 0) / rows.length;
    el._fill = (extra) => shelves(id, rows, { ...opts, extra });
    const f = opts.fmtV || fmt, what = opts.what || "loans per public library", mark = opts.mark || "spine";
    const top = opts.ref != null ? 26 : 6, H = top + rows.length * band + 26;
    const x = d3.scaleLinear().domain([0, opts.max]).range([labelW, W - valW]);
    const step = x(opts.unit) - x(0), cut = Math.min(1.6, step * 0.24), spineH = base - 9;
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const ticks = x.ticks(narrow ? 3 : 5);
    svg.append("g").selectAll("line").data(ticks).join("line").attr("class", "gridline").attr("x1", x).attr("x2", x).attr("y1", top - 2).attr("y2", top + rows.length * band);
    svg.append("g").attr("transform", `translate(0,${top + rows.length * band + 4})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickFormat(d3.format(opts.tickFmt || ","))).call(cleanAxis);
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${top + i * band})`)
      .attr("data-region", (d) => d.region || null).attr("class", (d) => (d.hi ? "south" : null));
    g.filter((d) => d.region).append("rect").attr("class", "hlrow").attr("x", 0).attr("y", 1).attr("width", W).attr("height", band - 2).attr("rx", 4);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("y", band / 2).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => short(d.label, narrow));
    const floor = band / 2 + spineH / 2;
    g.append("line").attr("class", "shelf").attr("x1", x(0)).attr("x2", W - valW + 4).attr("y1", floor + 0.75).attr("y2", floor + 0.75);
    const sq = Math.min(step - cut, spineH), tw = Math.max(1.5, Math.min(2.5, step * 0.35));
    const marks = g.selectAll("rect.mk").data((d) => {
      const n = Math.floor(d.value / opts.unit + 1e-9), frac = d.value / opts.unit - n, out = [];
      for (let i = 0; i < n; i++) out.push({ i, f: 1, d });
      if (frac > 0.02) out.push({ i: n, f: frac, d });
      return out;
    }).join("rect").attr("class", mark === "tick" ? "mk tick-m" : "mk spine")
      .attr("x", (m) => (mark === "tick" ? x(0) + m.i * step + (step - tw) / 2 : x(0) + m.i * step))
      .attr("width", (m) => (mark === "tick" ? tw : mark === "sq" ? Math.max(0.8, sq * m.f) : Math.max(0.8, (step - cut) * m.f)))
      .attr("height", (m) => (mark === "tick" ? spineH * m.f : mark === "sq" ? sq : spineH * (0.8 + 0.2 * wobble(m.d.label + m.i))))
      .attr("y", (m) => floor - (mark === "tick" ? spineH * m.f : mark === "sq" ? sq : spineH * (0.8 + 0.2 * wobble(m.d.label + m.i))))
      .attr("rx", mark === "tick" ? 1 : Math.min(1.2, step / 5));
    // a value that would straddle the reference line moves just past it, so the line never runs through the figure
    const xr = opts.ref != null ? x(opts.ref) : null;
    const vx = (d) => { const a = x(d.value) + 7, w = f(d.value).length * 7.4; return xr != null && a < xr + 4 && a + w > xr - 2 ? xr + 6 : a; };
    const val = g.append("text").attr("class", "val-b").attr("x", vx).attr("y", band / 2).attr("dy", "0.35em").text((d) => f(d.value));
    let ref;
    if (opts.ref != null) {
      const far = x(opts.ref) > W * 0.7;
      ref = svg.insert("g", ":first-child");
      ref.append("line").attr("class", "bookend").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", top - 6).attr("y2", top + rows.length * band);
      ref.append("text").attr("class", "bookend-lbl").attr("x", x(opts.ref)).attr("y", top - 11).attr("text-anchor", far ? "end" : "start").attr("dx", far ? -4 : 4).text(opts.refLabel);
    }
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.label}: ${f(d.value)} ${what}`);
    bindTip(hit, (d) => d.tip || `<b>${d.label}</b>${f(d.value)} ${what}`, (d) => d.region || null);
    // the marks are set down left to right, row by row; then the counts and the reference line
    onReveal(el, () => { marks.style("opacity", 0); val.style("opacity", 0); if (ref) ref.style("opacity", 0); }, () => {
      marks.each(function (m) {
        const row = rows.indexOf(m.d);
        d3.select(this).transition().delay(row * 32 + Math.min(m.i * 9, 420)).duration(220).ease(easeOut).style("opacity", null);
      });
      val.transition().delay((d, i) => 240 + i * 32 + Math.min((d.value / opts.unit) * 9, 420)).duration(260).style("opacity", null);
      if (ref) ref.transition().delay(500).duration(360).style("opacity", null);
    });
  }
  // the smallest unit from the list that keeps one mark at least minPx wide
  function spineUnit(id, max, labelW, units = [100, 250, 500, 1000], minPx = 6) {
    const W = width(document.getElementById(id)), narrow = W < 520;
    const plot = W - (narrow ? Math.min(labelW, 112) : labelW) - (narrow ? 50 : 62);
    return units.find((u) => (plot * u) / max >= minPx) || units[units.length - 1];
  }
  // the key under a shelf chart: one spine and what it is worth
  function keySpine(unit) {
    const k = d3.select("#key-spine").html("");
    const s = k.append("svg").attr("width", 9).attr("height", 18).attr("viewBox", "0 0 9 18");
    s.append("rect").attr("x", 1).attr("y", 1).attr("width", 7).attr("height", 17).attr("rx", 1.2).style("fill", "var(--rest-2)");
    k.append("span").text(`One spine: ${fmt(unit)} loans a year`);
  }

  // ---------- the field: a tile per region standing for 10,000 residents, one book mark per library ----------
  const TILE = { "Valle d'Aosta": [0, 0], Lombardia: [1, 0], "Trentino-Alto Adige": [2, 0], "Friuli-Venezia Giulia": [3, 0],
    Piemonte: [0, 1], "Emilia-Romagna": [1, 1], Veneto: [2, 1], Liguria: [0, 2], Toscana: [1, 2], Marche: [2, 2],
    Lazio: [1, 3], Umbria: [2, 3], Abruzzo: [3, 3], Sardegna: [0, 4], Campania: [2, 4], Molise: [3, 4], Puglia: [4, 4],
    Basilicata: [3, 5], Sicilia: [2, 6], Calabria: [3, 6] };
  function fieldTiles(lib) {
    const el = document.getElementById("dots-rate");
    const W = width(el), tiles = W >= 640;
    const items = lib.regions.map((r) => ({ label: r.region, region: r.region, value: r.per10k, libraries: r.libraries, area: r.area, south: r.area === SOUTH }));
    const italy = { label: "Italy", value: lib.areas.ITALIA, italy: true };
    const tipOf = (d) => d.italy ? `<b>Italy</b>${fmt1(d.value)} libraries per 10,000 inhabitants` : `<b>${d.label}</b>${fmt1(d.value)} per 10,000 inhabitants<br>${fmt(d.libraries)} libraries (2012)`;
    const svg = d3.select(el).html("").append("svg");
    let H, mw, mh, mgap, placeOf;
    if (tiles) {
      // ranked: most libraries per inhabitant first, reading left to right, row by row; Italy takes its place in the ranking
      const ranked = items.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
      const at = ranked.findIndex((d) => d.value < italy.value);
      ranked.splice(at < 0 ? ranked.length : at, 0, italy);
      ranked.forEach((d, i) => { d.rank = i; });
      const cols = 7, rowsN = Math.ceil(ranked.length / cols), gx = 10, gy = 10, cw = (W - gx * (cols - 1)) / cols, ch = 96;
      mw = 12; mh = 32; mgap = 6; H = rowsN * ch + (rowsN - 1) * gy;
      placeOf = (d) => [(d.rank % cols) * (cw + gx), Math.floor(d.rank / cols) * (ch + gy), cw, ch];
    } else {
      // phone: one row per region, grouped by area and ranked, the same marks in a line
      const groups = ["North", "Centre", SOUTH];
      const rows = []; let y = 0;
      groups.forEach((gname) => {
        rows.push({ head: gname, y: y + 16 }); y += 26;
        items.filter((d) => d.area === gname).sort((a, b) => b.value - a.value).forEach((d) => { d.ry = y; y += 34; });
        y += 8;
      });
      italy.ry = y; y += 34;
      mw = 9; mh = 22; mgap = 5; H = y;
      placeOf = (d) => [0, d.ry, W, 32];
      svg.append("g").selectAll("text").data(rows).join("text").attr("class", "area-h").attr("x", 0).attr("y", (r) => r.y).text((r) => r.head);
    }
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const all = [...items, italy];
    const g = svg.append("g").selectAll("g").data(all).join("g")
      .attr("class", (d) => (d.italy ? "italy" : d.south ? "south" : null)).attr("data-region", (d) => d.region || null)
      .attr("transform", (d) => { const [x, y] = placeOf(d); return `translate(${x},${y})`; });
    const markX0 = tiles ? 12 : 120;
    g.each(function (d) {
      const t = d3.select(this), [, , w, h] = placeOf(d);
      if (tiles) {
        t.append("rect").attr("class", "tile-bg").attr("width", w).attr("height", h).attr("rx", 8);
        t.append("text").attr("class", "tile-name").attr("x", 12).attr("y", 21).text(short(d.label, w < 200));
        // in a narrow tile the value takes its own line under the name
        if (w < 190) t.append("text").attr("class", "tile-val").attr("x", 12).attr("y", 43).style("font-size", "18px").text(fmt1(d.value));
        else t.append("text").attr("class", "tile-val").attr("x", w - 12).attr("y", 24).attr("text-anchor", "end").text(fmt1(d.value));
      } else {
        if (d.region) t.append("rect").attr("class", "hlrow").attr("x", 0).attr("y", 0).attr("width", w).attr("height", h).attr("rx", 4);
        t.append("text").attr("class", "lbl").attr("x", 0).attr("y", h / 2).attr("dy", "0.35em").text(d.italy ? "Italy" : short(d.label, true));
        t.append("text").attr("class", "val-b").attr("x", w - 2).attr("y", h / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(fmt1(d.value));
      }
      // one mark per library for 10,000 residents; the last one filled to the fraction
      const n = Math.floor(d.value + 1e-9), frac = d.value - n, base = tiles ? h - 12 : h / 2 + mh / 2;
      const marks = d3.range(n).map((i) => ({ i, f: 1 }));
      if (frac > 0.04) marks.push({ i: n, f: frac });
      marks.forEach((m) => {
        const x = markX0 + m.i * (mw + mgap), hh = mh * (0.9 + 0.1 * wobble(d.label + m.i));
        const mg = t.append("g").attr("class", "mk").attr("transform", `translate(${x},${base - hh})`);
        if (m.f < 1) mg.append("rect").attr("class", "mark-case").attr("x", 0.6).attr("y", 0.6).attr("width", mw - 1.2).attr("height", hh - 1.2).attr("rx", 2);
        mg.append("rect").attr("class", "mark").attr("x", 0).attr("y", hh * (1 - m.f)).attr("width", mw).attr("height", hh * m.f).attr("rx", 2);
        d.nMarks = (d.nMarks || 0) + 1;
      });
    });
    const hit = g.append("rect").attr("class", "hit").attr("width", (d) => placeOf(d)[2]).attr("height", (d) => placeOf(d)[3]).attr("rx", 8)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => (d.italy ? `Italy: ${fmt1(d.value)} libraries per 10,000 inhabitants` : `${d.label}: ${fmt1(d.value)} libraries per 10,000 inhabitants, ${fmt(d.libraries)} libraries`));
    bindTip(hit, tipOf, (d) => d.region || null);
    // the marks are set down tile by tile, from the Alps to Sicily
    const mk = g.selectAll(".mk");
    onReveal(el, () => mk.style("opacity", 0), () => {
      g.each(function (d, gi) {
        const [, y] = placeOf(d);
        d3.select(this).selectAll(".mk").each(function (m, i) {
          this.style.opacity = "";
          [...this.children].forEach((r) => r.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: (y / H) * 600 + i * 70, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" }));
        });
      });
    });
    // the key above the chart
    const key = d3.select("#key-mark").html("");
    const ks = key.append("svg").attr("width", 12).attr("height", 26).attr("viewBox", "0 0 12 26");
    ks.append("rect").attr("width", 11).attr("height", 26).attr("rx", 2).style("fill", "var(--rest-2)");
    key.append("span").text("One mark: one library for 10,000 residents");
  }

  // ---------- waffles: a block of ten by ten squares per region, one square per 1% of its municipalities, filled where there is no library ----------
  function waffles(id, mun, opts = {}) {
    const el = document.getElementById(id);
    const W = width(el), cols = W >= 480 ? 5 : 3;
    const items = mun.regions.map((r) => ({ label: r.region, region: r.region, value: (100 * r.without_library) / r.municipalities, n: r.municipalities, k: r.without_library, south: r.area === SOUTH }))
      .sort((a, b) => b.value - a.value);
    const italy = { label: "Italy", value: (100 * mun.without_library) / mun.municipalities, n: mun.municipalities, k: mun.without_library, italy: true };
    const at = items.findIndex((d) => d.value < italy.value);
    items.splice(at < 0 ? items.length : at, 0, italy);
    const gx = 14, tw = (W - 8 - gx * (cols - 1)) / cols, gap = 1.5, cs = Math.min(12, (tw - 9 * gap) / 10), ws = cs * 10 + gap * 9, head = 42;
    const nRows = Math.ceil(items.length / cols), th = head + ws, gy = 20 + (opts.extra || 0) / Math.max(1, nRows - 1);
    const H = nRows * th + (nRows - 1) * gy;
    el._fill = (extra) => waffles(id, mun, { extra });
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const g = svg.selectAll("g.wf").data(items).join("g").attr("class", (d) => "wf" + (d.italy ? " italy" : d.south ? " south" : "")).attr("data-region", (d) => d.region || null)
      .attr("transform", (d, i) => `translate(${(i % cols) * (tw + gx) + 4},${Math.floor(i / cols) * (th + gy) + 4})`);
    g.append("rect").attr("class", "wbg").attr("x", -4).attr("y", -4).attr("width", ws + 8).attr("height", th + 6).attr("rx", 5);
    g.append("text").attr("class", "tile-name").attr("x", 0).attr("y", 11).text((d) => short(d.label, true));
    g.append("text").attr("class", "tile-val").attr("x", 0).attr("y", 31).style("font-size", "17px").text((d) => `${Math.round(d.value)}%`);
    const cells = g.selectAll("g.c").data((d) => d3.range(100).map((i) => ({ i, f: Math.max(0, Math.min(1, d.value - i)), d }))).join("g").attr("class", "c")
      .attr("transform", (c) => `translate(${(c.i % 10) * (cs + gap)},${head + Math.floor(c.i / 10) * (cs + gap)})`);
    cells.append("rect").attr("class", "wcell").attr("width", cs).attr("height", cs).attr("rx", 1);
    const fills = cells.filter((c) => c.f > 0).append("rect").attr("class", "mark").attr("width", (c) => cs * c.f).attr("height", cs).attr("rx", 1);
    const hit = g.append("rect").attr("class", "hit").attr("x", -4).attr("y", -4).attr("width", ws + 8).attr("height", th + 6)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.label}: ${fmt(d.k)} of ${fmt(d.n)} municipalities have no library (${Math.round(d.value)}%)`);
    bindTip(hit, (d) => `<b>${d.label}</b>${fmt(d.k)} of ${fmt(d.n)} municipalities have no library (${Math.round(d.value)}%)`, (d) => d.region || null);
    onReveal(el, () => fills.style("opacity", 0), () => {
      fills.transition().delay((c) => items.indexOf(c.d) * 36 + c.i * 5).duration(160).style("opacity", null);
    });
  }

  // ---------- layers: everyone who read a book, built from 12+ books, 4 to 11 and 1 to 3 ----------
  function layers(id, read) {
    const el = document.getElementById(id);
    const W = width(el), narrow = W < 520, labelW = narrow ? 112 : 170, valW = narrow ? 50 : 62, band = 26;
    const rows = read.regions.slice().sort((a, b) => b.any - a.any)
      .map((r) => ({ ...r, mid: Math.max(0, r.any - r.one_to_three - r.twelve_plus), south: r.area === SOUTH }));
    const top = 26, H = top + rows.length * band + 26;
    const x = d3.scaleLinear().domain([0, 60]).range([labelW, W - valW]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const ticks = narrow ? [0, 20, 40, 60] : [0, 10, 20, 30, 40, 50, 60];
    svg.append("g").selectAll("line").data(ticks).join("line").attr("class", "gridline").attr("x1", x).attr("x2", x).attr("y1", top - 2).attr("y2", top + rows.length * band);
    svg.append("g").attr("transform", `translate(0,${top + rows.length * band + 4})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickFormat((v) => v + "%")).call(cleanAxis);
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${top + i * band})`)
      .attr("data-region", (d) => d.region).attr("class", (d) => (d.south ? "south" : null));
    g.append("rect").attr("class", "hlrow").attr("x", 0).attr("y", 1).attr("width", W).attr("height", band - 2).attr("rx", 4);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("y", band / 2).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => short(d.region, narrow));
    const segOf = (d) => [{ k: "l3", a: 0, b: d.twelve_plus, d }, { k: "l2", a: d.twelve_plus, b: d.twelve_plus + d.mid, d }, { k: "l1", a: d.twelve_plus + d.mid, b: d.any, d }];
    const bh = band - 9;
    const seg = g.selectAll("rect.seg").data(segOf).join("rect").attr("class", (s) => "seg " + s.k)
      .attr("x", (s) => x(s.a)).attr("y", 4.5).attr("height", bh).attr("width", (s) => Math.max(0, x(s.b) - x(s.a) - (s.k === "l1" ? 0.5 : 1))).attr("rx", 1.5);
    g.filter((d) => x(d.twelve_plus) - x(0) > 30).append("text").attr("class", "seg-in").attr("x", x(0) + 5).attr("y", band / 2).attr("dy", "0.35em").text((d) => fmt1(d.twelve_plus));
    const xr = x(read.italy.any), vx = (d) => { const a = x(d.any) + 7; return a < xr + 4 && a + 40 > xr ? xr + 6 : a; };
    const val = g.append("text").attr("class", "val-b").attr("x", vx).attr("y", band / 2).attr("dy", "0.35em").text((d) => fmt1(d.any) + "%");
    const ref = svg.insert("g", ":first-child");
    ref.append("line").attr("class", "bookend").attr("x1", x(read.italy.any)).attr("x2", x(read.italy.any)).attr("y1", top - 6).attr("y2", top + rows.length * band);
    ref.append("text").attr("class", "bookend-lbl").attr("x", x(read.italy.any) + 4).attr("y", top - 11).text(`Italy ${fmt1(read.italy.any)}%`);
    const tip = (d) => `<b>${d.region}</b>${fmt1(d.any)}% read at least one book<br>${fmt1(d.twelve_plus)}% read 12 or more<br>${fmt1(d.mid)}% read 4 to 11<br>${fmt1(d.one_to_three)}% read 1 to 3`;
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", band).attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", (d) => `${d.region}: ${fmt1(d.any)}% read at least one book; ${fmt1(d.twelve_plus)}% read 12 or more, ${fmt1(d.mid)}% 4 to 11, ${fmt1(d.one_to_three)}% 1 to 3`);
    bindTip(hit, tip, (d) => d.region);
    // each bar is laid down layer by layer, the strong readers first
    onReveal(el, () => { seg.attr("width", 0); val.style("opacity", 0); ref.style("opacity", 0); }, () => {
      seg.transition().delay((s) => rows.indexOf(s.d) * 26 + { l3: 0, l2: 220, l1: 440 }[s.k]).duration(320).ease(easeOut)
        .attr("width", (s) => Math.max(0, x(s.b) - x(s.a) - (s.k === "l1" ? 0.5 : 1)));
      val.transition().delay((d, i) => 700 + i * 26).duration(260).style("opacity", null);
      ref.transition().delay(600).duration(360).style("opacity", null);
    });
  }

  // ---------- time: every region's share of readers, every year ----------
  function timeLines(trend) {
    const el = document.getElementById("slope");
    const W = width(el), narrow = W < 600, H = narrow ? 460 : 520, m = { t: 26, b: 30, l: 36, r: narrow ? 124 : 176 };
    const years = trend.years, x = d3.scaleLinear().domain(d3.extent(years)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([20, 60]).range([H - m.b, m.t]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.append("g").selectAll("line").data(y.ticks(4)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat((v) => v + "%")).call((gg) => gg.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${H - m.b + 4})`).call(d3.axisBottom(x).tickValues(narrow ? years.filter((yr, i) => i % 2 === 0) : years).tickFormat(d3.format("d")).tickSize(0)).call(cleanAxis);
    const line = d3.line().x((v, i) => x(years[i])).y((v) => y(v));
    const col = (d) => (d.area === SOUTH ? "var(--accent)" : "var(--rest-2)");
    const g = svg.append("g").selectAll("g").data(trend.regions).join("g").attr("data-region", (d) => d.region);
    const paths = g.append("path").attr("class", "slope-line").attr("d", (d) => line(d.values)).attr("stroke", col).attr("stroke-width", 1.5);
    g.append("circle").attr("class", "dot").attr("cx", x(years[years.length - 1])).attr("cy", (d) => y(d.values[d.values.length - 1])).attr("r", 3).attr("fill", col);
    const lb = dodge(trend.regions.map((r) => ({ r, y: y(r.values[r.values.length - 1]) })), 13, m.t, H - m.b);
    const yb = new Map(lb.map((d) => [d.r.region, d.y]));
    const right = g.append("text").attr("class", "lbl sl").attr("x", x(years[years.length - 1]) + 10).attr("y", (d) => yb.get(d.region)).attr("dy", "0.35em")
      .text((d) => `${fmt1(d.values[d.values.length - 1])}  ${short(d.region, narrow)}`);
    const it = svg.append("path").attr("d", line(trend.italy)).attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
    svg.append("text").attr("class", "ref-lbl").attr("x", m.l + 4).attr("y", y(trend.italy[0]) - 8).text(`Italy ${fmt1(trend.italy[0])}%`);
    const hit = g.append("path").attr("class", "hit-line").attr("fill", "none").attr("d", (d) => line(d.values)).attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", (d) => `${d.region}: ${fmt1(d.values[0])}% in ${years[0]}, ${fmt1(d.values[d.values.length - 1])}% in ${years[years.length - 1]}, ${signed(d.values[d.values.length - 1] - d.values[0])} points`);
    bindTip(hit, (d) => `<b>${d.region}</b>${fmt1(d.values[0])}% in ${years[0]} → ${fmt1(d.values[d.values.length - 1])}% in ${years[years.length - 1]}<br>${signed(d.values[d.values.length - 1] - d.values[0])} points`, (d) => d.region);
    // ten years are drawn left to right
    onReveal(el, () => { paths.attr("pathLength", 1).attr("stroke-dasharray", "1 1").attr("stroke-dashoffset", 1); right.style("opacity", 0); }, () => {
      paths.transition().duration(1100).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0).on("end", function () { d3.select(this).attr("stroke-dasharray", null).attr("pathLength", null); });
      right.transition().delay(950).duration(320).style("opacity", null);
    });
  }

  // ---------- the gap: two average lines and the band between them ----------
  function gapRibbon(trend) {
    const el = document.getElementById("gapline");
    const W = width(el), narrow = W < 520, H = narrow ? 260 : 300, m = { l: 40, r: narrow ? 104 : 168, t: 20, b: 30 };
    const mean = (south, i) => d3.mean(trend.regions.filter((r) => (r.area === SOUTH) === south), (r) => r.values[i]);
    const pts = trend.years.map((yr, i) => ({ yr, n: mean(false, i), s: mean(true, i) }));
    const x = d3.scaleLinear().domain(d3.extent(trend.years)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([25, 55]).range([H - m.b, m.t]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.append("g").selectAll("line").data([30, 40, 50]).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).tickValues([30, 40, 50]).tickSize(0).tickFormat((v) => v + "%")).call((gg) => gg.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${H - m.b + 4})`).call(d3.axisBottom(x).tickValues(trend.years.filter((yr, i) => i % 2 === 0)).tickFormat(d3.format("d")).tickSize(0)).call(cleanAxis);
    const band = svg.append("path").attr("class", "gap-band").attr("d", d3.area().x((d) => x(d.yr)).y0((d) => y(d.s)).y1((d) => y(d.n))(pts));
    const ln = (k) => d3.line().x((d) => x(d.yr)).y((d) => y(d[k]))(pts);
    const lines = [svg.append("path").attr("class", "tline n").attr("d", ln("n")), svg.append("path").attr("class", "tline south").attr("d", ln("s"))];
    const a = pts[0], b = pts[pts.length - 1];
    [[a, 1], [b, -1]].forEach(([d, dir]) => {
      svg.append("line").attr("class", "gap-mark").attr("x1", x(d.yr) + dir * 6).attr("x2", x(d.yr) + dir * 6).attr("y1", y(d.n) + 4).attr("y2", y(d.s) - 4);
      svg.append("text").attr("class", "note").attr("x", x(d.yr) + dir * 12).attr("y", (y(d.n) + y(d.s)) / 2).attr("dy", "0.35em").attr("text-anchor", dir > 0 ? "start" : "end").text(`${fmt1(d.n - d.s)} pts`);
    });
    svg.append("text").attr("class", "lbl").attr("x", x(b.yr) + 8).attr("y", y(b.n)).attr("dy", "0.35em").text(`${fmt1(b.n)}% ${narrow ? "N & centre" : "North & centre"}`);
    svg.append("text").attr("class", "lbl").attr("x", x(b.yr) + 8).attr("y", y(b.s)).attr("dy", "0.35em").text(`${fmt1(b.s)}% ${narrow ? "South" : "South & islands"}`);
    const hit = svg.append("g").selectAll("rect").data(pts).join("rect").attr("class", "hit").attr("x", (d) => x(d.yr) - 12).attr("width", 24).attr("y", m.t).attr("height", H - m.t - m.b)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.yr}: north and centre ${fmt1(d.n)}%, south and islands ${fmt1(d.s)}%, gap ${fmt1(d.n - d.s)} points`);
    bindTip(hit, (d) => `<b>${d.yr}</b>North & centre ${fmt1(d.n)}%<br>South & islands ${fmt1(d.s)}%<br>gap ${fmt1(d.n - d.s)} points`);
    // the two lines are drawn year by year, the band fills in behind them
    onReveal(el, () => { lines.forEach((l) => l.attr("pathLength", 1).attr("stroke-dasharray", "1 1").attr("stroke-dashoffset", 1)); band.style("opacity", 0); }, () => {
      lines.forEach((l) => l.transition().duration(1100).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0).on("end", () => l.attr("stroke-dasharray", null).attr("pathLength", null)));
      band.transition().delay(700).duration(500).style("opacity", null);
    });
  }

  // ---------- constellation: one dot per museum, free ones at the centre ----------
  function constellation(mus) {
    const el = document.getElementById("bars-museums");
    const W = width(el), cols = W >= 1000 ? 5 : W >= 640 ? 4 : 2, gx = 16, gy = 22;
    const rows = mus.regions.slice().sort((a, b) => b.share_free - a.share_free).map((r) => ({ ...r, n: r.free + r.ticket, south: r.area === SOUTH }));
    const cw = (W - gx * (cols - 1)) / cols, stackHead = cw < 200, head = stackHead ? 62 : 44, Rmax = Math.min(cw / 2 - 8, 96);
    const maxN = d3.max(rows, (d) => d.n), c = Rmax / Math.sqrt(maxN + 0.5), dr = Math.max(1.4, c * 0.47);
    const ch = head + 2 * Rmax + 6, nRows = Math.ceil(rows.length / cols), H = nRows * ch + (nRows - 1) * gy;
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const g = svg.selectAll("g.cl").data(rows).join("g").attr("class", (d) => "cl" + (d.south ? " south" : "")).attr("data-region", (d) => d.region)
      .attr("transform", (d, i) => `translate(${(i % cols) * (cw + gx)},${Math.floor(i / cols) * (ch + gy)})`);
    g.append("rect").attr("class", "wbg").attr("width", cw).attr("height", ch).attr("rx", 8);
    g.append("text").attr("class", "tile-name").attr("x", 10).attr("y", 18).text((d) => short(d.region, cw < 200));
    g.append("text").attr("class", "tile-val").attr("x", 10).attr("y", 38).style("font-size", "17px").text((d) => `${Math.round(d.share_free)}% free`);
    g.append("text").attr("class", "tile-sub").attr("x", stackHead ? 10 : cw - 10).attr("y", stackHead ? 56 : 38).attr("text-anchor", stackHead ? "start" : "end").text((d) => `${d.n} museums`);
    const ox = cw / 2, oy = head + Rmax;
    const dots = g.selectAll("circle.cdot").data((d) => d3.range(d.n).map((i) => ({ i, free: i < d.free, d }))).join("circle")
      .attr("class", (p) => "cdot " + (p.free ? "free" : "tkt"))
      .attr("cx", (p) => ox + c * Math.sqrt(p.i + 0.5) * Math.cos(p.i * 2.39996323)).attr("cy", (p) => oy + c * Math.sqrt(p.i + 0.5) * Math.sin(p.i * 2.39996323))
      .attr("r", dr);
    const hit = g.append("rect").attr("class", "hit").attr("width", cw).attr("height", ch).attr("rx", 8).attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", (d) => `${d.region}: ${d.free} museums with free entry and ${d.ticket} with a ticket, ${Math.round(d.share_free)}% free`);
    bindTip(hit, (d) => `<b>${d.region}</b>${d.free} free, ${d.ticket} with a ticket (${Math.round(d.share_free)}% free)`, (d) => d.region);
    // each cluster grows from its centre outwards: the free museums first
    onReveal(el, () => dots.style("opacity", 0), () => {
      dots.transition().delay((p) => rows.indexOf(p.d) * 40 + Math.min(600, p.i * 3)).duration(200).style("opacity", null);
    });
  }

  // ---------- scatter: loans (log) vs reading ----------
  function scatter(loans, read) {
    const el = document.getElementById("scatter");
    const W = width(el), narrow = W < 520, H = narrow ? 340 : 420;
    const m = { l: 44, r: narrow ? 16 : 24, t: 16, b: 40 };
    const rmap = new Map(read.regions.map((r) => [r.region, r]));
    const pts = loans.regions.map((l) => ({ ...l, read: rmap.get(l.region).any }));
    const x = d3.scaleLog().domain([100, 12000]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([25, 55]).range([H - m.b, m.t]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const xt = [100, 300, 1000, 3000, 10000];
    svg.append("g").selectAll("line").data(xt).join("line").attr("class", "gridline").attr("x1", x).attr("x2", x).attr("y1", m.t).attr("y2", H - m.b);
    svg.append("g").selectAll("line").data(y.ticks(6)).join("line").attr("class", "gridline").attr("y1", y).attr("y2", y).attr("x1", m.l).attr("x2", W - m.r);
    svg.append("g").attr("transform", `translate(0,${H - m.b + 4})`).call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format(",")).tickSize(0)).call(cleanAxis);
    svg.append("g").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => v + "%").tickSize(0)).call((g) => { g.select(".domain").remove(); });
    svg.append("text").attr("class", "lbl-muted").attr("x", W - m.r).attr("y", H - 4).attr("text-anchor", "end").text("Loans per public library →");
    svg.append("text").attr("class", "lbl-muted").attr("x", m.l + 4).attr("y", m.t + 4).attr("dy", "0.7em").text("↑ Read at least one book");
    const label = new Set(["Campania", "Calabria", "Sicilia", "Emilia-Romagna", "Trentino-Alto Adige", "Lombardia", "Sardegna", "Molise", "Lazio", "Marche"]);
    const g = svg.append("g").selectAll("g").data(pts).join("g").attr("transform", (d) => `translate(${x(d.mean_public)},${y(d.read)})`)
      .attr("data-region", (d) => d.region);
    const dot = g.append("circle").attr("class", "dot").attr("r", 5.5).attr("fill", (d) => (d.area === SOUTH ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--surface)").attr("stroke-width", 2);
    // the regions settle into their line from the bottom-left corner, poorest-lending first
    onReveal(el, () => g.attr("transform", (d) => `translate(${x(d.mean_public)},${H - m.b})`).style("opacity", 0), () => {
      g.transition().delay((d) => (x(d.mean_public) - m.l) / (W - m.l) * 500).duration(650).ease(easeOut)
        .attr("transform", (d) => `translate(${x(d.mean_public)},${y(d.read)})`).style("opacity", null);
    });
    // labels for a chosen few; the others appear when their region is followed
    g.append("text").attr("class", (d) => "lbl" + (label.has(d.region) && !(narrow && ["Lazio", "Marche", "Lombardia"].includes(d.region)) ? "" : " lbl-onfocus"))
      .attr("x", (d) => (x(d.mean_public) > W - 140 ? -9 : 9)).attr("text-anchor", (d) => (x(d.mean_public) > W - 140 ? "end" : "start"))
      .attr("dy", (d) => (d.region === "Calabria" ? "-0.6em" : d.region === "Campania" ? "1.1em" : "0.35em")).style("font-size", "12px").text((d) => d.region);
    const hit = g.append("circle").attr("class", "hit").attr("r", 12).attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", (d) => `${d.region}: ${fmt(d.mean_public)} loans per public library, ${fmt1(d.read)}% read at least one book`);
    bindTip(hit, (d) => `<b>${d.region}</b>${fmt(d.mean_public)} loans per public library<br>${fmt1(d.read)}% read at least one book`, (d) => d.region);
  }

  // ---------- slope: readers in the first and last year ----------
  // spread labels that would overlap, keeping their order, inside [lo, hi]
  function dodge(items, gap, lo, hi) {
    const s = items.slice().sort((a, b) => a.y - b.y);
    for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
    if (s.length && s[s.length - 1].y > hi) { s[s.length - 1].y = hi; for (let i = s.length - 2; i >= 0; i--) if (s[i + 1].y - s[i].y < gap) s[i].y = s[i + 1].y - gap; }
    if (s.length && s[0].y < lo) { s[0].y = lo; for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap; }
    return items;
  }
  function slope(trend) {
    const el = document.getElementById("slope");
    const W = width(el), narrow = W < 600;
    const H = narrow ? 440 : 500, m = { t: 34, b: 14 };
    const first = trend.years[0], last = trend.years[trend.years.length - 1];
    const x0 = narrow ? 44 : 180, x1 = W - (narrow ? 150 : 180);
    const y = d3.scaleLinear().domain([22, 60]).range([H - m.b, m.t]);
    const rows = trend.regions.map((r) => ({ region: r.region, area: r.area, a: r.values[0], b: r.values[r.values.length - 1] }));
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    [[x0, first], [x1, last]].forEach(([x, t]) => {
      svg.append("line").attr("class", "gridline").attr("x1", x).attr("x2", x).attr("y1", m.t - 8).attr("y2", H - m.b);
      svg.append("text").attr("class", "note").attr("x", x).attr("y", 14).attr("text-anchor", "middle").text(t);
    });
    const la = dodge(rows.map((r) => ({ r, y: y(r.a) })), 13, m.t, H - m.b);
    const lb = dodge(rows.map((r) => ({ r, y: y(r.b) })), 13, m.t, H - m.b);
    const ya = new Map(la.map((d) => [d.r.region, d.y])), yb = new Map(lb.map((d) => [d.r.region, d.y]));
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("data-region", (d) => d.region);
    const col = (d) => (d.area === SOUTH ? "var(--accent)" : "var(--rest)");
    const line = g.append("line").attr("class", "slope-line").attr("x1", x0).attr("x2", x1).attr("y1", (d) => y(d.a)).attr("y2", (d) => y(d.b)).attr("stroke", col).attr("stroke-width", 1.5);
    g.append("circle").attr("class", "dot").attr("cx", x0).attr("cy", (d) => y(d.a)).attr("r", 3.5).attr("fill", col);
    const end = g.append("circle").attr("class", "dot").attr("cx", x1).attr("cy", (d) => y(d.b)).attr("r", 3.5).attr("fill", col);
    const right = g.append("text").attr("class", "lbl sl").attr("x", x1 + 10).attr("y", (d) => yb.get(d.region)).attr("dy", "0.35em")
      .text((d) => `${fmt1(d.b)}  ${short(d.region, narrow)}`);
    g.append("text").attr("class", "lbl sl").attr("x", x0 - 10).attr("y", (d) => ya.get(d.region)).attr("dy", "0.35em").attr("text-anchor", "end")
      .text((d) => (narrow ? fmt1(d.a) : `${short(d.region, narrow)}  ${fmt1(d.a)}`));
    // Italy on top of the regions, dashed
    const ia = trend.italy[0], ib = trend.italy[trend.italy.length - 1];
    const it = svg.append("line").attr("x1", x0).attr("x2", x1).attr("y1", y(ia)).attr("y2", y(ib)).attr("stroke", "var(--ink)").attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
    // ten years pass: every line leaves 2011 level and bends to where 2021 left it
    onReveal(el, () => { line.attr("y2", (d) => y(d.a)); end.attr("cy", (d) => y(d.a)); right.style("opacity", 0); it.attr("y2", y(ia)); }, () => {
      line.transition().duration(900).ease(d3.easeCubicInOut).attr("y2", (d) => y(d.b));
      end.transition().duration(900).ease(d3.easeCubicInOut).attr("cy", (d) => y(d.b));
      it.transition().duration(900).ease(d3.easeCubicInOut).attr("y2", y(ib));
      right.transition().delay(700).duration(320).style("opacity", null);
    });
    const hit = g.append("line").attr("class", "hit-line").attr("x1", x0).attr("x2", x1).attr("y1", (d) => y(d.a)).attr("y2", (d) => y(d.b))
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.region}: ${fmt1(d.a)}% in ${first}, ${fmt1(d.b)}% in ${last}, ${signed(d.b - d.a)} points`);
    bindTip(hit, (d) => `<b>${d.region}</b>${fmt1(d.a)}% in ${first} → ${fmt1(d.b)}% in ${last}<br>${signed(d.b - d.a)} points`, (d) => d.region);
  }

  // ---------- the north–south gap, year by year ----------
  function gapLine(trend) {
    const el = document.getElementById("gapline");
    const W = width(el), H = 200, m = { l: 36, r: 72, t: 24, b: 28 };
    const mean = (south, i) => d3.mean(trend.regions.filter((r) => (r.area === SOUTH) === south), (r) => r.values[i]);
    const pts = trend.years.map((yr, i) => ({ yr, gap: mean(false, i) - mean(true, i) }));
    const x = d3.scaleLinear().domain(d3.extent(trend.years)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 20]).range([H - m.b, m.t]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.append("g").selectAll("line").data(y.ticks(4)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("transform", `translate(0,${H - m.b + 4})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 6).tickFormat(d3.format("d")).tickSize(0)).call(cleanAxis);
    svg.append("g").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0)).call((g) => g.select(".domain").remove());
    const gp = svg.append("path").datum(pts).attr("fill", "none").attr("stroke", "var(--tab)").attr("stroke-width", 2.5).attr("stroke-linejoin", "round").attr("d", d3.line().x((d) => x(d.yr)).y((d) => y(d.gap)));
    // the line is drawn year by year, left to right
    onReveal(el, () => gp.attr("pathLength", 1).attr("stroke-dasharray", "1 1").attr("stroke-dashoffset", 1), () => {
      gp.transition().duration(1100).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0).on("end", () => gp.attr("stroke-dasharray", null).attr("pathLength", null));
    });
    [pts[0], pts[pts.length - 1]].forEach((d, i) => {
      svg.append("circle").attr("cx", x(d.yr)).attr("cy", y(d.gap)).attr("r", 4).attr("fill", "var(--ink)");
      svg.append("text").attr("class", "val").attr("x", x(d.yr) + (i ? 10 : 4)).attr("y", y(d.gap) + (i ? 0 : 20)).attr("dy", i ? "0.35em" : 0)
        .attr("text-anchor", "start").text(`${fmt1(d.gap)} pts`);
    });
    const hit = svg.append("g").selectAll("circle").data(pts).join("circle").attr("class", "hit").attr("cx", (d) => x(d.yr)).attr("cy", (d) => y(d.gap)).attr("r", 10)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.yr}: ${fmt1(d.gap)} points`);
    bindTip(hit, (d) => `<b>${d.yr}</b>North and centre ahead by ${fmt1(d.gap)} points`);
  }
})();
