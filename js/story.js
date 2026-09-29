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

  // ---------- horizontal ranked bars ----------
  // rows: [{label, value, hi(bool), tip, region}]  opts: {ref, refLabel, fmtV, max}
  function bars(id, rows, opts = {}) {
    const el = document.getElementById(id);
    const W = width(el);
    const narrow = W < 520;
    const labelW = opts.labelW || (narrow ? 118 : 170);
    const valW = 58;
    const band = opts.band || 26, barH = Math.min(18, band - 8);
    const top = opts.ref != null ? 22 : 6, H = top + rows.length * band + 26;
    const x = d3.scaleLinear().domain([0, opts.max || d3.max(rows, (d) => d.value)]).nice().range([labelW, W - valW]);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const f = opts.fmtV || fmt;
    svg.append("g").attr("transform", `translate(0,${top + rows.length * band + 2})`)
      .call((() => { const a = d3.axisBottom(x).ticks(narrow ? 3 : 5).tickSize(4);
        const tf = opts.tickFmt || "~s"; return typeof tf === "function" ? a.tickFormat(tf) : a.tickFormat(d3.format(tf)); })())
      .call((g) => g.select(".domain").remove());
    svg.append("g").selectAll("line").data(x.ticks(narrow ? 3 : 5)).join("line").attr("class", "gridline")
      .attr("x1", x).attr("x2", x).attr("y1", top - 4).attr("y2", top + rows.length * band);
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${top + i * band})`)
      .attr("data-region", (d) => d.region || null);
    g.append("text").attr("class", "lbl").attr("x", labelW - 10).attr("y", band / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text((d) => short(d.label, narrow));
    // bar with 4px rounded data end, square at baseline
    g.append("path").attr("class", "bar").attr("fill", (d) => (d.hi ? "var(--accent)" : "var(--rest)"))
      .attr("d", (d) => {
        const x0 = x(0), x1 = Math.max(x0 + 1, x(d.value)), y0 = (band - barH) / 2, r = Math.min(4, (x1 - x0) / 2);
        return `M${x0},${y0}H${x1 - r}Q${x1},${y0} ${x1},${y0 + r}V${y0 + barH - r}Q${x1},${y0 + barH} ${x1 - r},${y0 + barH}H${x0}Z`;
      });
    g.append("text").attr("class", "val").attr("x", (d) => x(d.value) + 6).attr("y", band / 2).attr("dy", "0.35em").text((d) => f(d.value));
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (d) => `${d.label}: ${f(d.value)}`);
    bindTip(hit, (d) => d.tip || `<b>${d.label}</b>${f(d.value)}`, (d) => d.region || null);
    if (opts.ref != null) {
      svg.append("line").attr("class", "ref").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", top - 6).attr("y2", top + rows.length * band);
      svg.append("text").attr("class", "lbl-muted").attr("x", x(opts.ref)).attr("y", top - 10)
        .attr("text-anchor", x(opts.ref) > W * 0.7 ? "end" : "start").attr("dx", x(opts.ref) > W * 0.7 ? -4 : 4).text(opts.refLabel);
    }
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
    svg.append("g").attr("transform", `translate(0,${H - 22})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(4).tickFormat(opts.tickFmt || null))
      .call((g) => g.select(".domain").remove());
    if (opts.ref != null) {
      svg.append("line").attr("class", "ref").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", 14).attr("y2", H - 24);
      svg.append("text").attr("class", "lbl-muted").attr("x", x(opts.ref) + 4).attr("y", 12).text(opts.refLabel);
    }
    const f = opts.fmtV || fmt1;
    layout.filter((l) => l.head).forEach((l) => {
      svg.append("text").attr("class", "note").attr("x", 0).attr("y", l.y).text(l.head);
      svg.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", W).attr("y1", l.y + 8).attr("y2", l.y + 8).style("stroke", "var(--rule)");
    });
    const g = svg.append("g").selectAll("g").data(layout.filter((l) => l.r)).join("g").attr("transform", (l) => `translate(0,${l.y})`)
      .attr("data-region", (l) => l.r.region || null);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("dy", "0.35em").attr("text-anchor", "end").text((l) => short(l.r.label, narrow));
    g.append("line").attr("class", "stem").attr("x1", labelW).attr("x2", (l) => x(l.r.value)).attr("stroke", "var(--grid)").attr("stroke-width", 1);
    g.append("circle").attr("class", "dot").attr("cx", (l) => x(l.r.value)).attr("r", 5)
      .attr("fill", (l) => (l.r.hi ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--paper)").attr("stroke-width", 2);
    g.append("text").attr("class", "val").attr("x", (l) => x(l.r.value) + 10).attr("dy", "0.35em")
      .text((l) => (opts.labelAll || l.r.hi || l.r.label in (opts.notes || {}) ? f(l.r.value) : ""));
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", -band / 2).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (l) => `${l.r.label}: ${f(l.r.value)}`);
    bindTip(hit, (l) => l.r.tip || `<b>${l.r.label}</b>${f(l.r.value)}`, (l) => l.r.region || null);
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
    J("distance.json"), J("events.json")])
    .then(([geo, lib, loans, read, mus, mun, pts, trend, dist, events]) => {
      const byKey = new Map(lib.provinces.map((p) => [p.key, p]));
      const italyEvents = (100000 * events.matched_events) / d3.sum(events.regions, (r) => r.residents);
      const draw = () => {
        // 01 maps
        const tipP = (f) => {
          const d = byKey.get(f.properties.key);
          const nm = fixName(f.properties.name);
          return d ? `<b>${nm}</b>${fmt(d.libraries)} libraries<br>${fmt1(d.per10k)} per 10,000 inhabitants` : `<b>${nm}</b>No 2012 value (province created 2016)`;
        };
        choropleth("map-count", "ramp-count", geo, (f) => byKey.get(f.properties.key)?.libraries, [50, 100, 150, 250, 400], fmt, tipP);
        choropleth("map-rate", "ramp-rate", geo, (f) => byKey.get(f.properties.key)?.per10k, [1.5, 2, 2.5, 3, 4], (v) => v.toFixed(1), tipP);

        // 01 regions dot plot, grouped
        const areas = ["North", "Centre", SOUTH];
        const rrows = lib.regions.slice().sort((a, b) => b.per10k - a.per10k)
          .map((r) => ({ label: r.region, region: r.region, value: r.per10k, area: r.area, hi: r.area === SOUTH,
            tip: `<b>${r.region}</b>${fmt1(r.per10k)} per 10,000 inhabitants<br>${fmt(r.libraries)} libraries (2012)` }));
        dots("dots-rate", rrows, { groups: areas, ref: lib.areas.ITALIA, refLabel: `Italy ${lib.areas.ITALIA}`, domain: [0, 5], labelAll: true });

        // 02 reach bars
        const reach = mun.regions.map((r) => ({ ...r, share: (100 * r.without_library) / r.municipalities }))
          .sort((a, b) => b.share - a.share);
        bars("bars-reach", reach.map((r) => ({ label: r.region, region: r.region, value: r.share, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${r.without_library} of ${r.municipalities} municipalities have no library (${Math.round(r.share)}%)` })),
        { fmtV: (v) => Math.round(v) + "%", tickFmt: (v) => v + "%", max: 60, ref: (100 * mun.without_library) / mun.municipalities, refLabel: "Italy 26%", band: 22 });

        // 02 distance
        distMap.draw();
        const bandLbl = ["Under 2 km", "2–5 km", "5–10 km", "10–20 km", "20 km or more"];
        bars("bars-dist", dist.bands.map((b, i) => ({ label: bandLbl[i], value: b.residents, hi: false,
          tip: `<b>${bandLbl[i]}</b>${fmt(b.residents)} residents in ${fmt(b.municipalities)} municipalities` })),
        { tickFmt: "~s", labelW: 112, fmtV: d3.format(".2~s") });

        // 03 loans
        const lrows = loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public);
        bars("bars-loans", lrows.map((r) => ({ label: r.region, region: r.region, value: r.mean_public, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${fmt(r.mean_public)} loans per public library<br>${fmt(r.total)} local loans in total, all libraries` })),
        { ref: loans.italy.mean_public, refLabel: "Italy 5,148", tickFmt: ",", max: 11000 });
        const urbanLbl = ["Cities", "Towns and suburbs", "Rural areas"];
        const innerLbl = ["Hub", "Inter-municipal hub", "Belt", "Intermediate", "Peripheral", "Ultra-peripheral"];
        bars("bars-urban", loans.urbanisation.map((r, i) => ({ label: urbanLbl[i], value: r.mean_public, hi: i === 2 })), { tickFmt: ",", max: 14000, labelW: 128 });
        bars("bars-inner", loans.classification.map((r, i) => ({ label: innerLbl[i], value: r.mean_public, hi: i >= 4 })), { tickFmt: ",", max: 14000, labelW: 128 });

        // 04 reading
        const rd = read.regions.slice().sort((a, b) => b.any - a.any);
        const rtip = (r) => `<b>${r.region}</b>${fmt1(r.any)}% read at least one book<br>${fmt1(r.twelve_plus)}% read 12 or more`;
        dots("dots-read-any", rd.map((r) => ({ label: r.region, region: r.region, value: r.any, hi: r.area === SOUTH, tip: rtip(r) })),
          { domain: [0, 60], ref: read.italy.any, refLabel: `Italy ${fmt1(read.italy.any)}%`, fmtV: (v) => fmt1(v) + "%", tickFmt: (v) => v + "%", labelAll: true });
        dots("dots-read-12", rd.map((r) => ({ label: r.region, region: r.region, value: r.twelve_plus, hi: r.area === SOUTH, tip: rtip(r) })),
          { domain: [0, 12], ref: read.italy.twelve_plus, refLabel: `Italy ${fmt1(read.italy.twelve_plus)}%`, fmtV: (v) => fmt1(v) + "%", tickFmt: (v) => v + "%", labelAll: true });
        scatter(loans, read);

        // 05 time
        slope(trend);
        gapLine(trend);

        // 06 museums
        const mrows = mus.regions.slice().sort((a, b) => b.share_free - a.share_free);
        bars("bars-museums", mrows.map((r) => ({ label: r.region, region: r.region, value: r.share_free, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${r.free} free, ${r.ticket} with a ticket (${Math.round(r.share_free)}% free)` })),
        { fmtV: (v) => Math.round(v) + "%", tickFmt: (v) => v + "%", max: 100, ref: (100 * mus.total_free) / (mus.total_free + mus.total_ticket), refLabel: "Italy 54%", band: 22 });

        // 07 events
        const erows = events.regions.slice().sort((a, b) => b.per100k - a.per100k);
        bars("bars-events", erows.map((r) => ({ label: r.region, region: r.region, value: r.per100k, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${fmt(r.events)} events published<br>${fmt1(r.per100k)} per 100,000 residents` })),
        { fmtV: (v) => fmt(Math.round(v)), tickFmt: ",", max: 240, ref: italyEvents, refLabel: `Italy ${Math.round(italyEvents)}`, band: 22 });

        dotmap.draw();
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
        draw() {
          const el = document.getElementById("dotmap");
          const W = width(el), H = Math.round(W * 1.12), dpr = window.devicePixelRatio || 1;
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
          ctx.fillStyle = css("--accent");
          const n = s.data.length / 2, r = current === "archives" ? 3 : Math.max(0.9, W / 520);
          ctx.globalAlpha = current === "archives" ? 1 : 0.55;
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
        if (s.data) return dotmap.draw();
        document.getElementById("dotmap-count").textContent = "Loading…";
        d3.json(s.src).then((rows) => {
          s.data = rows.filter((r) => r[s.lat] && r[s.lon]).flatMap((r) => [+r[s.lon], +r[s.lat]]);
          dotmap.draw();
        });
      }));

      // ---------- distance map (canvas): one dot per municipality without a library ----------
      const DIST_EDGES = [2, 5, 10, 20];
      const DIST_COLS = ["--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"];
      const distColor = (km) => DIST_COLS[d3.bisectRight(DIST_EDGES, km)];
      const distMap = {
        el: document.getElementById("map-dist"),
        draw() {
          const el = this.el, W = width(el), H = Math.round(W * 1.12), dpr = window.devicePixelRatio || 1;
          el.innerHTML = "";
          const c = document.createElement("canvas");
          c.className = "map-canvas"; c.width = W * dpr; c.height = H * dpr; c.style.height = H + "px";
          el.appendChild(c);
          this.ctx = c.getContext("2d"); this.ctx.scale(dpr, dpr);
          this.W = W; this.H = H;
          this.proj = italyProj(geo, W, H);
          this.pts = dist.municipalities.map((m) => { const p = this.proj([m.lon, m.lat]); return { m, x: p[0], y: p[1] }; })
            .sort((a, b) => a.m.km - b.m.km); // far places drawn last, so the rare long distances are never hidden
          this.qt = d3.quadtree(this.pts, (d) => d.x, (d) => d.y);
          c.addEventListener("mousemove", (e) => {
            const r = c.getBoundingClientRect();
            const hit = this.qt.find(e.clientX - r.left, e.clientY - r.top, 8);
            if (!hit) { hideTip(); hoverRegion(null); return; }
            const m = hit.m;
            showTip(`<b>${m.name}</b>${m.region}<br>${fmt1(m.km)} km to the nearest library<br>${fmt(m.pop)} residents`, e, c);
            hoverRegion(m.region);
          });
          c.addEventListener("mouseleave", () => { hideTip(); hoverRegion(null); });
          this.paint(focus.hover || focus.pinned);
        },
        paint(region) {
          const { ctx, W, H, proj } = this;
          if (!ctx) return;
          ctx.clearRect(0, 0, W, H);
          const path = d3.geoPath(proj, ctx);
          ctx.fillStyle = css("--na"); ctx.beginPath(); path(geo); ctx.fill();
          ctx.strokeStyle = css("--surface"); ctx.lineWidth = 0.6; ctx.stroke();
          const r = Math.max(1.6, W / 260);
          const colors = Object.fromEntries(DIST_COLS.map((v) => [v, css(v)]));
          this.pts.forEach(({ m, x, y }) => {
            ctx.globalAlpha = region && m.region !== region ? 0.15 : 1;
            ctx.fillStyle = colors[distColor(m.km)];
            ctx.beginPath(); ctx.arc(x, y, m.km >= 10 ? r + 1 : r, 0, 6.2832); ctx.fill();
          });
          ctx.globalAlpha = 1;
          const n = region ? dist.municipalities.filter((m) => m.region === region).length : dist.municipalities.length;
          this.el.setAttribute("aria-label", `Map of the ${fmt(n)} municipalities${region ? " in " + region : ""} with no library, coloured by distance to the nearest library. The full list is in the data table.`);
        },
      };
      focusHooks.push((r) => distMap.paint(r));
      const dramp = d3.select("#ramp-dist").html("");
      ["Under 2 km", "2–5", "5–10", "10–20", "20 km +"].forEach((t, i) => {
        const cell = dramp.append("div");
        cell.append("span").style("background", `var(${DIST_COLS[i]})`);
        cell.append("div").text(t);
      });

      // ---------- follow a region: profile, deep link, share image ----------
      const readChange = new Map(trend.regions.map((r) => [r.region, r.values[r.values.length - 1] - r.values[0]]));
      const M = (arr, v) => new Map(arr.map((r) => [r.region, v(r)]));
      const measures = [
        { label: "Libraries per 10,000 inhabitants", year: "2012", values: M(lib.regions, (r) => r.per10k), italy: lib.areas.ITALIA, f: fmt1, anchor: "#fig-rate-regions" },
        { label: "Municipalities with no library", year: "2022", values: M(mun.regions, (r) => (100 * r.without_library) / r.municipalities), italy: (100 * mun.without_library) / mun.municipalities, f: (v) => Math.round(v) + "%", anchor: "#fig-reach" },
        { label: "Loans per public library", year: "2022", values: M(loans.regions, (r) => r.mean_public), italy: loans.italy.mean_public, f: fmt, anchor: "#fig-loans" },
        { label: "Read at least one book", year: "2021", values: M(read.regions, (r) => r.any), italy: read.italy.any, f: (v) => fmt1(v) + "%", anchor: "#fig-read" },
        { label: "Change in readers", year: "2011–2021, points", values: readChange, italy: trend.italy[trend.italy.length - 1] - trend.italy[0], f: signed, anchor: "#fig-slope" },
        { label: "Museums with free entry", year: "share of museums", values: M(mus.regions, (r) => r.share_free), italy: (100 * mus.total_free) / (mus.total_free + mus.total_ticket), f: (v) => Math.round(v) + "%", anchor: "#fig-museums" },
        { label: "Ministry events per 100,000", year: "residents", values: M(events.regions, (r) => r.per100k), italy: italyEvents, f: (v) => fmt(Math.round(v)), anchor: "#fig-events" },
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
        const it = m.italy >= m.min && m.italy <= m.max ? `<line x1="${x(m.italy)}" x2="${x(m.italy)}" y1="1" y2="${h - 1}" stroke="var(--ink)" stroke-width="1.5"/>` : "";
        const me = `<circle cx="${x(m.values.get(region))}" cy="${h / 2}" r="6" fill="var(--accent)" stroke="var(--paper)" stroke-width="2"/>`;
        return `<svg class="pf-strip" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${ticks}${it}${me}</svg>`;
      }
      function renderProfile(region) {
        pill.hidden = !region;
        shareBtn.hidden = !region;
        if (!region) {
          profile.innerHTML = `<p class="pf-empty">Choose a region to see where it stands on each measure. It stays highlighted in every chart below until you clear it.</p>`;
          return;
        }
        pill.querySelector(".pill-name").textContent = region;
        profile.innerHTML = `<ol class="pf">${measures.map((m) => {
          const v = m.values.get(region), rk = m.rank.get(region);
          return `<li><a href="${m.anchor}"><span class="pf-name">${m.label}<span class="pf-year">${m.year}</span></span>${strip(m, region)}<span class="pf-val"><b>${m.f(v)}</b><span>${ordinal(rk)} highest of 20 · Italy ${m.f(m.italy)}</span></span></a></li>`;
        }).join("")}</ol><p class="pf-key"><span><i class="k-me"></i>${region}</span><span><i class="k-other"></i>the other regions</span><span><i class="k-it"></i>Italy</span><span>lowest at left, highest at right</span></p>`;
      }
      function follow(region, push = true) {
        focus.pinned = region || null;
        select.value = region || "";
        renderProfile(focus.pinned);
        applyFocus();
        if (push) {
          const u = new URL(location.href);
          if (region) u.searchParams.set("region", region); else u.searchParams.delete("region");
          history.replaceState(null, "", u);
        }
      }
      select.addEventListener("change", () => follow(select.value));
      pill.querySelector("button").addEventListener("click", () => { follow(null); select.focus(); });

      shareBtn.addEventListener("click", async () => {
        const region = focus.pinned;
        if (!region) return;
        try { await Promise.all([document.fonts.load('600 40px "Instrument Sans"'), document.fonts.load('400 20px "Instrument Sans"')]); } catch (e) { /* system font */ }
        const W = 1200, H = 630, c = document.createElement("canvas");
        c.width = W; c.height = H;
        const x = c.getContext("2d");
        const F = (w, s) => `${w} ${s}px "Instrument Sans", system-ui, sans-serif`;
        x.fillStyle = "#f6f5f1"; x.fillRect(0, 0, W, H);
        x.fillStyle = "#1f3fd1"; x.fillRect(0, 0, W, 10);
        x.fillStyle = "#4f4e49"; x.font = F(600, 17); x.fillText("CULTURE FOR ALL · ACCESS TO CULTURE ACROSS ITALY'S REGIONS", 64, 66);
        x.fillStyle = "#151613"; x.font = F(600, 50); x.fillText(`Where ${region} stands`, 64, 126);
        const top = 196, rowH = 52, sx = 600, sw = 280;
        measures.forEach((m, i) => {
          const y = top + i * rowH;
          x.strokeStyle = "#d9d7cf"; x.lineWidth = 1; x.beginPath(); x.moveTo(64, y - 32); x.lineTo(W - 64, y - 32); x.stroke();
          x.fillStyle = "#151613"; x.font = F(500, 20); x.fillText(m.label, 64, y);
          const lw = x.measureText(m.label).width;
          x.fillStyle = "#6b6963"; x.font = F(400, 15); x.fillText(m.year, 64 + lw + 10, y);
          const sc = d3.scaleLinear().domain([m.min, m.max]).range([sx + 8, sx + sw - 8]);
          x.strokeStyle = "#85827a"; x.lineWidth = 2;
          m.values.forEach((v, r) => { if (r !== region) { x.beginPath(); x.moveTo(sc(v), y - 18); x.lineTo(sc(v), y + 2); x.stroke(); } });
          if (m.italy >= m.min && m.italy <= m.max) { x.strokeStyle = "#151613"; x.lineWidth = 2; x.beginPath(); x.moveTo(sc(m.italy), y - 23); x.lineTo(sc(m.italy), y + 7); x.stroke(); }
          x.fillStyle = "#1f3fd1"; x.strokeStyle = "#f6f5f1"; x.lineWidth = 3;
          x.beginPath(); x.arc(sc(m.values.get(region)), y - 8, 9, 0, 6.2832); x.fill(); x.stroke();
          x.textAlign = "right";
          x.fillStyle = "#151613"; x.font = F(600, 22); x.fillText(m.f(m.values.get(region)), W - 176, y);
          x.fillStyle = "#4f4e49"; x.font = F(400, 16); x.fillText(`${ordinal(m.rank.get(region))} of 20`, W - 64, y);
          x.textAlign = "left";
        });
        x.fillStyle = "#6b6963"; x.font = F(400, 15);
        x.fillText(`Blue: ${region} · grey: the other 19 regions · black: Italy`, 64, H - 30);
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
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { dotmap.draw(); distMap.draw(); });
    })
    .catch((err) => { console.error("Could not load story data", err); });

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
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format(",")).tickSize(4)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => v + "%").tickSize(4)).call((g) => g.select(".domain").remove());
    svg.append("text").attr("class", "lbl-muted").attr("x", W - m.r).attr("y", H - 6).attr("text-anchor", "end").text("Loans per public library →");
    svg.append("text").attr("class", "lbl-muted").attr("x", m.l + 4).attr("y", m.t + 4).attr("dy", "0.7em").text("↑ Read at least one book");
    const label = new Set(["Campania", "Calabria", "Sicilia", "Emilia-Romagna", "Trentino-Alto Adige", "Lombardia", "Sardegna", "Molise", "Lazio", "Marche"]);
    const g = svg.append("g").selectAll("g").data(pts).join("g").attr("transform", (d) => `translate(${x(d.mean_public)},${y(d.read)})`)
      .attr("data-region", (d) => d.region);
    g.append("circle").attr("class", "dot").attr("r", 5).attr("fill", (d) => (d.area === SOUTH ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--paper)").attr("stroke-width", 2);
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
    g.append("line").attr("class", "slope-line").attr("x1", x0).attr("x2", x1).attr("y1", (d) => y(d.a)).attr("y2", (d) => y(d.b)).attr("stroke", col).attr("stroke-width", 1.5);
    g.append("circle").attr("class", "dot").attr("cx", x0).attr("cy", (d) => y(d.a)).attr("r", 3.5).attr("fill", col);
    g.append("circle").attr("class", "dot").attr("cx", x1).attr("cy", (d) => y(d.b)).attr("r", 3.5).attr("fill", col);
    g.append("text").attr("class", "lbl sl").attr("x", x1 + 10).attr("y", (d) => yb.get(d.region)).attr("dy", "0.35em")
      .text((d) => `${fmt1(d.b)}  ${short(d.region, narrow)}`);
    g.append("text").attr("class", "lbl sl").attr("x", x0 - 10).attr("y", (d) => ya.get(d.region)).attr("dy", "0.35em").attr("text-anchor", "end")
      .text((d) => (narrow ? fmt1(d.a) : `${short(d.region, narrow)}  ${fmt1(d.a)}`));
    // Italy on top of the regions, dashed
    const ia = trend.italy[0], ib = trend.italy[trend.italy.length - 1];
    svg.append("line").attr("x1", x0).attr("x2", x1).attr("y1", y(ia)).attr("y2", y(ib)).attr("stroke", "var(--ink)").attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
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
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 6).tickFormat(d3.format("d")).tickSize(4)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(4)).call((g) => g.select(".domain").remove());
    svg.append("path").datum(pts).attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 2).attr("d", d3.line().x((d) => x(d.yr)).y((d) => y(d.gap)));
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
