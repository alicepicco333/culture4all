document.addEventListener('DOMContentLoaded', function() {
    const map1Element = document.getElementById('map1');
    if (!map1Element) {
        console.error('Element with ID map1 not found.');
        return;
    }

    const map1 = L.map('map1', {
        center: [41.8719, 12.5674],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        dragging: true // Enable dragging
    });

    // Set transparent background for the map
    map1Element.style.backgroundColor = 'transparent';

    // Add tile layer (replace '' with your desired tile URL)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        pane: 'tilePane'
    }).addTo(map1);

    let geojsonMarkers;
    let geojsonProvinces;

    function loadData(filePath) {
        console.log('Attempting to load data from:', filePath);

        d3.csv(filePath)
            .then(data => {
                console.log('CSV data loaded successfully:', data);
                processData(data);
            })
            .catch(error => {
                console.error('Error loading CSV:', error);
                alert('Failed to load CSV data. Please check console for details.');
            });
    }

    function processData(data) {
        // Filter out the "Biblioteca Medica Statale di Roma" if it exists
        const filteredData = data.filter(row => row.Library_Name !== "Biblioteca Medica Statale di Roma");

        const markersGeoJSON = {
            type: 'FeatureCollection',
            features: filteredData.map(row => ({
                type: 'Feature',
                properties: {
                    id: row.Library_ID,
                    name: row.Library_Name,
                    city: row.Library_City,
                    region: row.Library_Region
                },
                geometry: {
                    type: 'Point',
                    coordinates: [
                        parseFloat(row.Library_Longitude),
                        parseFloat(row.Library_Latitude)
                    ]
                }
            }))
        };

        console.log('Markers GeoJSON data processed:', markersGeoJSON);

        // Remove existing markers layer if it exists
        if (geojsonMarkers) {
            map1.removeLayer(geojsonMarkers);
        }

        geojsonMarkers = L.geoJson(markersGeoJSON, {
            pointToLayer: function (feature, latlng) {
                const marker = L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: getColor(), // Using getColor function for marker fill color
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });

                // Bind popup with Library_Name on marker hover
                marker.bindPopup(feature.properties.name);

                // Event listeners for showing/hiding popup
                marker.on('mouseover', function(event) {
                    marker.openPopup();
                });

                marker.on('mouseout', function(event) {
                    marker.closePopup();
                });

                return marker;
            }
        }).addTo(map1);

        // Fit map to the bounds of the markers GeoJSON layer
        map1.fitBounds(geojsonMarkers.getBounds());
    }

    // Example getColor function for generating intermediate color
    function getColor() {
        const color1 = '#08306b'; // Darker color from the provided palette
        const color2 = '#c6dbef'; // Lighter color from the provided palette
        
        // Interpolate color between color1 and color2
        return interpolateColor(color1, color2, 0.5); // 0.5 for midpoint (adjust as needed)
    }

    // Function to interpolate between two colors
    function interpolateColor(color1, color2, factor) {
        if (factor > 1) factor = 1;
        if (factor < 0) factor = 0;

        const result = color1.slice(1).match(/.{2}/g).map(function(channel, index) {
            return Math.round(parseInt(channel, 16) + factor * (parseInt(color2.slice(1).match(/.{2}/g)[index], 16) - parseInt(channel, 16))).toString(16).padStart(2, '0');
        });

        return '#' + result.join('');
    }

    const initialFilePath = 'data/Dati_biblioteche/Libraries_luoghi_Cultura.csv';
    loadData(initialFilePath);

    // Add custom zoom control buttons
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.className = 'zoom-btn'; // Custom class for styling
    zoomInBtn.addEventListener('click', function() {
        map1.zoomIn();
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '-';
    zoomOutBtn.className = 'zoom-btn'; // Custom class for styling
    zoomOutBtn.addEventListener('click', function() {
        map1.zoomOut();
    });

    const zoomControls = document.createElement('div');
    zoomControls.className = 'leaflet-control leaflet-bar';
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);

    map1Element.appendChild(zoomControls);

    map1.scrollWheelZoom.disable(); // Disable scroll wheel zoom
});
