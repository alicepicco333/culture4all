/* Culture for All: "Your place". A profile card for a region or province, every measure
   next to the Italian figure and its rank, optionally compared with a second place.
   Deep links: #region=Sicilia, #province=Palermo, add &vs=Lazio to compare. */
(function () {
  "use strict";
  const { fmt, fmt1, bindTip, reduced } = window.C4A;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const J = (f) => d3.json("data/story/" + f);
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const pct = (v) => fmt1(v) + "%";
  const KEYS = ["k-lib", "k-mus", "k-arc", "k-oth"];

  Promise.all([J("places.json"), J("libraries_2012.json"), J("municipalities.json"), J("loans_2022.json"), J("reading_2021.json"), J("museums_entry.json")])
    .then(([pl, lib, mun, loans, read, mus]) => {
      const regions = pl.regions.map((r) => r.region);
      const provinces = pl.provinces.slice().sort((a, b) => a.name.localeCompare(b.name, "it"));
      const byReg = (arr, k = "region") => new Map(arr.map((r) => [r[k], r]));
      const R = { pl: byReg(pl.regions), lib: byReg(lib.regions), mun: byReg(mun.regions), loans: byReg(loans.regions), read: byReg(read.regions), mus: byReg(mus.regions) };
      const P = byReg(pl.provinces, "name");

      // ---- measures: values for every unit at that level, the Italian figure, how to read the rank
      const M = {
        rate: { label: "Libraries per 10,000 inhabitants", def: "ISTAT, 2012", f: fmt1,
          region: new Map(regions.map((r) => [r, R.lib.get(r)?.per10k])), province: new Map(provinces.map((p) => [p.name, p.per10k2012])), italy: lib.areas.ITALIA },
        without: { label: "Municipalities without a library", def: "Share of municipalities, 2022 register (computed)", f: pct, higherWorse: true,
          region: new Map(regions.map((r) => { const m = R.mun.get(r); return [r, (100 * m.without_library) / m.municipalities]; })),
          province: new Map(provinces.map((p) => [p.name, (100 * (p.municipalities - p.with_library)) / p.municipalities])),
          italy: (100 * mun.without_library) / mun.municipalities,
          extra: (kind, name) => { const m = kind === "region" ? R.mun.get(name) : P.get(name); const w = kind === "region" ? m.without_library : m.municipalities - m.with_library; return `${fmt(w)} of ${fmt(m.municipalities)}`; } },
        loans: { label: "Local loans per public library", def: "ISTAT, 2022", f: fmt, regionOnly: true,
          region: new Map(regions.map((r) => [r, R.loans.get(r)?.mean_public])), italy: loans.italy.mean_public },
        readAny: { label: "People who read at least one book", def: "ISTAT, 2021, aged 6+", f: pct, regionOnly: true,
          region: new Map(regions.map((r) => [r, R.read.get(r)?.any])), italy: read.italy.any },
        read12: { label: "People who read 12 books or more", def: "ISTAT, 2021, aged 6+", f: pct, regionOnly: true,
          region: new Map(regions.map((r) => [r, R.read.get(r)?.twelve_plus])), italy: read.italy.twelve_plus },
        free: { label: "Museums with free entry", def: "Share of museums stating entry, dati.cultura", f: (v) => Math.round(v) + "%", regionOnly: true,
          region: new Map(regions.map((r) => [r, R.mus.get(r)?.share_free])), italy: (100 * mus.total_free) / (mus.total_free + mus.total_ticket),
          extra: (kind, name) => { const m = R.mus.get(name); return m ? `${fmt(m.free)} free, ${fmt(m.ticket)} with a ticket` : ""; } },
      };
      const regionOf = (kind, name) => (kind === "region" ? name : P.get(name)?.region);

      // ---- selects
      const optHtml = (withNone) => (withNone ? `<option value="">No comparison</option>` : "")
        + `<optgroup label="Regions">${regions.map((r) => `<option value="region:${esc(r)}">${esc(r)}</option>`).join("")}</optgroup>`
        + `<optgroup label="Provinces">${provinces.map((p) => `<option value="province:${esc(p.name)}">${esc(p.name)} (${esc(p.region)})</option>`).join("")}</optgroup>`;
      const selA = $("pl-a"), selB = $("pl-b"), hero = $("hero-place");
      selA.innerHTML = optHtml(false);
      hero.innerHTML = `<option value="">Choose a place…</option>` + optHtml(false);
      function fillB(kind, keep) {
        const list = kind === "region" ? regions : provinces.map((p) => p.name);
        selB.innerHTML = `<option value="">No comparison</option>` + list.map((n) => `<option value="${kind}:${esc(n)}">${esc(n)}</option>`).join("");
        selB.value = keep && list.includes(keep) ? `${kind}:${keep}` : "";
      }

      const parse = (v) => { const i = v.indexOf(":"); return i < 0 ? null : { kind: v.slice(0, i), name: v.slice(i + 1) }; };
      function hashFor(a, b) { return `#${a.kind}=${encodeURIComponent(a.name)}${b ? "&vs=" + encodeURIComponent(b.name) : ""}`; }
      function readHash() {
        const h = location.hash.slice(1); if (!/^(region|province)=/.test(h)) return null;
        const q = new URLSearchParams(h);
        const kind = q.has("region") ? "region" : "province", name = q.get(kind);
        const ok = kind === "region" ? regions.includes(name) : P.has(name);
        if (!ok) return null;
        const vs = q.get("vs");
        const okB = vs && (kind === "region" ? regions.includes(vs) : P.has(vs)) && vs !== name;
        return { a: { kind, name }, b: okB ? { kind, name: vs } : null };
      }

      // ---- strip plot: every unit as a small dot, Italy as a line, the chosen place(s) emphasised
      function strip(el, values, italy, a, b, f, names) {
        const W = Math.max(240, el.clientWidth), H = 46, m = { l: 8, r: 8 };
        const vals = [...values.values()].filter((v) => v != null);
        const ext = d3.extent([...vals, italy]);
        const pad = (ext[1] - ext[0]) * 0.04 || 1;
        const x = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([m.l, W - m.r]);
        const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
        svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", 18).attr("y2", 18).attr("stroke", "var(--grid)");
        svg.append("line").attr("class", "ref").attr("x1", x(italy)).attr("x2", x(italy)).attr("y1", 6).attr("y2", 30);
        const rows = [...values.entries()].filter(([, v]) => v != null).map(([n, v]) => ({ n, v }));
        const g = svg.append("g");
        g.selectAll("circle").data(rows.filter((d) => d.n !== a && d.n !== b)).join("circle")
          .attr("cx", (d) => x(d.v)).attr("cy", 18).attr("r", 3.5).attr("fill", "var(--rest)").attr("fill-opacity", 0.75);
        [[b, "var(--vs)"], [a, "var(--hi)"]].forEach(([n, c]) => {
          if (n == null || values.get(n) == null) return;
          svg.append("circle").attr("cx", x(values.get(n))).attr("cy", 18).attr("r", 6.5).attr("fill", c).attr("stroke", "var(--surface)").attr("stroke-width", 2);
        });
        svg.append("text").attr("x", m.l).attr("y", 43).attr("class", "lbl-muted").text(`${f(ext[0])} lowest`);
        svg.append("text").attr("x", W - m.r).attr("y", 43).attr("text-anchor", "end").attr("class", "lbl-muted").text(`highest ${f(ext[1])}`);
        const hit = svg.append("g").selectAll("circle").data(rows).join("circle").attr("class", "hit")
          .attr("cx", (d) => x(d.v)).attr("cy", 18).attr("r", 7);
        bindTip(hit, (d) => `<b>${esc(d.n)}</b>${f(d.v)}`);
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `${names}: ${rows.length} values from ${f(ext[0])} to ${f(ext[1])}; Italy ${f(italy)}${a && values.get(a) != null ? `; ${a} ${f(values.get(a))}` : ""}${b && values.get(b) != null ? `; ${b} ${f(values.get(b))}` : ""}.`);
      }
      const rankOf = (values, name) => {
        const v = values.get(name); if (v == null) return null;
        const all = [...values.values()].filter((x) => x != null);
        return { r: 1 + all.filter((x) => x > v + 1e-9).length, n: all.length };
      };

      // ---- render the profile card
      let cur = null;
      function render(a, b) {
        cur = { a, b };
        selA.value = `${a.kind}:${a.name}`;
        const unitLabel = a.kind === "region" ? "regions" : "provinces";
        const rec = a.kind === "region" ? R.pl.get(a.name) : P.get(a.name);
        const recB = b ? (b.kind === "region" ? R.pl.get(b.name) : P.get(b.name)) : null;
        const reg = regionOf(a.kind, a.name), regB = b ? regionOf(b.kind, b.name) : null;
        const area = R.lib.get(reg)?.area || R.pl.get(reg)?.area;
        const sub = a.kind === "region" ? `Region · ${area === "South & islands" ? "south and islands" : area.toLowerCase()}` : `Province in ${reg} · ${area === "South & islands" ? "south and islands" : area.toLowerCase()}`;
        let html = `<div class="p-head"><h3>${esc(a.name)}${b ? ` <span style="font-size:0.6em;color:var(--muted)">and</span> <span class="vsname">${esc(b.name)}</span>` : ""}</h3>
          <p class="p-sub">${esc(sub)}</p>
          <div class="p-legend" aria-hidden="true"><span class="k"><i style="background:var(--hi)"></i>${esc(a.name)}</span>${b ? `<span class="k"><i style="background:var(--vs)"></i>${esc(b.name)}</span>` : ""}<span class="k"><i class="line"></i>Italy</span><span class="k"><i style="background:var(--rest)"></i>other ${unitLabel}</span></div></div>`;
        const strips = [];
        Object.entries(M).forEach(([id, m]) => {
          const useRegion = a.kind === "province" && m.regionOnly;
          const values = useRegion ? m.region : m[a.kind];
          const na = useRegion ? reg : a.name, nb = b ? (useRegion ? regB : b.name) : null;
          const v = values.get(na), vb = nb != null ? values.get(nb) : null;
          const rk = rankOf(values, na), rkB = nb != null ? rankOf(values, nb) : null;
          const diff = v == null ? "" : v > m.italy ? "above" : v < m.italy ? "below" : "equal to";
          const rankTxt = rk ? `${ord(rk.r)} of ${rk.n} ${useRegion ? "regions" : unitLabel}${m.higherWorse ? " (1 = highest share)" : ""}` : "";
          html += `<div class="metric${v == null ? " na" : ""}"><div><p class="m-label">${m.label}</p><p class="m-def">${m.def}${useRegion ? ` · regional figure for ${esc(reg)}; not available by province` : ""}</p>
            <div class="m-vals"><span class="m-v">${v == null ? "No value" : m.f(v)}</span>${nb != null && vb != null ? `<span class="m-v vs">${m.f(vb)}</span>` : ""}
            <span class="m-cmp">${v == null ? (a.name === "Sud Sardegna" ? "Province created in 2016: no 2012 figure" : "Not available") : `${diff} Italy (${m.f(m.italy)})`}${m.extra && v != null ? ` · ${m.extra(useRegion ? "region" : a.kind, na)}` : ""}</span>
            <span class="m-rank">${rankTxt}${rkB ? ` · ${esc(nb)} ${ord(rkB.r)}` : ""}</span></div></div>
            <div class="m-strip chart" id="strip-${id}"></div></div>`;
          strips.push([id, values, m, na, nb, useRegion ? "Regions" : unitLabel[0].toUpperCase() + unitLabel.slice(1)]);
        });
        const c = (r, k) => (r && r[k]) || 0;
        const cell = (i, lbl, k, s) => `<div><div class="c-v">${fmt(c(rec, k))}${recB ? ` <span style="color:var(--vs);font-size:0.7em">${fmt(c(recB, k))}</span>` : ""}</div><div class="c-l"><svg aria-hidden="true"><use href="#${KEYS[i]}"/></svg>${lbl}</div>${s ? `<div class="c-s">${s}</div>` : ""}</div>`;
        html += `<div class="metric" style="display:block"><p class="m-label">Places on the atlas</p><p class="m-def">Counts, not rates: computed from the atlas points placed in this ${a.kind}${b ? `; ${esc(b.name)} in blue` : ""}</p>
          <div class="counts">${cell(0, "Libraries", "t0")}${cell(1, "Museums", "t1", `${fmt(c(rec, "free1"))} free, ${fmt(c(rec, "tick1"))} with a ticket stated`)}${cell(2, "Archives", "t2")}${cell(3, "Heritage sites", "t3")}</div></div>`;
        html += `<div class="p-actions"><button type="button" class="btn" id="pl-show">Show ${esc(a.name)} on the atlas</button><button type="button" class="btn ghost" id="pl-copy">Copy link to this profile</button><output id="pl-out"></output></div>`;
        const box = $("profile");
        box.innerHTML = html;
        strips.forEach(([id, values, m, na, nb, names]) => strip($("strip-" + id), values, m.italy, na, nb, m.f, names));
        $("pl-show").addEventListener("click", () => window.C4A.atlas?.show(a.kind, a.name));
        $("pl-copy").addEventListener("click", () => {
          const out = $("pl-out");
          try { navigator.clipboard.writeText(location.href).then(() => { out.textContent = "Link copied."; }, () => { out.textContent = location.href; }); }
          catch (e) { out.textContent = location.href; }
        });
      }
      function update(a, b, writeHash) {
        fillB(a.kind, b?.name);
        render(a, b);
        if (writeHash) history.replaceState(null, "", hashFor(a, b));
      }
      selA.addEventListener("change", () => { const a = parse(selA.value); const b = parse(selB.value); update(a, b && b.kind === a.kind && b.name !== a.name ? b : null, true); });
      selB.addEventListener("change", () => { const a = parse(selA.value); const b = selB.value ? parse(selB.value) : null; update(a, b && b.name !== a.name ? b : null, true); });
      $("hero-find").addEventListener("submit", (e) => {
        e.preventDefault();
        const a = parse(hero.value); if (!a) { hero.focus(); return; }
        update(a, null, true);
        $("place").scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth" });
        $("pl-a").focus({ preventScroll: true });
      });
      function fromHash(scroll) {
        const h = readHash();
        if (!h) return false;
        update(h.a, h.b, false);
        if (scroll) $("place").scrollIntoView();
        return true;
      }
      if (!fromHash(true)) update({ kind: "region", name: regions[0] }, null, false);
      window.addEventListener("hashchange", () => fromHash(true));
      let rT, lastW = window.innerWidth;
      window.addEventListener("resize", () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rT); rT = setTimeout(() => cur && render(cur.a, cur.b), 150); });
    })
    .catch((err) => console.error("Could not load place data", err));
})();
