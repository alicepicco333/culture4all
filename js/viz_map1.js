document.addEventListener('DOMContentLoaded', function () {

  /* ── Region descriptions ── */
  const regionDescriptions = {
    "Piemonte": "Piemonte's library network is anchored by Turin, home to the Biblioteca Nazionale Universitaria — one of Italy's oldest national libraries. The region's industrial heritage and Renaissance artistic tradition coexist in collections ranging from technical to fine-arts archives. Provincial cities like Novara, Asti, and Cuneo maintain solid public library services.",
    "Valle d'Aosta/Vallée d'Aoste": "As Italy's smallest region, Valle d'Aosta maintains a compact but quality library network deeply shaped by its bilingual French-Italian identity. The Biblioteca Regionale di Aosta serves as the main cultural hub, preserving alpine heritage and supporting a mountain community with limited urban infrastructure.",
    "Lombardia": "Lombardia leads Italy in library density. Milan's extensive network — including the Biblioteca Nazionale Braidense and major university libraries — attracts researchers from across Europe. Provincial cities such as Bergamo, Brescia, and Pavia contribute a well-distributed network that reflects the region's economic and cultural primacy.",
    "Trentino-Alto Adige/Südtirol": "This bilingual region's libraries reflect a distinctive identity at the crossroads of Italian and Germanic culture. South Tyrol maintains a parallel German-language library network, while the Biblioteca Provinciale Claudia Augusta in Bolzano serves both communities. Collections span Ladin, Italian, and German cultural heritage.",
    "Veneto": "Venice's extraordinary historic collections — from the Biblioteca Nazionale Marciana to monastic archives — coexist with a modern provincial network serving Padova, Verona, and Vicenza. The University of Padova (founded 1222), one of the world's oldest, houses significant research collections central to the region's academic identity.",
    "Friuli Venezia Giulia": "Trieste's cosmopolitan heritage as a Habsburg port gave rise to multilingual collections serving Italian, Slovenian, and German-speaking communities. The Biblioteca Civica di Trieste and the Biblioteca Nazionale e Universitaria anchor a regionally distinctive network shaped by Central European cultural exchange.",
    "Liguria": "Genoa's maritime history shapes specialized collections focused on navigation, trade, and geography. The Biblioteca Civica Berio is the region's flagship institution. Services extend along the Ligurian Riviera, where geographic challenges — steep terrain, dispersed coastal settlements — make equitable access a key concern.",
    "Emilia-Romagna": "One of Italy's most library-rich regions per capita, Emilia-Romagna benefits from a tradition of civic investment in culture. Bologna's university — the world's oldest, founded in 1088 — houses legendary academic collections, complemented by excellent public libraries in Modena, Parma, Ferrara, and Ravenna.",
    "Toscana": "Florence anchors one of the world's greatest concentrations of library heritage: the Biblioteca Medicea Laurenziana, the Biblioteca Nazionale Centrale, and dozens of specialized institutions. The region's Renaissance legacy is distributed throughout Siena, Pisa, Arezzo, and Lucca, making Tuscany an international destination for manuscript scholarship.",
    "Umbria": "Perugia and Assisi anchor Umbria's library network, where historic monastic and civic libraries preserve medieval manuscripts and early printed books. The region's spiritual heritage — home to St. Francis, St. Benedict, and the Benedictine tradition — is reflected in exceptional ecclesiastical collections of global scholarly importance.",
    "Marche": "Libraries are distributed across Marche's characteristic hilltown landscape, from Ancona on the coast to inland Urbino — birthplace of Raphael. The University of Urbino continues a Renaissance ducal library tradition, while smaller civic collections throughout the region preserve local cultural memory.",
    "Lazio": "Rome concentrates Italy's and the world's most extraordinary library heritage. The Biblioteca Nazionale Centrale di Roma, the Vatican Apostolic Library, and dozens of specialized academic and pontifical institutions make Lazio an unparalleled center of knowledge. Access disparities between Rome and the outer provinces, however, remain significant.",
    "Abruzzo": "Abruzzo's library network is rebuilding in the wake of the 2009 L'Aquila earthquake, which severely damaged historic institutions. Despite the challenges, the region maintains a resilient network across Pescara, Chieti, and Teramo, with renewed investment in cultural reconstruction and digitization of damaged collections.",
    "Molise": "Italy's least populous region maintains a modest library network concentrated in Campobasso. Despite limited resources, local institutions preserve Molise's distinctive identity — including traditions of Albanian and Slavic-speaking minorities — with recent efforts focused on digitizing collections and improving regional connectivity.",
    "Campania": "Naples' rich Bourbon-era collections — the Biblioteca Nazionale di Napoli and the Biblioteca Universitaria — represent one of Italy's most significant library heritages. The region faces stark disparities: Naples offers abundant institutional resources, while peripheral provinces of Benevento, Avellino, and Salerno remain underserved.",
    "Puglia": "Puglia is investing in expanding cultural access across its distinctive landscape. Bari's regional libraries and the historic collections of Lecce — long known as the 'Florence of the South' — anchor a growing network that extends to coastal and rural communities throughout the heel of Italy.",
    "Basilicata": "Matera, European Capital of Culture in 2019, catalyzed significant investment in Basilicata's cultural infrastructure. The region's library network, though modest in scale, is growing with renewed purpose — preserving the heritage of one of Europe's most ancient settlement landscapes alongside contemporary digital access initiatives.",
    "Calabria": "Geographic isolation — mountainous terrain, fragmented transport links — creates real distribution challenges for Calabria's library network. Reggio Calabria and Catanzaro host the main institutions, while rural areas remain underserved. The region's Greek, Norman, and Byzantine heritage is preserved in specialized archival collections.",
    "Sicilia": "Palermo and Catania anchor an island-wide network reflecting Sicily's extraordinary layered heritage: Greek, Roman, Arab, Norman, and Spanish. The Biblioteca Centrale della Regione Siciliana holds exceptional collections. Access disparities between urban coastal centers and the rural interior remain a pressing challenge for cultural policy.",
    "Sardegna": "Cagliari leads a library network serving a dispersed island population across diverse linguistic communities — including Sardinian, Catalan-Algherese, and Tabarchino. The Biblioteca Universitaria di Cagliari and the regional library system bridge urban and rural gaps, with growing investment in digital access for remote communities."
  };

  /* ── Color scale (matches the fill colors in style()) ── */
  const colorSteps = [
    { min: 800, color: '#08306b', label: '> 800' },
    { min: 500, color: '#08519c', label: '> 500' },
    { min: 300, color: '#2171b5', label: '> 300' },
    { min: 200, color: '#4292c6', label: '> 200' },
    { min: 100, color: '#6baed6', label: '> 100' },
    { min: 50,  color: '#9ecae1', label: '> 50'  },
    { min: 0,   color: '#c6dbef', label: '≤ 50'  },
  ];

  /* ── Info panel ── */
  function renderPanel(provinceName, regionName, value) {
    const panel = document.getElementById('map-info-panel');
    if (!panel) return;

    if (!provinceName) {
      panel.innerHTML = `
        <p style="font-size:0.82rem;color:var(--text-3);margin-bottom:1.5rem">
          Hover over a province to explore its library landscape and regional context.
        </p>
        <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:0.65rem">
          Color scale
        </p>
        ${colorSteps.map(s => `
          <div style="display:flex;align-items:center;gap:0.55rem;margin-bottom:0.35rem">
            <div style="width:11px;height:11px;border-radius:2px;background:${s.color};flex-shrink:0"></div>
            <span style="font-size:0.78rem;color:var(--text-2)">${s.label} libraries</span>
          </div>
        `).join('')}
        <p style="margin-top:auto;padding-top:1.25rem;font-size:0.72rem;color:var(--text-3);border-top:1px solid var(--border)">
          Source: ISTAT 2022
        </p>
      `;
      return;
    }

    const maxVal = 900;
    const pct = Math.min(100, ((value || 0) / maxVal) * 100);
    const regionKey = Object.keys(regionDescriptions).find(k =>
      regionName && (k === regionName || regionName.startsWith(k.split('/')[0]) || k.startsWith(regionName.split('/')[0]))
    );
    const desc = regionKey ? regionDescriptions[regionKey] : 'Cultural data for this region is being compiled.';
    const shortRegion = regionName ? regionName.split('/')[0] : '';

    panel.innerHTML = `
      <div style="flex:1">
        <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);margin-bottom:0.3rem">Province</p>
        <p style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:0.15rem">${provinceName}</p>
        <p style="font-size:0.8rem;color:var(--text-3);margin-bottom:0.9rem">${shortRegion}</p>

        <div style="display:flex;align-items:baseline;gap:0.4rem;margin-bottom:0.4rem">
          <span style="font-size:2rem;font-weight:700;color:var(--accent);line-height:1">${value !== null ? value : '—'}</span>
          <span style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:var(--text-3)">libraries</span>
        </div>
        <div style="height:4px;background:var(--accent-bg);border-radius:2px;overflow:hidden;margin-bottom:1.1rem">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px;transition:width 0.4s ease"></div>
        </div>

        <hr style="border:none;border-top:1px solid var(--border);margin-bottom:1rem">

        <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);margin-bottom:0.5rem">
          About ${shortRegion || 'this region'}
        </p>
        <p style="font-size:0.82rem;color:var(--text-2);line-height:1.75">${desc}</p>
      </div>
    `;
  }

  /* ── Map setup ── */
  let globalData = {};

  const map = L.map('map', {
    center: [41.8719, 13.5674],
    zoom: 5.5,
    zoomControl: true,
    attributionControl: false,
    zoomSnap: 0.1,
    dragging: true,
    minZoom: 4,
    maxZoom: 12
  });

  document.getElementById('map').style.backgroundColor = 'transparent';
  map.scrollWheelZoom.disable();

  function getColor(d) {
    return d > 800 ? '#08306b' :
           d > 500 ? '#08519c' :
           d > 300 ? '#2171b5' :
           d > 200 ? '#4292c6' :
           d > 100 ? '#6baed6' :
           d > 50  ? '#9ecae1' :
                     '#c6dbef';
  }

  const provinceMapping = {
    "Forli'-Cesena":      "Forlì-Cesena",
    "Aosta":              "Valle d'Aosta/Vallée d'Aoste",
    "Bolzano":            "Bolzano/Bozen",
    "Reggio di Calabria": "Reggio Calabria",
    "Massa Carrara":      "Massa-Carrara"
  };

  function getBibliotecheData(provinceName) {
    const mapped = provinceMapping[provinceName] || provinceName;
    return globalData[mapped] || null;
  }

  function style(feature) {
    const data = getBibliotecheData(feature.properties.prov_name);
    const value = data !== null ? +data : 0;
    return {
      fillColor: getColor(value),
      weight: 1.5,
      opacity: 1,
      color: 'white',
      dashArray: '',
      fillOpacity: 0.75
    };
  }

  let geojson;

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.55 });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();

    const prov = layer.feature.properties.prov_name;
    const reg  = layer.feature.properties.reg_name || layer.feature.properties.reg_istat_code || '';
    const data = getBibliotecheData(prov);
    const val  = data !== null ? +data : null;

    renderPanel(prov, reg, val);
  }

  function resetHighlight(e) {
    geojson.resetStyle(e.target);
    renderPanel(null, null, null);
  }

  function onEachFeature(feature, layer) {
    layer.on({ mouseover: highlightFeature, mouseout: resetHighlight });
  }

  function loadData(filePath) {
    d3.json(filePath).then(data => {
      globalData = data;
      processBibliotecheData();
    }).catch(err => console.error('Error loading JSON:', err));
  }

  function processBibliotecheData() {
    fetch('geojson/georef-italy-provincia.geojson')
      .then(r => { if (!r.ok) throw new Error('GeoJSON load failed'); return r.json(); })
      .then(geojsonData => {
        if (geojson) map.removeLayer(geojson);
        geojson = L.geoJson(geojsonData, { style, onEachFeature }).addTo(map);
      })
      .catch(err => console.error('Error loading GeoJSON:', err));
  }

  loadData('data/Dati_biblioteche/provincia_n_biblioteche_2022.json');
  renderPanel(null, null, null);
  /* Ensure Leaflet recalculates size after flex layout settles */
  requestAnimationFrame(() => map.invalidateSize());
});
