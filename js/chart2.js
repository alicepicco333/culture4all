document.addEventListener('DOMContentLoaded', () => {
    const csvUrl = 'data/Dati_biblioteche/Dati_Generali_biblioteche/PrestitiBiblioRegioni2022.csv'; // Path to your CSV file
    let chartInstance = null; // Variable to store the Chart.js instance

    // Function to fetch and parse CSV
    async function fetchCSV() {
        try {
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const text = await response.text();
            return parseCSV(text);
        } catch (error) {
            console.error('Error fetching CSV data:', error);
            return { regions: {}, geographical: {}, population: {}, classification: {} }; // Return empty objects on error
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

        // Define categories of interest
        const regionsOfInterest = [
            'Piemonte', 'Valle d\'Aosta - Vallée d\'Aoste', 'Lombardia', 'Trentino-Alto Adige',
            'Veneto', 'Friuli-Venezia Giulia', 'Liguria', 'Emilia-Romagna', 'Toscana',
            'Umbria', 'Marche', 'Lazio', 'Abruzzo', 'Molise', 'Campania', 'Puglia',
            'Basilicata', 'Calabria', 'Sicilia', 'Sardegna'
        ];

        const geographicalCategories = [
            'Nord-ovest', 'Nord-est', 'Centro', 'Sud', 'Isole'
        ];

        const populationRanges = [
            'Fino a 2.000 abitanti', 'Da 2.001 a 5.000 abitanti', 'Da 5.001 a 10.000 abitanti',
            'Da 10.001 a 30.000 abitanti', 'Da 30.001 a 50.000 abitanti', 'Più di 50.000 abitanti'
        ];

        const classificationCategories = [
            'Città metropolitane', 'Comune Polo', 'Polo intercomunale', 'Comune cintura',
            'Comune intermedio', 'Comune periferico', 'Comune ultra-periferico',
            'Città o zone densamente popolate', 'Piccole città e sobborghi a densità intermedia di popolazione',
            'Zone rurali o scarsamente popolate'
        ];

        for (let row of rows) {
            // Find the value inside the first double quotes
            const matches = row.match(/"([^"]+)"/);
            const valueInsideQuotes = matches ? matches[1] : null;

            // Split the row by commas
            const columns = row.split(',').map(s => s.trim().replace(/"/g, ''));
            const category = columns[0];

            if (!category || !valueInsideQuotes) continue;

            const cleanValue = valueInsideQuotes.replace(/,/g, ''); // Clean up value

            // Categorize data based on lists of interest
            if (regionsOfInterest.includes(category)) {
                data.regions[category] = cleanValue;
            } else if (geographicalCategories.includes(category)) {
                data.geographical[category] = cleanValue;
            } else if (populationRanges.includes(category)) {
                data.population[category] = cleanValue;
            } else if (classificationCategories.includes(category)) {
                data.classification[category] = cleanValue;
            }
        }

        return data;
    }

    // Function to initialize the chart based on selected category
    async function initializeChart() {
        const data = await fetchCSV();

        console.log('Fetched Data:', data); // Debug: Check the entire fetched data

        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            console.error('Fetched data is not an object or is empty:', data);
            return;
        }

        // Get the selected category from the dropdown
        const selectedCategory = document.getElementById('category-select').value;
        console.log('Selected Category:', selectedCategory); // Debug: Check the selected category

        let filteredData = {};

        switch (selectedCategory) {
            case 'region':
                filteredData = data.regions;
                break;
            case 'geographical':
                filteredData = data.geographical;
                break;
            case 'population':
                filteredData = data.population;
                break;
            case 'classification':
                filteredData = data.classification;
                break;
            default:
                console.error('Invalid category selected:', selectedCategory);
                filteredData = {}; // Ensure filteredData is an empty object
                break;
        }

        console.log('Filtered Data:', filteredData); // Debug: Check filtered data

        // Check if filteredData is a valid object and not empty
        if (typeof filteredData !== 'object' || filteredData === null || Object.keys(filteredData).length === 0) {
            console.error('Filtered data is not an object or is empty:', filteredData);
            return;
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
                data: Object.values(filteredData).map(value => parseInt(value, 10) || 0), // Handle non-integer values
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

    // Event listener to update chart on category change
    document.getElementById('category-select').addEventListener('change', function () {
        console.log('Category changed to:', this.value); // Debug: Check the changed value
        initializeChart();
    });

    // Initialize chart on page load
    initializeChart();
});
