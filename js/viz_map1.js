document.addEventListener('DOMContentLoaded', function() {
    const map = L.map('map', {
        center: [41.8719, 12.5674],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        dragging: false // Disable dragging
    });

    document.getElementById('map').style.backgroundColor = 'transparent';

    L.tileLayer('', {
        attribution: '&copy; OpenStreetMap contributors',
        pane: 'tilePane'
    }).addTo(map);

    function getColor(d) {
        return d > 800 ? '#08306b' :
               d > 500 ? '#08519c' :
               d > 300 ? '#2171b5' :
               d > 200 ? '#4292c6' :
               d > 100 ? '#6baed6' :
               d > 50  ? '#9ecae1' :
                         '#c6dbef';
    }

    function style(feature) {
        const provinceName = feature.properties.prov_name;
        const data = getBibliotecheData(provinceName);
        const value = data !== null ? +data : 0;

        return {
            fillColor: getColor(value),
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    }

    const info = L.control();

    info.onAdd = function(map) {
        this._div = L.DomUtil.create('div', 'info');
        this.update();
        return this._div;
    };

    info.update = function(props) {
        this._div.innerHTML = '<h4>Biblioteche</h4>' + (props ?
            `<b>${props.prov_name}</b><br />${props.value} biblioteche`
            : 'Click on a province');
    };

    info.addTo(map);

    function highlightFeature(e) {
        const layer = e.target;

        layer.setStyle({
            weight: 5,
            color: '#666',
            dashArray: '',
            fillOpacity: 0.4
        });

        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }

        const data = getBibliotecheData(layer.feature.properties.prov_name);
        const value = data !== null ? +data : 'Data not available';
        const props = {
            prov_name: layer.feature.properties.prov_name,
            value: value
        };

        info.update(props);

        const popupContent = `<b>${layer.feature.properties.prov_name}</b><br />${value} biblioteche`;
        const popup = L.popup()
            .setLatLng(layer.getBounds().getCenter())
            .setContent(popupContent)
            .openOn(map);
    }

    function resetHighlight(e) {
        geojson.resetStyle(e.target);
        info.update();
    }

    function onEachFeature(feature, layer) {
        layer.on({
            click: highlightFeature,
            mouseout: resetHighlight,
        });
    }

    let geojson;

    const provinceMapping = {
        "Forli'-Cesena": "Forlì-Cesena",
        "Aosta": "Valle d'Aosta/Vallée d'Aoste",
        "Bolzano": "Bolzano/Bozen",
        "Reggio di Calabria": "Reggio Calabria",
        "Massa Carrara": "Massa-Carrara"
    };

    function getBibliotecheData(provinceName) {
        console.log(`Looking for province: ${provinceName}`);
        const mappedName = provinceMapping[provinceName] || provinceName;
        return globalData[mappedName] || null;
    }

    function loadData(filePath) {
        console.log('Attempting to load data from:', filePath);

        d3.json(filePath)
            .then(data => {
                console.log('Data loaded successfully:', data);
                globalData = data;
                processBibliotecheData();
            })
            .catch(error => {
                console.error('Error loading JSON:', error);
                alert('Failed to load JSON data. Please check console for details.');
            });
    }

    function processBibliotecheData() {
        fetch('geojson/georef-italy-provincia.geojson')
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
                alert('Failed to load GeoJSON data. Please check console for details.');
            });
    }

    const initialFilePath = 'data/Dati_biblioteche/provincia_n_biblioteche_2022.json';
    loadData(initialFilePath);

    map.scrollWheelZoom.disable();
});
