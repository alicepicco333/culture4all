document.addEventListener('DOMContentLoaded', function() {
    const map = L.map('map', {
        center: [41.8719, 12.5674],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1
    });

    document.getElementById('map').style.backgroundColor = 'transparent';

    L.tileLayer('', {
        attribution: '&copy; OpenStreetMap contributors',
        pane: 'tilePane'
    }).addTo(map);

    function getColor(d) {
        return d > 10000 ? '#800026' :
               d > 5000  ? '#BD0026' :
               d > 4000  ? '#E31A1C' :
               d > 3000  ? '#FC4E2A' :
               d > 2000  ? '#FD8D3C' :
               d > 1000  ? '#FEB24C' :
                           '#FFEDA0';
    }

    function style(feature) {
        const provinceName = feature.properties.prov_name;
        const data = getBibliotecheData(provinceName);
        const value = data !== null && data['Column3'] !== "-" ? +data['Column3'] : 0;

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
            `<b>${props.prov_name}</b><br />${props.value} persone ammesse al prestito`
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

        info.update(layer.feature.properties);

        const data = getBibliotecheData(layer.feature.properties.prov_name);
        const value = data !== null && data['Column3'] !== "-" ? +data['Column3'] : 'Data not available';

        const popupContent = `<b>${layer.feature.properties.prov_name}</b><br />${value} persone ammesse al prestito`;
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
    let globalData;

    function loadData(filePath) {
        console.log('Attempting to load data from:', filePath);

        d3.json(filePath)
            .then(data => {
                console.log('Data loaded successfully:', data);
                globalData = data;
                processBibliotecheData(filePath);
            })
            .catch(error => {
                console.error('Error loading JSON:', error);
                alert('Failed to load JSON data. Please check console for details.');
            });
    }

    function processBibliotecheData(filePath) {
        const year = filePath.substr(-9, 4);
        const key = `Tav. 1 - Numero di Biblioteche statali dipendenti dal MiBact per regioni e provincie, opere consultate e prestiti a privati e altre biblioteche - Anno ${year}`;
        const tavData = globalData[key];

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

    function getBibliotecheData(provinceName) {
        console.log(`Looking for province: ${provinceName}`);
    
        // Iterate through years from 2010 to 2018 (or any range you have data for)
        for (let year = 2010; year <= 2018; year++) {
            const key = `Tav. 1 - Numero di Biblioteche statali dipendenti dal MiBact per regioni e provincie, opere consultate e prestiti a privati e altre biblioteche - Anno ${year}`;
            const entry = globalData.find(entry => entry[key] === provinceName);
    
            if (entry) {
                return entry;
            }
        }
    
        return null; // Return null if data for the province is not found in any year
    }
    

    const initialFilePath = 'data/Dati_biblioteche/Json_Biblioteche_Mibact/df_tav_1_prestiti_2010.json';
    loadData(initialFilePath);

    document.getElementById('year').addEventListener('change', function() {
        const selectedYear = this.value;
        const filePath = `data/Dati_biblioteche/Json_Biblioteche_Mibact/df_tav_1_prestiti_${selectedYear}.json`;
        loadData(filePath);
    });

    map.scrollWheelZoom.disable();
});
