document.addEventListener('DOMContentLoaded', function() {
    // Initialize Leaflet map
    const map = L.map('map').setView([41.8719, 12.5674], 5); // Center on Italy

    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Function to get color based on data value
    function getColor(d) {
        return d > 100000 ? '#800026' :
               d > 50000  ? '#BD0026' :
               d > 20000  ? '#E31A1C' :
               d > 10000  ? '#FC4E2A' :
               d > 5000   ? '#FD8D3C' :
               d > 2000   ? '#FEB24C' :
                            '#FFEDA0';
    }

    // Function to style each feature
    function style(feature) {
        const provinceName = feature.properties.name;
        const data = getBibliotecheData(provinceName); // Function to retrieve data for this province
        const value = data !== null && data['Column3'] !== "-" ? data['Column3'] : 0; // Assuming 'Column3' is the biblioteche count
        return {
            fillColor: getColor(value),
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    }

    // Control for showing info on hover
    const info = L.control();

    info.onAdd = function(map) {
        this._div = L.DomUtil.create('div', 'info');
        this.update();
        return this._div;
    };

    info.update = function(props) {
        this._div.innerHTML = '<h4>Biblioteche</h4>' +  (props ?
            '<b>' + props.name + '</b><br />' + props.value + ' biblioteche'
            : 'Hover over a region');
    };

    info.addTo(map);

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
    let data;

    // Function to load data and update map
    function loadData(filePath) {
        console.log('Attempting to load data from:', filePath);

        d3.json(filePath)
            .then(data => {
                console.log('Data loaded successfully:', data);
                processBibliotecheData(data, filePath);
            })
            .catch(error => {
                console.error('Error loading JSON:', error);
            });
    }

    // Function to process the data for the given file path
    function processBibliotecheData(data, filePath) {
        const year = filePath.substr(-8, 4); // Extract year from the last 4 characters of the file path
        const key = `Tav. 1 - Numero di Biblioteche statali dipendenti dal MiBact per regioni e provincie, opere consultate e prestiti a privati e altre biblioteche - Anno ${year}`;
        const tavData = data[key];

        // Load provinces GeoJSON data
        fetch('../geojson/georef-italy-provincia.geojson') // Adjust path to your GeoJSON file
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(geojsonData => {
                console.log('Provinces GeoJSON loaded successfully:', geojsonData);

                if (geojson) {
                    map.removeLayer(geojson);
                }

                geojson = L.geoJson(geojsonData, {
                    style: style,
                    onEachFeature: onEachFeature
                }).addTo(map);
            })
            .catch(error => {
                console.error('Error loading GeoJSON:', error);
            });
    }

    // Function to get biblioteche data for a specific province
    function getBibliotecheData(provinceName) {
        for (let i = 0; i < data.length; i++) {
            const entry = data[i];
            if (entry && entry[`Tav. 1 - Numero di Biblioteche statali dipendenti dal MiBact per regioni e provincie, opere consultate e prestiti a privati e altre biblioteche - Anno ${year}`] === provinceName) {
                return entry;
            }
        }
        return null;
    }

    // Initial load
    const initialFilePath = 'data/Dati_biblioteche/Json_Biblioteche_Mibact/df_tav_1_prestiti__2010.json'; // Adjust this to the desired initial file path
    loadData(initialFilePath);

    // Load initial data
    document.getElementById('year').addEventListener('change', function() {
        const selectedYear = this.value;
        const filePath = `data/Dati_biblioteche/Json_Biblioteche_Mibact/df_tav_1_prestiti__${selectedYear}.json`;
        loadData(filePath);
    });
});
