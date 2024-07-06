document.addEventListener('DOMContentLoaded', function() {
    const mapElement = document.getElementById('map1');
    if (!mapElement) {
        console.error('Element with ID map1 not found.');
        return;
    }

    // Initialize the map
    const map = L.map('map1', {
        center: [41.8719, 13.5674], // Center of the map
        zoom: 5, // Initial zoom level
        zoomControl: true, // Display zoom controls
        attributionControl: false, // Hide attribution control
        zoomSnap: 0.1, // Adjust zoom snapping to be more fine-grained
        dragging: true, // Allow dragging of the map
        minZoom: 4, // Set minimum zoom level
        maxZoom: 12 // Set maximum zoom level
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#e0e7ff" stroke="#516d97" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-map-pin">
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
                latitudeField = 'latitudine';
                longitudeField = 'longitudine';
                nameField = 'denominazione';
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
                        city: item.City || '',
                        region: item.Region || ''
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                };
            }).filter(feature => feature !== null)
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

        // Fit map to the bounds of the GeoJSON layer with padding
        map.fitBounds(geojsonLayer.getBounds(), { padding: [60, 60] }); // Adjust padding as needed
    }

    // Function to get color based on name (placeholder function)
    function getColor(name) {
        return '#3388ff'; // Default color
    }

    // Add GeoJSON layer for region outlines and fill Italy with pale green color
    fetch('geojson/limits_IT_provinces.geojson')
        .then(response => response.json())
        .then(geojson => {
            L.geoJson(geojson, {
                style: function (feature) {
                    return {
                        color: 'white',
                        weight: 2,
                        opacity: 1,
                        fillColor: '#98FB98',
                        fillOpacity: 0.5
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

    map.scrollWheelZoom.disable(); // Disable scroll wheel zoom
});
