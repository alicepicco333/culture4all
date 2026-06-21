document.addEventListener('DOMContentLoaded', () => {
  const csvUrl = 'data/Dati_biblioteche/Dati_Generali_biblioteche/PrestitiBiblioRegioni2022.csv';
  let allData = null;

  /* ── Parse CSV ── */
  function parseCSV(text) {
    const data = { regions: {}, geographical: {}, population: {}, classification: {} };
    const rows = text.trim().split('\n');

    const regionsOfInterest = [
      "Piemonte", "Valle d'Aosta - Vallée d'Aoste", "Lombardia", "Trentino-Alto Adige",
      "Veneto", "Friuli-Venezia Giulia", "Liguria", "Emilia-Romagna", "Toscana",
      "Umbria", "Marche", "Lazio", "Abruzzo", "Molise", "Campania", "Puglia",
      "Basilicata", "Calabria", "Sicilia", "Sardegna"
    ];
    const geographicalCategories = ["Nord-ovest", "Nord-est", "Centro", "Sud", "Isole"];
    const populationRanges = [
      "Fino a 2.000 abitanti", "Da 2.001 a 5.000 abitanti", "Da 5.001 a 10.000 abitanti",
      "Da 10.001 a 30.000 abitanti", "Da 30.001 a 50.000 abitanti", "Più di 50.000 abitanti"
    ];
    const classificationCategories = [
      "Città metropolitane", "Comune Polo", "Polo intercomunale", "Comune cintura",
      "Comune intermedio", "Comune periferico", "Comune ultra-periferico",
      "Città o zone densamente popolate",
      "Piccole città e sobborghi a densità intermedia di popolazione",
      "Zone rurali o scarsamente popolate"
    ];

    for (const row of rows) {
      const m = row.match(/"([^"]+)"/);
      if (!m) continue;
      const columns = row.split(',').map(s => s.trim().replace(/"/g, ''));
      const category = columns[0];
      if (!category) continue;
      const cleanValue = m[1].replace(/,/g, '');
      if      (regionsOfInterest.includes(category))          data.regions[category]        = cleanValue;
      else if (geographicalCategories.includes(category))     data.geographical[category]   = cleanValue;
      else if (populationRanges.includes(category))           data.population[category]     = cleanValue;
      else if (classificationCategories.includes(category))   data.classification[category] = cleanValue;
    }
    return data;
  }

  /* ── Label translation ── */
  const labelMap = {
    "Nord-ovest": "Northwest", "Nord-est": "Northeast", "Centro": "Centre",
    "Sud": "South", "Isole": "Islands",
    "Fino a 2.000 abitanti": "Up to 2,000 inhab.",
    "Da 2.001 a 5.000 abitanti": "2,001 – 5,000",
    "Da 5.001 a 10.000 abitanti": "5,001 – 10,000",
    "Da 10.001 a 30.000 abitanti": "10,001 – 30,000",
    "Da 30.001 a 50.000 abitanti": "30,001 – 50,000",
    "Più di 50.000 abitanti": "Over 50,000",
    "Città metropolitane": "Metropolitan cities",
    "Comune Polo": "Hub municipality",
    "Polo intercomunale": "Inter-municipal hub",
    "Comune cintura": "Belt municipality",
    "Comune intermedio": "Intermediate municipality",
    "Comune periferico": "Peripheral municipality",
    "Comune ultra-periferico": "Ultra-peripheral",
    "Città o zone densamente popolate": "Densely populated",
    "Piccole città e sobborghi a densità intermedia di popolazione": "Mid-density suburbs",
    "Zone rurali o scarsamente popolate": "Rural / sparse",
    "Valle d'Aosta - Vallée d'Aoste": "Valle d'Aosta"
  };
  function translate(l) { return labelMap[l] || l; }

  /* ── D3 horizontal bar chart ── */
  function drawChart(rawData) {
    const container = document.getElementById('myChart');
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.entries(rawData)
      .map(([label, val]) => ({
        label: translate(label),
        value: parseInt(String(val).replace(/\./g, ''), 10) || 0
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    if (!entries.length) return;

    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 500;
    const margin = { top: 8, right: 100, bottom: 28, left: 200 };
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top  - margin.bottom;

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('overflow', 'visible');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(entries, d => d.value);
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, iW]).nice();
    const y = d3.scaleBand().domain(entries.map(d => d.label)).range([0, iH]).padding(0.28);
    const colorScale = d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolate('#b8cff0', '#1e3a6e'));

    /* Grid */
    g.append('g')
      .call(d3.axisBottom(x).ticks(5).tickSize(iH).tickFormat(''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').attr('stroke', '#f0ede8').attr('stroke-dasharray', '3,3'));

    /* Bars */
    const bars = g.selectAll('.bar').data(entries).join('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.label))
      .attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0)
      .attr('rx', 5)
      .attr('fill', d => colorScale(d.value))
      .style('cursor', 'default');

    bars.transition().duration(650).ease(d3.easeCubicOut)
      .attr('width', d => x(d.value));

    /* Value labels */
    g.selectAll('.val-lbl').data(entries).join('text')
      .attr('class', 'val-lbl')
      .attr('y', d => y(d.label) + y.bandwidth() / 2)
      .attr('x', d => x(d.value) + 8)
      .attr('dy', '0.35em')
      .style('font-family', 'Poppins, sans-serif')
      .style('font-size', '0.68rem')
      .style('fill', 'var(--text-3)')
      .text(d => d.value.toLocaleString('it-IT'));

    /* Y axis */
    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('text')
        .style('font-family', 'Poppins, sans-serif')
        .style('font-size', '0.72rem')
        .style('fill', 'var(--text-2)')
        .attr('dx', -8));

    /* X axis */
    g.append('g').attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(5)
        .tickFormat(d => d >= 1e6 ? (d/1e6).toFixed(1)+'M' : d >= 1e3 ? (d/1e3).toFixed(0)+'k' : d))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').remove())
      .call(gg => gg.selectAll('text')
        .style('font-family', 'Poppins, sans-serif')
        .style('font-size', '0.68rem')
        .style('fill', 'var(--text-3)'));

    /* Hover highlight only — value labels already visible on each bar */
    bars
      .on('mouseover', function () {
        d3.select(this).transition().duration(80).attr('opacity', 0.75);
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(80).attr('opacity', 1);
      });
  }

  function getCategoryData(cat) {
    if (!allData) return {};
    return cat === 'region'       ? allData.regions
         : cat === 'geographical' ? allData.geographical
         : cat === 'population'   ? allData.population
         : allData.classification;
  }

  document.getElementById('category-select')?.addEventListener('change', function () {
    drawChart(getCategoryData(this.value));
  });

  fetch(csvUrl)
    .then(r => { if (!r.ok) throw new Error('CSV fetch failed'); return r.text(); })
    .then(text => {
      allData = parseCSV(text);
      /* Wait for flex layout to compute actual container dimensions */
      requestAnimationFrame(() => drawChart(allData.regions));
    })
    .catch(err => console.error('chart2 error:', err));

  window.addEventListener('resize', () => {
    const cat = document.getElementById('category-select')?.value || 'region';
    drawChart(getCategoryData(cat));
  });
});
