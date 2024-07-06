const csvUrl = 'data/Dati_biblioteche/Dati_Generali_biblioteche/PrestitiBiblioRegioni2022.csv'; // Update with the correct path to your CSV file
let chartInstance = null; // Variable to store the Chart.js instance

// Function to fetch and parse CSV
async function fetchCSV() {
    try {
        const response = await fetch(csvUrl);
        const text = await response.text();
        return parseCSV(text);
    } catch (error) {
        console.error('Error fetching CSV data:', error);
        return {};
    }
}

// Function to parse CSV text into an object
function parseCSV(text) {
    const data = {
        regions: {},
        geographical: {},
        population: {},
        classification: {}
    };

    // Split text into rows
    const rows = text.trim().split('\n');

    // Define the regions of interest
    const regionsOfInterest = [
        'Piemonte',
        'Valle d\'Aosta - Vallée d\'Aoste',
        'Lombardia',
        'Trentino-Alto Adige',
        'Veneto',
        'Friuli-Venezia Giulia',
        'Liguria',
        'Emilia-Romagna',
        'Toscana',
        'Umbria',
        'Marche',
        'Lazio',
        'Abruzzo',
        'Molise',
        'Campania',
        'Puglia',
        'Basilicata',
        'Calabria',
        'Sicilia',
        'Sardegna'
    ];

    // Define the geographical categories of interest
    const geographicalCategories = [
        'Nord-ovest',
        'Nord-est',
        'Centro',
        'Sud',
        'Isole'
    ];

    // Define the population ranges of interest
    const populationRanges = [
        'Fino a 2.000 abitanti',
        'Da 2.001 a 5.000 abitanti',
        'Da 5.001 a 10.000 abitanti',
        'Da 10.001 a 30.000 abitanti',
        'Da 30.001 a 50.000 abitanti',
        'Più di 50.000 abitanti'
    ];

    // Define the classification categories of interest
    const classificationCategories = [
        'Città metropolitane',
        'Comune Polo',
        'Polo intercomunale',
        'Comune cintura',
        'Comune intermedio',
        'Comune periferico',
        'Comune ultra-periferico',
        'Città o zone densamente popolate',
        'Piccole città e sobborghi a densità intermedia di popolazione',
        'Zone rurali o scarsamente popolate'
    ];

    for (let row of rows) {
        // Handle region data rows
        const regionMatch = row.match(/^([^,]+),\s*"([^"]*)"/);
        if (regionMatch) {
            const [_, region, value] = regionMatch;

            // Clean and process region name and value
            const cleanRegion = region.trim();
            let cleanValue = value ? value.trim() : ''; // Clean up value
            cleanValue = cleanValue.replace(/,/g, ''); // Remove commas from the value string

            // Only include data if the region is in the regionsOfInterest list
            if (regionsOfInterest.includes(cleanRegion)) {
                data.regions[cleanRegion] = cleanValue;
            }
        }

        // Handle geographical data rows
        const geoMatch = row.match(/^([^,]+),\s*"([^"]*)"/);
        if (geoMatch) {
            const [_, category, value] = geoMatch;

            // Clean and process category and value
            const cleanCategory = category.trim();
            let cleanValue = value ? value.trim() : ''; // Clean up value
            cleanValue = cleanValue.replace(/,/g, ''); // Remove commas from the value string

            // Only include data if the category is in the geographicalCategories list
            if (geographicalCategories.includes(cleanCategory)) {
                data.geographical[cleanCategory] = cleanValue;
            }
        }

        // Handle population data rows
        const popMatch = row.match(/^([^,]+),\s*"([^"]*)"/);
        if (popMatch) {
            const [_, range, value] = popMatch;

            // Clean and process range and value
            const cleanRange = range.trim();
            let cleanValue = value ? value.trim() : ''; // Clean up value
            cleanValue = cleanValue.replace(/,/g, ''); // Remove commas from the value string

            // Only include data if the range is in the populationRanges list
            if (populationRanges.includes(cleanRange)) {
                data.population[cleanRange] = cleanValue;
            }
        }

        // Handle classification data rows
        const classMatch = row.match(/^([^,]+),\s*"([^"]*)"/);
        if (classMatch) {
            const [_, category, value] = classMatch;

            // Clean and process category and value
            const cleanCategory = category.trim();
            let cleanValue = value ? value.trim() : ''; // Clean up value
            cleanValue = cleanValue.replace(/,/g, ''); // Remove commas from the value string

            // Only include data if the category is in the classificationCategories list
            if (classificationCategories.includes(cleanCategory)) {
                data.classification[cleanCategory] = cleanValue;
            }
        }
    }

    return data;
}

// Function to initialize the chart based on selected category
async function initializeChart() {
    const data = await fetchCSV();

    if (Object.keys(data).length === 0) {
        console.error('No data available for the selected category');
        return;
    }

    // Get the selected category from the dropdown
    const selectedCategory = document.getElementById('category-select').value;

    let filteredData;
    if (selectedCategory === 'region') {
        filteredData = data.regions;
    } else if (selectedCategory === 'geographical') {
        filteredData = data.geographical;
    } else if (selectedCategory === 'population') {
        filteredData = data.population;
    } else if (selectedCategory === 'classification') {
        filteredData = data.classification;
    } else {
        filteredData = {};
    }

    // Destroy the existing chart if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Create new chart
    const ctx = document.getElementById('myChart').getContext('2d');
    const chartData = {
        labels: Object.keys(filteredData),
        datasets: [{
            label: 'Number of Loans',
            data: Object.values(filteredData).map(value => parseInt(value, 10)),
            backgroundColor: 'rgba(54, 162, 235, 0.2)', // Light blue
            borderColor: 'rgba(54, 162, 235, 1)', // Darker blue
            borderWidth: 1
        }]
    };

    const config = {
        type: 'bar',
        data: chartData,
        options: {
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    };

    chartInstance = new Chart(ctx, config); // Save the new chart instance
}

// Call the initialization function
initializeChart();

// Event listener to update chart on category change
document.getElementById('category-select').addEventListener('change', function () {
    initializeChart();
});
