document.addEventListener('DOMContentLoaded', function () {
    fetchCSVData();
});

function fetchCSVData() {
    const url = 'Dati-Abitudini-lettura-regioni-2021.csv'; // Replace with your actual CSV file URL

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(text => {
            const data = parseCSV(text);
            console.log('Parsed Data:', data); // Debugging line
            if (data && data.headers && data.data) {
                // Pass the parsed data to initializeChart
                initializeChart(data);
            } else {
                console.error('Parsed data is invalid:', data);
            }
        })
        .catch(error => console.error('Error fetching CSV data:', error));
}

function parseCSV(text) {
    try {
        const lines = text.trim().split('\n');
        
        // Remove the last row which is not needed
        lines.pop();
        
        // Extract headers from the second line (skip the first line)
        const headers = lines[1].split(';').map(header => header.trim());
        
        // Extract data rows, starting from the third line
        const data = lines.slice(2).map(line => {
            const values = line.split(';').map(value => value.trim());
            const item = {};
            headers.forEach((header, i) => {
                item[header] = values[i];
            });
            return item;
        });
        
        // Handle the special case for the last data row
        return { headers, data };
    } catch (error) {
        console.error('Error parsing CSV:', error);
        return { headers: [], data: [] };
    }
}

function initializeChart(data) {
    // Ensure data is valid
    if (!data || !data.headers || !data.data || data.headers.length < 6) {
        console.error('Invalid data passed to initializeChart:', data);
        return;
    }

    // Prepare data for Chart.js
    const regions = data.data.map(item => item[data.headers[0]]);
    const datasets = data.headers.slice(1).map((label, index) => ({
        label: label,
        data: data.data.map(item => {
            const value = parseFloat(item[label].replace(',', '.')); // Handle comma as decimal separator
            return isNaN(value) ? 0 : value; // Handle NaN values
        }),
        backgroundColor: getColor(index),
        borderColor: getColor(index, true),
        borderWidth: 1
    }));

    console.log('Chart Data:', { regions, datasets }); // Debugging line

    const ctx = document.getElementById('readingChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: regions,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Regions'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Percentage'
                    }
                }
            }
        }
    });
}

function getColor(index, border = false) {
    const colors = [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)',
        'rgba(255, 206, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)',
        'rgba(255, 159, 64, 0.2)'
    ];
    const borderColors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
    ];
    return border ? borderColors[index % borderColors.length] : colors[index % colors.length];
}
