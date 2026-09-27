/* Culture for All — data story charts (D3 v7). All data from data/story/*.json,
   built from the repository's own source files by scripts/build_story_data.py. */
(function () {
  "use strict";
  const fmt = d3.format(",");
  const fmt1 = d3.format(".1f");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const SOUTH = "South & islands";
  const fixName = (s) => s.replace("Forl�", "Forlì").replace("Vall�e", "Vallée");
  const tip = document.getElementById("tip");
  const SHORT = { "Trentino-Alto Adige": "Trentino-A. Adige", "Friuli-Venezia Giulia": "Friuli-V. Giulia" };
  const short = (l, narrow) => (narrow && SHORT[l]) || l;

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
  function bindTip(sel, html) {
    sel.on("mousemove", function (e, d) { showTip(html(d), e, this); })
      .on("mouseleave", hideTip)
      .on("focus", function (e, d) { showTip(html(d), e, this); })
      .on("blur", hideTip);
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
  // rows: [{label, value, hi(bool), tip}]  opts: {ref, refLabel, fmtV, max}
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
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${top + i * band})`);
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
    bindTip(hit, (d) => d.tip || `<b>${d.label}</b>${f(d.value)}`);
    if (opts.ref != null) {
      svg.append("line").attr("class", "ref").attr("x1", x(opts.ref)).attr("x2", x(opts.ref)).attr("y1", top - 6).attr("y2", top + rows.length * band);
      svg.append("text").attr("class", "lbl-muted").attr("x", x(opts.ref)).attr("y", top - 10)
        .attr("text-anchor", x(opts.ref) > W * 0.7 ? "end" : "start").attr("dx", x(opts.ref) > W * 0.7 ? -4 : 4).text(opts.refLabel);
    }
  }

  // ---------- ranked dot plot (optionally grouped by area) ----------
  // rows: [{label, value, area, hi}] ; opts: {groups:[...], ref, refLabel, domain, fmtV, notes:{label:text}}
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
    const g = svg.append("g").selectAll("g").data(layout.filter((l) => l.r)).join("g").attr("transform", (l) => `translate(0,${l.y})`);
    g.append("text").attr("class", "lbl").attr("x", labelW - 12).attr("dy", "0.35em").attr("text-anchor", "end").text((l) => short(l.r.label, narrow));
    g.append("line").attr("x1", labelW).attr("x2", (l) => x(l.r.value)).attr("stroke", "var(--grid)").attr("stroke-width", 1);
    g.append("circle").attr("class", "dot").attr("cx", (l) => x(l.r.value)).attr("r", 5)
      .attr("fill", (l) => (l.r.hi ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--paper)").attr("stroke-width", 2);
    g.append("text").attr("class", "val").attr("x", (l) => x(l.r.value) + 10).attr("dy", "0.35em")
      .text((l) => (opts.labelAll || l.r.hi || l.r.label in (opts.notes || {}) ? f(l.r.value) : ""));
    const hit = g.append("rect").attr("class", "hit").attr("x", 0).attr("y", -band / 2).attr("width", W).attr("height", band)
      .attr("tabindex", 0).attr("role", "img").attr("aria-label", (l) => `${l.r.label}: ${f(l.r.value)}`);
    bindTip(hit, (l) => l.r.tip || `<b>${l.r.label}</b>${f(l.r.value)}`);
  }

  // ---------- choropleth ----------
  function choropleth(id, rampId, geo, valueOf, thresholds, fmtT, tipOf) {
    const el = document.getElementById(id);
    const W = width(el), H = Math.round(W * 1.12);
    const colors = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map((v) => `var(${v})`);
    const q = d3.scaleThreshold().domain(thresholds).range(colors);
    const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[4, 4], [W - 4, H - 4]], geo);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const p = svg.append("g").selectAll("path").data(geo.features).join("path").attr("class", "prov").attr("d", path)
      .attr("fill", (f) => { const v = valueOf(f); return v == null ? "var(--na)" : q(v); });
    bindTip(p, tipOf);
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
    J("museums_entry.json"), J("municipalities.json"), J("library_points.json")])
    .then(([geo, lib, loans, read, mus, mun, pts]) => {
      const byKey = new Map(lib.provinces.map((p) => [p.key, p]));
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
          .map((r) => ({ label: r.region, value: r.per10k, area: r.area, hi: r.area === SOUTH,
            tip: `<b>${r.region}</b>${fmt1(r.per10k)} per 10,000 inhabitants<br>${fmt(r.libraries)} libraries (2012)` }));
        dots("dots-rate", rrows, { groups: areas, ref: lib.areas.ITALIA, refLabel: `Italy ${lib.areas.ITALIA}`, domain: [0, 5], labelAll: true });

        // 02 reach bars
        const reach = mun.regions.map((r) => ({ ...r, share: (100 * r.without_library) / r.municipalities }))
          .sort((a, b) => b.share - a.share);
        bars("bars-reach", reach.map((r) => ({ label: r.region, value: r.share, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${r.without_library} of ${r.municipalities} municipalities have no library (${Math.round(r.share)}%)` })),
        { fmtV: (v) => Math.round(v) + "%", tickFmt: (v) => v + "%", max: 60, ref: (100 * mun.without_library) / mun.municipalities, refLabel: "Italy 26%", band: 22 });

        // 03 loans
        const lrows = loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public);
        bars("bars-loans", lrows.map((r) => ({ label: r.region, value: r.mean_public, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${fmt(r.mean_public)} loans per public library<br>${fmt(r.total)} local loans in total, all libraries` })),
        { ref: loans.italy.mean_public, refLabel: "Italy 5,148", tickFmt: ",", max: 11000 });
        const urbanLbl = ["Cities", "Towns and suburbs", "Rural areas"];
        const innerLbl = ["Hub", "Inter-municipal hub", "Belt", "Intermediate", "Peripheral", "Ultra-peripheral"];
        bars("bars-urban", loans.urbanisation.map((r, i) => ({ label: urbanLbl[i], value: r.mean_public, hi: i === 2 })), { tickFmt: ",", max: 14000, labelW: 128 });
        bars("bars-inner", loans.classification.map((r, i) => ({ label: innerLbl[i], value: r.mean_public, hi: i >= 4 })), { tickFmt: ",", max: 14000, labelW: 128 });

        // 04 reading
        const rd = read.regions.slice().sort((a, b) => b.any - a.any);
        const rtip = (r) => `<b>${r.region}</b>${fmt1(r.any)}% read at least one book<br>${fmt1(r.twelve_plus)}% read 12 or more`;
        dots("dots-read-any", rd.map((r) => ({ label: r.region, value: r.any, hi: r.area === SOUTH, tip: rtip(r) })),
          { domain: [0, 60], ref: read.italy.any, refLabel: `Italy ${fmt1(read.italy.any)}%`, fmtV: (v) => fmt1(v) + "%", tickFmt: (v) => v + "%", labelAll: true });
        dots("dots-read-12", rd.map((r) => ({ label: r.region, value: r.twelve_plus, hi: r.area === SOUTH, tip: rtip(r) })),
          { domain: [0, 12], ref: read.italy.twelve_plus, refLabel: `Italy ${fmt1(read.italy.twelve_plus)}%`, fmtV: (v) => fmt1(v) + "%", tickFmt: (v) => v + "%", labelAll: true });
        scatter(loans, read);

        // 05 museums
        const mrows = mus.regions.slice().sort((a, b) => b.share_free - a.share_free);
        bars("bars-museums", mrows.map((r) => ({ label: r.region, value: r.share_free, hi: r.area === SOUTH,
          tip: `<b>${r.region}</b>${r.free} free, ${r.ticket} with a ticket (${Math.round(r.share_free)}% free)` })),
        { fmtV: (v) => Math.round(v) + "%", tickFmt: (v) => v + "%", max: 100, ref: (100 * mus.total_free) / (mus.total_free + mus.total_ticket), refLabel: "Italy 54%", band: 22 });

        dotmap.draw();
      };

      // tables (once)
      table("tbl-prov", [{ h: "Province", v: (d) => fixName(d.name) }, { h: "Libraries", v: (d) => d.libraries, f: fmt, num: 1 }, { h: "Per 10,000 inhabitants", v: (d) => d.per10k, f: fmt1, num: 1 }],
        lib.provinces.slice().sort((a, b) => b.per10k - a.per10k));
      table("tbl-rate", [{ h: "Region", v: (d) => d.region }, { h: "Area", v: (d) => d.area }, { h: "Libraries", v: (d) => d.libraries, f: fmt, num: 1 }, { h: "Per 10,000", v: (d) => d.per10k, f: fmt1, num: 1 }],
        lib.regions.slice().sort((a, b) => b.per10k - a.per10k));
      table("tbl-reach", [{ h: "Region", v: (d) => d.region }, { h: "Municipalities", v: (d) => d.municipalities, f: fmt, num: 1 }, { h: "With a library", v: (d) => d.with_library, f: fmt, num: 1 }, { h: "Without", v: (d) => d.without_library, f: fmt, num: 1 }, { h: "% without", v: (d) => (100 * d.without_library) / d.municipalities, f: (v) => v.toFixed(1), num: 1 }],
        mun.regions);
      table("tbl-loans", [{ h: "Region", v: (d) => d.region }, { h: "Per public library", v: (d) => d.mean_public, f: fmt, num: 1 }, { h: "Per library (all)", v: (d) => d.mean_all, f: fmt, num: 1 }, { h: "Total local loans", v: (d) => d.total, f: fmt, num: 1 }],
        loans.regions.slice().sort((a, b) => b.mean_public - a.mean_public));
      const uL = ["Cities (densely populated)", "Towns and suburbs", "Rural areas"], iL = ["Hub (polo)", "Inter-municipal hub", "Belt (cintura)", "Intermediate", "Peripheral", "Ultra-peripheral"];
      table("tbl-urban", [{ h: "Group", v: (d) => d.l }, { h: "Per public library", v: (d) => d.mean_public, f: fmt, num: 1 }, { h: "Per library (all)", v: (d) => d.mean_all, f: fmt, num: 1 }],
        [...loans.urbanisation.map((r, i) => ({ ...r, l: uL[i] })), ...loans.classification.map((r, i) => ({ ...r, l: iL[i] })),
          ...loans.macro.map((r) => ({ ...r, l: { "Nord-ovest": "North-west", "Nord-est": "North-east", Centro: "Centre", Sud: "South", Isole: "Islands" }[r.label] }))]);
      table("tbl-read", [{ h: "Region", v: (d) => d.region }, { h: "≥1 book", v: (d) => d.any, f: fmt1, num: 1 }, { h: "1–3 books", v: (d) => d.one_to_three, f: fmt1, num: 1 }, { h: "≥12 books", v: (d) => d.twelve_plus, f: fmt1, num: 1 }, { h: "Print only", v: (d) => d.print_only, f: fmt1, num: 1 }, { h: "Digital only", v: (d) => d.digital_only, f: fmt1, num: 1 }, { h: "Both", v: (d) => d.both, f: fmt1, num: 1 }],
        [...read.regions.slice().sort((a, b) => b.any - a.any), { region: "Italy", ...read.italy }]);
      table("tbl-museums", [{ h: "Region", v: (d) => d.region }, { h: "Free", v: (d) => d.free, num: 1 }, { h: "Ticket", v: (d) => d.ticket, num: 1 }, { h: "% free", v: (d) => d.share_free, f: fmt1, num: 1 }],
        mus.regions.slice().sort((a, b) => b.share_free - a.share_free));

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
          const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[4, 4], [W - 4, H - 4]], geo);
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

      draw();
      let tmo, lastW = window.innerWidth;
      window.addEventListener("resize", () => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth; clearTimeout(tmo); tmo = setTimeout(draw, 150);
      });
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => dotmap.draw());
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
    const g = svg.append("g").selectAll("g").data(pts).join("g").attr("transform", (d) => `translate(${x(d.mean_public)},${y(d.read)})`);
    g.append("circle").attr("r", 5).attr("fill", (d) => (d.area === SOUTH ? "var(--accent)" : "var(--rest)")).attr("stroke", "var(--paper)").attr("stroke-width", 2);
    g.filter((d) => label.has(d.region) && !(narrow && ["Lazio", "Marche", "Lombardia"].includes(d.region))).append("text").attr("class", "lbl")
      .attr("x", (d) => (x(d.mean_public) > W - 140 ? -9 : 9)).attr("text-anchor", (d) => (x(d.mean_public) > W - 140 ? "end" : "start"))
      .attr("dy", (d) => (d.region === "Calabria" ? "-0.6em" : d.region === "Campania" ? "1.1em" : "0.35em")).style("font-size", "12px").text((d) => d.region);
    const hit = g.append("circle").attr("class", "hit").attr("r", 12).attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", (d) => `${d.region}: ${fmt(d.mean_public)} loans per public library, ${fmt1(d.read)}% read at least one book`);
    bindTip(hit, (d) => `<b>${d.region}</b>${fmt(d.mean_public)} loans per public library<br>${fmt1(d.read)}% read at least one book`);
  }
})();
