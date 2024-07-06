document.addEventListener('DOMContentLoaded', function() {
    const mapElement = document.getElementById('map1');
    if (!mapElement) {
        console.error('Element with ID map1 not found.');
        return;
    }

    const map = L.map('map1', {
        center: [41.8719, 13.5674],
        zoom: 6.5,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        dragging: true
    });

    // Set transparent background for the map container
    mapElement.style.backgroundColor = 'transparent';

    let geojsonLayer = null;

    // Load initial data on page load
    const initialDataset = 'archives';
    loadData(initialDataset);

    // Custom icon using SVG
    const customIcon = L.divIcon({
        html: `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="#516d97" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-map-pin">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        `,
        className: 'custom-marker-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    // Function to load data based on selected dataset
    function loadData(dataset) {
        let filePath;
        let latitudeField, longitudeField, nameField;

        switch (dataset) {
            case 'MIBAC libraries':
                filePath = 'data/Dati_biblioteche/Libraries_Luoghi_Cultura.json';
                latitudeField = 'Library_Latitude';
                longitudeField = 'Library_Longitude';
                nameField = 'Library_Name';
                break;
            case 'archives':
                filePath = 'data/Dati_Archivi/Archives_Luoghi_Cultura.json';
                latitudeField = 'Archive_Latitude';
                longitudeField = 'Archive_Longitude';
                nameField = 'Archive_Name';
                break;
            case 'museums':
                filePath = 'data/Dati_Musei/Museums_complete.json';
                latitudeField = 'Museum_Latitude';
                longitudeField = 'Museum_Longitude';
                nameField = 'Museum_Name';
                break;
            case 'libraries':
                filePath = 'data/Dati_biblioteche/lat_long.json';
                latitudeField = 'latitudine'; // Replace with correct field names if different
                longitudeField = 'longitudine'; // Replace with correct field names if different
                nameField = 'denominazione'; // Replace with correct field names if different
                break;
            default:
                console.error('Invalid dataset selection.');
                return;
        }

        // Fetch and process JSON data
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log(`${dataset} JSON data loaded successfully:`, data);
                processData(data, latitudeField, longitudeField, nameField, dataset);
            })
            .catch(error => {
                console.error(`Error loading ${dataset} JSON:`, error);
                alert(`Failed to load ${dataset} JSON data. Please check console for details.`);
            });
    }

    // Function to process loaded data and create GeoJSON layer
    function processData(data, latitudeField, longitudeField, nameField, dataset) {
        // Clear existing GeoJSON layer if it exists
        if (geojsonLayer) {
            map.removeLayer(geojsonLayer);
        }

        // Filter out specific outliers
        data = data.filter(item => {
            if (dataset === 'MIBAC libraries' && item[nameField] === 'Biblioteca Medica Statale di Roma') {
                return false;
            }
            if (dataset === 'museums' && item[nameField] === 'Museo civico preistorico "Pietro Fedele') {
                return false;
            }
            return true;
        });

        // Create GeoJSON structure
        const geojsonData = {
            type: 'FeatureCollection',
            features: data.map(item => {
                const latitude = parseFloat(item[latitudeField]);
                const longitude = parseFloat(item[longitudeField]);

                // Check for valid coordinates
                if (isNaN(latitude) || isNaN(longitude)) {
                    console.warn(`Invalid coordinates for item:`, item);
                    return null;
                }

                return {
                    type: 'Feature',
                    properties: {
                        name: item[nameField],
                        city: item.City || '', // Use empty string if City is undefined
                        region: item.Region || '' // Use empty string if Region is undefined
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                };
            }).filter(feature => feature !== null) // Filter out invalid features
        };

        // Create new GeoJSON layer
        geojsonLayer = L.geoJson(geojsonData, {
            pointToLayer: function (feature, latlng) {
                const popupContent = `<b>${feature.properties.name}</b>`;
                const city = feature.properties.city ? `<br>${feature.properties.city}` : '';
                const region = feature.properties.region ? `, ${feature.properties.region}` : '';
                return L.marker(latlng, { icon: customIcon })
                    .bindPopup(popupContent + city + region);
            }
        }).addTo(map);

        // Fit map to the bounds of the GeoJSON layer
        map.fitBounds(geojsonLayer.getBounds());
    }

    // Function to get color based on name (placeholder function)
    function getColor(name) {
        // Modify this function as per your color requirements
        return '#3388ff'; // Default color
    }

    // Add GeoJSON layer for region outlines and fill Italy with pale green color
    fetch('geojson/limits_IT_provinces.geojson')
        .then(response => response.json())
        .then(geojson => {
            L.geoJson(geojson, {
                style: function (feature) {
                    return {
                        color: 'white', // Outline color
                        weight: 2,
                        opacity: 1,
                        fillColor: '#98FB98', // Pale green color
                        fillOpacity: 0.5 // Adjust fill opacity as needed
                    };
                }
            }).addTo(map);
        })
        .catch(error => {
            console.error('Error loading region outlines:', error);
            alert('Failed to load region outlines. Please check console for details.');
        });

    // Event listener for dataset select dropdown
    const datasetSelect = document.getElementById('datasetSelect');
    if (datasetSelect) {
        datasetSelect.addEventListener('change', function(event) {
            const selectedDataset = event.target.value;
            loadData(selectedDataset);
        });
    } else {
        console.error('Dataset select element not found.');
    }

    // Custom zoom control buttons
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.className = 'zoom-btn';
    zoomInBtn.addEventListener('click', function() {
        map.zoomIn();
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '-';
    zoomOutBtn.className = 'zoom-btn';
    zoomOutBtn.addEventListener('click', function() {
        map.zoomOut();
    });

    const zoomControls = document.createElement('div');
    zoomControls.className = 'leaflet-control leaflet-bar';
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);

    mapElement.appendChild(zoomControls);

    map.scrollWheelZoom.disable(); // Disable scroll wheel zoom
});
