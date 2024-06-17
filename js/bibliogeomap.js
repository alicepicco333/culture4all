document.addEventListener('DOMContentLoaded', function() {
    const mapElement = document.getElementById('map1');
    if (!mapElement) {
        console.error('Element with ID map1 not found.');
        return;
    }

    const map = L.map('map1', {
        center: [41.8719, 12.5674],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        dragging: true
    });

    // Set transparent background for the map container
    mapElement.style.backgroundColor = 'transparent';

    // Add a base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        pane: 'tilePane'
    }).addTo(map);

    let geojsonLayer = null;

    // Load initial data on page load
    const initialDataset = 'libraries';
    loadData(initialDataset);

    // Function to load data based on selected dataset
    function loadData(dataset) {
        let filePath;
        let latitudeField, longitudeField, nameField;

        switch (dataset) {
            case 'libraries':
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
                processData(data, latitudeField, longitudeField, nameField);
            })
            .catch(error => {
                console.error(`Error loading ${dataset} JSON:`, error);
                alert(`Failed to load ${dataset} JSON data. Please check console for details.`);
            });
    }

    // Function to process loaded data and create GeoJSON layer
    function processData(data, latitudeField, longitudeField, nameField) {
        // Clear existing GeoJSON layer if it exists
        if (geojsonLayer) {
            map.removeLayer(geojsonLayer);
        }

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
                        city: item.City, // Adjust based on dataset structure
                        region: item.Region // Adjust based on dataset structure
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
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: getColor(feature.properties.name), // Color based on name
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.city}, ${feature.properties.region}`);
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
