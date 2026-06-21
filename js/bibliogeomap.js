document.addEventListener('DOMContentLoaded', function () {

  /* ── Institution-type metadata ── */
  const typeInfo = {
    libraries: {
      color:  '#1e3a6e',
      stroke: '#4a7cc7',
      label:  'All Libraries',
      desc:   'Italy maintains over 12,000 public and academic libraries nationwide. This layer shows their full geographic spread, revealing stark contrasts between library-rich urban cores and rural areas where access remains limited.',
      detail: 'Public, academic, school, and special libraries as catalogued in the national register.'
    },
    'MIBAC libraries': {
      color:  '#2c5282',
      stroke: '#5b8ad0',
      label:  'MIBAC Libraries',
      desc:   'Libraries associated with the Ministry of Culture represent Italy\'s most historically significant public collections — including national and state libraries in major cities. These institutions preserve rare manuscripts, incunabula, and archival materials of national and international importance.',
      detail: 'State-managed libraries under the Ministry of Culture (MIC), formerly MIBAC.'
    },
    archives: {
      color:  '#7b4f12',
      stroke: '#c08040',
      label:  'Archives',
      desc:   'State and local archives house Italy\'s documentary memory — from medieval charters and notarial records to 20th-century administrative files. Their distribution closely follows historical administrative centers, reflecting centuries of regional governance and ecclesiastical record-keeping.',
      detail: 'State Archives and affiliated local archives catalogued through the MIC network.'
    },
    museums: {
      color:  '#1a5c3a',
      stroke: '#3a9a60',
      label:  'Museums',
      desc:   'Italy\'s museum network is among the most extensive in the world. From the great national museums of Rome, Florence, and Naples to intimate civic collections in hilltowns, these institutions collectively preserve art, archaeology, and cultural artifacts spanning millennia of Mediterranean civilization.',
      detail: 'Civic, state, private, and ecclesiastical museums registered with the national museum system.'
    }
  };

  /* ── Info panel ── */
  function renderTypePanel(datasetKey) {
    const panel = document.getElementById('map1-info-panel');
    if (!panel) return;
    const info = typeInfo[datasetKey] || typeInfo.libraries;
    panel.innerHTML = `
      <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);margin-bottom:0.5rem">
        ${info.label}
      </p>
      <p style="font-size:0.85rem;color:var(--text-2);line-height:1.75;margin-bottom:1rem">${info.desc}</p>
      <p style="font-size:0.78rem;color:var(--text-3);line-height:1.65;padding-top:0.75rem;border-top:1px solid var(--border)">${info.detail}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">
      <p style="font-size:0.75rem;color:var(--text-3)">Click a pin on the map to see details about a specific institution.</p>
    `;
  }

  function renderPinPanel(name, city, region, datasetKey) {
    const panel = document.getElementById('map1-info-panel');
    if (!panel) return;
    const info = typeInfo[datasetKey] || typeInfo.libraries;
    panel.innerHTML = `
      <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);margin-bottom:0.35rem">
        ${info.label}
      </p>
      <p style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.2rem;line-height:1.3">${name}</p>
      ${city ? `<p style="font-size:0.82rem;color:var(--text-2)">${city}${region ? ', ' + region : ''}</p>` : ''}
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">
      <p style="font-size:0.82rem;color:var(--text-2);line-height:1.75">${info.desc}</p>
    `;
  }

  /* ── Map setup ── */
  const mapEl = document.getElementById('map1');
  if (!mapEl) { console.error('map1 element not found'); return; }

  const map = L.map('map1', {
    center: [41.8719, 13.5674],
    zoom: 5,
    zoomControl: true,
    attributionControl: false,
    zoomSnap: 0.1,
    dragging: true,
    minZoom: 4,
    maxZoom: 14
  });

  mapEl.style.backgroundColor = 'transparent';
  map.scrollWheelZoom.enable();

  let currentDataset = 'archives';
  let geojsonLayer = null;

  /* ── Province outline layer ── */
  fetch('geojson/limits_IT_provinces.geojson')
    .then(r => r.json())
    .then(geojson => {
      L.geoJson(geojson, {
        style: () => ({
          color:       '#c7d3e8',
          weight:      1.5,
          opacity:     1,
          fillColor:   '#eef2fb',
          fillOpacity: 0.5
        })
      }).addTo(map);
    })
    .catch(err => console.error('Error loading province outlines:', err));

  /* ── Icon factory ── */
  function makeIcon(datasetKey) {
    const t = typeInfo[datasetKey] || typeInfo.libraries;
    return L.divIcon({
      html: `
        <svg width="20" height="20" viewBox="0 0 24 24"
          fill="${t.color}" stroke="${t.stroke}" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3" fill="white" stroke="${t.stroke}" stroke-width="1.5"/>
        </svg>`,
      className: '',
      iconSize:    [20, 20],
      iconAnchor:  [10, 20],
      popupAnchor: [0, -22]
    });
  }

  /* ── Data loading ── */
  function loadData(dataset) {
    currentDataset = dataset;
    renderTypePanel(dataset);

    const specs = {
      'MIBAC libraries': { path: 'data/Dati_biblioteche/Libraries_Luoghi_Cultura.json', lat: 'Library_Latitude',  lon: 'Library_Longitude',  name: 'Library_Name' },
      archives:          { path: 'data/Dati_Archivi/Archives_Luoghi_Cultura.json',      lat: 'Archive_Latitude',  lon: 'Archive_Longitude',  name: 'Archive_Name'  },
      museums:           { path: 'data/Dati_Musei/Museums_complete.json',               lat: 'Museum_Latitude',   lon: 'Museum_Longitude',   name: 'Museum_Name'   },
      libraries:         { path: 'data/Dati_biblioteche/lat_long.json',                 lat: 'latitudine',        lon: 'longitudine',        name: 'denominazione' }
    };

    const spec = specs[dataset];
    if (!spec) { console.error('Unknown dataset:', dataset); return; }

    fetch(spec.path)
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then(data => processData(data, spec, dataset))
      .catch(err => console.error(`Error loading ${dataset}:`, err));
  }

  function processData(data, spec, dataset) {
    if (geojsonLayer) { map.removeLayer(geojsonLayer); geojsonLayer = null; }

    const icon = makeIcon(dataset);

    /* Filter known outliers */
    data = data.filter(item => {
      if (dataset === 'MIBAC libraries' && item[spec.name] === 'Biblioteca Medica Statale di Roma') return false;
      if (dataset === 'museums' && item[spec.name] === 'Museo civico preistorico "Pietro Fedele') return false;
      return true;
    });

    const features = data
      .map(item => {
        const lat = parseFloat(item[spec.lat]);
        const lon = parseFloat(item[spec.lon]);
        if (isNaN(lat) || isNaN(lon)) return null;
        return {
          type: 'Feature',
          properties: { name: item[spec.name] || '', city: item.City || '', region: item.Region || '' },
          geometry: { type: 'Point', coordinates: [lon, lat] }
        };
      })
      .filter(Boolean);

    geojsonLayer = L.geoJson({ type: 'FeatureCollection', features }, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon })
          .on('click', () => renderPinPanel(feature.properties.name, feature.properties.city, feature.properties.region, dataset))
    }).addTo(map);

    if (geojsonLayer.getLayers().length > 0) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40] });
    }
  }

  /* ── Dropdown ── */
  const select = document.getElementById('datasetSelect');
  if (select) {
    select.addEventListener('change', e => loadData(e.target.value));
  }

  loadData(currentDataset);
  requestAnimationFrame(() => map.invalidateSize());
});
