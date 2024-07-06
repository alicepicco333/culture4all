// JavaScript (piechart.js)

// Define the URLs for the JSON files
const urls = {
    "2010-11": "data/Dati_biblioteche/Dati_Generali_biblioteche/Biblio_Italia_General_info_2010_2011.json",
    "2012": "data/Dati_biblioteche/Dati_Generali_biblioteche/Biblio_Italia_General_info_2012.json",
    "2013": "data/Dati_biblioteche/Dati_Generali_biblioteche/Biblio_Italia_General_info_2013.json",
    "2014": "data/Dati_biblioteche/Dati_Generali_biblioteche/Biblio_Italia_General_info_2014.json"
};

// Initialize an empty object to store all data
const allData = {};

// Define fixed colors for each label (reversed order)
const labelColorMapping = {
    "Non indicato": '#c6dbef',
    "Fino a 2.000 volumi": '#9ecae1',
    "Da 2.001 a 5.000": '#6baed6',
    "Da 5.001 a 10.000": '#4292c6',
    "Da 10.001 a 100.000": '#2171b5',
    "Da 100.001 a 500.000": '#08519c',
    "Da 500.001 a 1.000.000": '#08519c', // Same color as above, adjust if needed
    "Oltre 1.000.000 di volumi": '#08519c' // Same color as above, adjust if needed
};

// Function to fetch data from a given URL
async function fetchData(year) {
    if (allData[year]) {
        return; // Data already fetched
    }

    try {
        const response = await fetch(urls[year]);
        if (!response.ok) {
            throw new Error(`Network response was not ok for year ${year}`);
        }
        const data = await response.json();
        allData[year] = data;
        console.log(`Data for ${year} loaded successfully:`, data);

        // If this is the first data load, initialize the chart
        if (year === document.getElementById('year-select').value) {
            await populateRegionSelect(year);
            updateChart();
        }
    } catch (error) {
        console.error(`Fetching data failed for year ${year}:`, error);
    }
}

// Function to populate region dropdown based on selected year
async function populateRegionSelect(year) {
    console.log(`Populating region select for year: ${year}`);

    if (!allData[year]) {
        await fetchData(year); // Data not yet available, fetch it
    }

    const regionSelect = document.getElementById('region-select');
    regionSelect.innerHTML = ''; // Clear previous options

    const yearData = allData[year]["Tav 4.3"];
    if (!Array.isArray(yearData)) {
        console.error(`Expected array but got ${typeof yearData} for year: ${year}`, yearData);
        return;
    }

    const regions = [...new Set(yearData
        .map(entry => entry && Object.values(entry)[0])
        .filter(region => region && region !== 'Totale' && region !== 'REGIONI' && !region.startsWith('ANNO'))
    )];

    console.log(`Regions for year ${year}:`, regions);

    if (regions.length === 0) {
        console.warn(`No regions found for year ${year}. Check the data structure.`);
    }

    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });

    // Set default region to Emilia Romagna if it exists
    if (regions.includes('Emilia Romagna')) {
        regionSelect.value = 'Emilia Romagna';
    }

    // Trigger the chart update
    updateChart();
}

// Function to extract and prepare data for plotting
function getDataForRegionYear(region, year) {
    console.log(`Getting data for region: ${region}, year: ${year}`);

    const yearData = allData[year]["Tav 4.3"];
    if (!Array.isArray(yearData)) {
        console.error(`Expected array but got ${typeof yearData} for year: ${year}`, yearData);
        return null;
    }

    const regionData = yearData.find(entry => entry && Object.values(entry)[0] === region);
    if (!regionData) {
        console.warn(`No data found for region: ${region}, year: ${year}`);
        return null;
    }

    const labels = [
        "Non indicato",
        "Fino a 2.000 volumi",
        "Da 2.001 a 5.000",
        "Da 5.001 a 10.000",
        "Da 10.001 a 100.000",
        "Da 100.001 a 500.000",
        "Da 500.001 a 1.000.000",
        "Oltre 1.000.000 di volumi"
    ];

    const data = labels.map((label, index) => {
        const columnKey = `Column${index + 2}`;
        return regionData[columnKey] || 0;
    });

    return { labels, data };
}

// Function to update the chart based on selected year and region
function updateChart() {
    const yearSelect = document.getElementById('year-select');
    const regionSelect = document.getElementById('region-select');

    if (!yearSelect || !regionSelect) {
        console.warn("Year or region select element is not available.");
        return;
    }

    const year = yearSelect.value;
    const region = regionSelect.value;

    if (!year || !region) {
        console.warn("Year or region not selected.");
        return;
    }

    console.log(`Updating chart for year: ${year}, region: ${region}`);

    const chartData = getDataForRegionYear(region, year);
    if (!chartData) {
        console.warn("No data available to plot.");
        return;
    }

    const ctx = document.getElementById('chart').getContext('2d');
    if (window.myPieChart) {
        window.myPieChart.destroy();
    }

    // Map labels to fixed colors
    const colors = chartData.labels.map(label => labelColorMapping[label] || '#c6dbef'); // Default color if label not found

    console.log(`Colors assigned:`, colors);

    window.myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Ensure it adjusts based on canvas size
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            // Return only the value part of the tooltip
                            return `${tooltipItem.raw}`;
                        }
                    }
                }
            }
        }
    });
}

// Initialize the application
async function initialize() {
    const yearSelect = document.getElementById('year-select');
    const regionSelect = document.getElementById('region-select');

    if (!yearSelect || !regionSelect) {
        console.error("One or more required DOM elements are not found.");
        return;
    }

    // Ensure that we add years only once
    const existingOptions = new Set(Array.from(yearSelect.options).map(option => option.value));

    Object.keys(urls).forEach(year => {
        if (!existingOptions.has(year)) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
            existingOptions.add(year);
        }
    });

    // Set up event listeners
    yearSelect.addEventListener('change', async () => {
        await populateRegionSelect(yearSelect.value);
        updateChart();
    });

    regionSelect.addEventListener('change', updateChart);

    // Set default year and initialize
    yearSelect.value = '2014'; // Default year
    await populateRegionSelect(yearSelect.value);
}

// Ensure the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', initialize);
