document.addEventListener('DOMContentLoaded', function () {

  /* ── CSV parse (semicolon-sep, header line 2, data from line 3) ── */
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    lines.pop(); // trailing summary row
    const headers = lines[1].split(';').map(h => h.trim());
    const data = lines.slice(2).map(line => {
      const values = line.split(';').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      return obj;
    });
    return { headers, data };
  }

  /* ── Metric config (label + colour) ── */
  const metricConfig = [
    { key: null, label: 'Read ≥ 1 book',          color: '#1e3a6e' },
    { key: null, label: 'Read 1–3 books',          color: '#2980b9' },
    { key: null, label: 'Read ≥ 12 books',         color: '#16a085' },
    { key: null, label: 'Only printed books',      color: '#8e44ad' },
    { key: null, label: 'Only digital books',      color: '#d35400' },
    { key: null, label: 'Both print & digital',    color: '#c0392b' },
  ];

  /* ── Draw ── */
  function drawChart(parsed) {
    const { headers, data } = parsed;
    const container = document.getElementById('readingChart');
    if (!container || !data.length) return;
    container.innerHTML = '';

    /* Assign CSV keys to metric config */
    const metricKeys = headers.slice(1);
    metricKeys.forEach((k, i) => { if (metricConfig[i]) metricConfig[i].key = k; });
    const metrics = metricConfig.filter(m => m.key);

    const regionKey = headers[0];
    const regions   = data.map(d => d[regionKey]);
    function toNum(v) { return parseFloat(String(v).replace(',', '.')) || 0; }

    /* ── Legend (HTML, always visible) ── */
    const legendEl = document.createElement('div');
    legendEl.style.cssText = [
      'display:flex', 'flex-wrap:wrap', 'gap:0.6rem 1.25rem',
      'padding:0 0.25rem 0.6rem', 'flex-shrink:0'
    ].join(';');
    metrics.forEach(m => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:0.4rem;font-family:Poppins,sans-serif;font-size:0.72rem;color:#5a6072';
      item.innerHTML = `<div style="width:20px;height:2.5px;background:${m.color};border-radius:2px;flex-shrink:0"></div>${m.label}`;
      legendEl.appendChild(item);
    });

    /* ── SVG wrapper ── */
    const svgWrap = document.createElement('div');
    svgWrap.style.cssText = 'flex:1;min-height:0;position:relative';

    container.style.display        = 'flex';
    container.style.flexDirection  = 'column';
    container.appendChild(legendEl);
    container.appendChild(svgWrap);

    const W = svgWrap.clientWidth  || 900;
    const H = svgWrap.clientHeight || 420;
    const margin = { top: 12, right: 28, bottom: 60, left: 50 };
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top  - margin.bottom;

    const svg = d3.select(svgWrap).append('svg')
      .attr('width', W).attr('height', H)
      .style('overflow', 'visible');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    /* Scales */
    const x = d3.scalePoint().domain(regions).range([0, iW]).padding(0.05);
    const allVals = metrics.flatMap(m => data.map(d => toNum(d[m.key])));
    const y = d3.scaleLinear().domain([0, d3.max(allVals)]).range([iH, 0]).nice();

    /* Grid */
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickSize(-iW).tickFormat(''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').attr('stroke', '#ebe8e2').attr('stroke-dasharray', '3,3'));

    /* Lines + dots */
    const lineGen = d3.line()
      .x(d => x(d.region))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    /* Hover dot layer — one per metric, positioned on crosshair */
    const hoverDots = {};

    metrics.forEach(m => {
      const pts = data.map(d => ({ region: d[regionKey], value: toNum(d[m.key]) }));

      const path = g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', m.color)
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);

      const len = path.node().getTotalLength();
      path.attr('stroke-dasharray', `${len} ${len}`)
          .attr('stroke-dashoffset', len)
          .transition().duration(900).ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);

      /* Static dots */
      g.selectAll(null)
        .data(pts).join('circle')
        .attr('cx', d => x(d.region))
        .attr('cy', d => y(d.value))
        .attr('r', 2.5)
        .attr('fill', m.color)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5);

      /* Large hover dot — hidden by default */
      hoverDots[m.key] = g.append('circle')
        .attr('r', 5).attr('fill', m.color)
        .attr('stroke', 'white').attr('stroke-width', 2)
        .style('opacity', 0).style('pointer-events', 'none');
    });

    /* Axes */
    g.append('g').attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(gg => gg.select('.domain').attr('stroke', '#e2dfd8'))
      .call(gg => gg.selectAll('text')
        .style('font-family', 'Poppins, sans-serif')
        .style('font-size', '0.62rem')
        .style('fill', 'var(--text-2)')
        .attr('dy', '1.1em')
        .attr('transform', 'rotate(-38)')
        .style('text-anchor', 'end'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + '%'))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').remove())
      .call(gg => gg.selectAll('text')
        .style('font-family', 'Poppins, sans-serif')
        .style('font-size', '0.68rem')
        .style('fill', 'var(--text-3)'));

    /* Crosshair */
    const crosshair = g.append('line')
      .attr('stroke', '#9aa0b3').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('y1', 0).attr('y2', iH)
      .style('opacity', 0).style('pointer-events', 'none');

    /* Tooltip */
    const tip = d3.select(svgWrap)
      .selectAll('.d3-tip').data([null]).join('div').attr('class', 'd3-tip')
      .style('min-width', '190px')
      .style('white-space', 'normal');

    /* Invisible overlay for mouse events */
    g.append('rect')
      .attr('width', iW).attr('height', iH)
      .attr('fill', 'none')
      .style('pointer-events', 'all')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const step = regions.length > 1 ? iW / (regions.length - 1) : iW;
        const idx  = Math.max(0, Math.min(regions.length - 1, Math.round(mx / step)));
        const reg  = regions[idx];
        const xPos = x(reg);

        crosshair.style('opacity', 1).attr('x1', xPos).attr('x2', xPos);

        /* Move hover dots */
        metrics.forEach(m => {
          const val = toNum(data[idx][m.key]);
          hoverDots[m.key]
            .style('opacity', 1)
            .attr('cx', xPos)
            .attr('cy', y(val));
        });

        /* Tooltip rows */
        const rows = metrics.map(m => {
          const val = toNum(data[idx][m.key]);
          return `<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">
            <div style="width:10px;height:10px;border-radius:50%;background:${m.color};flex-shrink:0"></div>
            <span style="font-size:0.72rem;color:#5a6072;flex:1">${m.label}</span>
            <span style="font-size:0.72rem;font-weight:600;color:#1c1f2e">${val.toFixed(1)}%</span>
          </div>`;
        }).join('');

        const svgRect = svgWrap.getBoundingClientRect();
        let tx = event.clientX - svgRect.left + 16;
        if (tx + 210 > svgRect.width) tx = event.clientX - svgRect.left - 226;

        tip.style('opacity', 1)
           .style('left', tx + 'px')
           .style('top', Math.max(0, event.clientY - svgRect.top - 20) + 'px')
           .html(`<strong style="font-size:0.75rem;display:block;margin-bottom:0.4rem;color:#1c1f2e">${reg}</strong>${rows}`);
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        metrics.forEach(m => hoverDots[m.key].style('opacity', 0));
        tip.style('opacity', 0);
      });
  }

  /* ── Init ── */
  let cachedData = null;

  fetch('Dati-Abitudini-lettura-regioni-2021.csv')
    .then(r => { if (!r.ok) throw new Error('CSV load failed'); return r.text(); })
    .then(text => {
      cachedData = parseCSV(text);
      /* Wait for flex layout to compute actual dimensions */
      requestAnimationFrame(() => drawChart(cachedData));
    })
    .catch(err => console.error('read.js error:', err));

  window.addEventListener('resize', () => {
    if (cachedData) drawChart(cachedData);
  });
});
