// Create the map
const map = L.map('map').setView([41.8719, 12.5674], 5); // Center on Italy

// Add a base tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

console.log("Map created and base tile layer added.");

// Function to get color based on data value
function getColor(d) {
    return d > 100000 ? '#800026' :
           d > 50000  ? '#BD0026' :
           d > 20000  ? '#E31A1C' :
           d > 10000  ? '#FC4E2A' :
           d > 5000   ? '#FD8D3C' :
           d > 2000   ? '#FEB24C' :
           d > 1000   ? '#FED976' :
                        '#FFEDA0';
}

// Function to style each feature
function style(feature) {
    return {
        fillColor: getColor(feature.properties.value),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Control for showing info on hover
const info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    this._div.innerHTML = '<h4>Cultural Data</h4>' +  (props ?
        '<b>' + props.name + '</b><br />' + props.value + ' cultural events'
        : 'Hover over a region');
};

info.addTo(map);

console.log("Info control added to map.");

// Function to highlight feature on hover
function highlightFeature(e) {
    const layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.7
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    info.update(layer.feature.properties);
}

// Function to reset highlight
function resetHighlight(e) {
    geojson.resetStyle(e.target);
    info.update();
}

// Function to zoom to feature
function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Function to handle each feature's events
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

let geojson;
let baseGeoJson;

// Load the base GeoJSON file once
d3.json('data/baseGeoJson.geojson').then(baseData => {
    baseGeoJson = baseData;
    console.log("Base GeoJSON loaded:", baseGeoJson);
    loadData('2010'); // Initial load with the first year
}).catch(error => {
    console.error('Error loading base GeoJSON file:', error);
});

// Function to load data and update map
function loadData(year) {
    const dataFilePath = `data/Dati_biblioteche/Datasets_MibactLibraries/Biblio_Mibact_Statali_Ministero_${year}.json`; // Adjust the path to your JSON files
    console.log("Loading data for year:", year);

    d3.json(dataFilePath).then(data => {
        console.log("Data loaded for year", year, ":", data);
        if (geojson) {
            map.removeLayer(geojson);
        }

        // Merge the data with the base GeoJSON
        baseGeoJson.features.forEach(feature => {
            const dataItem = data.find(item => item.id === feature.id);
            feature.properties.value = dataItem ? dataItem.value : 0;
        });

        geojson = L.geoJson(baseGeoJson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        console.log("GeoJSON layer added to map for year:", year);
    }).catch(error => {
        console.error('Error loading data JSON file for year', year, ':', error);
    });
}

// Update map when year is changed
document.getElementById('yearSelector').addEventListener('change', function() {
    loadData(this.value);
});
