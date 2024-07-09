async function fetchData(url) {
    try {
        const response = await fetch(url);
        const text = await response.text(); // Read the response as text

        console.log('Fetched Data:', text); // Log the raw response

        // Parse the text data to extract city and value pairs
        const data = text.split('\n').map(line => {
            const [city, value] = line.split('=');
            return { city: city.trim(), value: parseFloat(value.trim()) };
        });

        // Ensure data is an array
        if (!Array.isArray(data)) {
            throw new Error('Fetched data is not an array');
        }

        console.log('Parsed Data:', data); // Log the parsed data

        // Sort data by value in descending order and get top 20
        const top20Cities = data.sort((a, b) => b.value - a.value).slice(0, 20);

        // Create bubble chart with the top 20 cities
        createBubbleChart(top20Cities);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function createBubbleChart(data) {
    const labels = data.map(item => item.city);
    const values = data.map(item => item.value);
    const bubbleSizes = values.map(value => value / 10); // Adjust the size factor as needed

    const trace = {
        x: labels,
        y: values,
        text: labels,
        mode: 'markers',
        marker: {
            size: bubbleSizes,
            sizemode: 'area',
            color: values,
            colorscale: 'Viridis',
            showscale: true
        }
    };

    const layout = {
        title: 'Top 20 Cities by Value',
        xaxis: { title: 'City' },
        yaxis: { title: 'Value' },
        showlegend: false,
        height: 600
    };

    Plotly.newPlot('eventchart', [trace], layout);
}

// Call fetchData with the correct URL
fetchData('data/Dati_eventi/city_events_2023.json');
