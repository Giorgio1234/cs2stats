const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = require('chart.js');
const { createCanvas } = require('canvas');
const fs = require('fs').promises; // Use fs promises for async operations
const xlsx = require('xlsx');
const readline = require('readline');
const path = require('path');

// Registering the required components manually
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const PLAYER_COLOR_MAPPING = {
    'Martinezsa': '#800080',
    'dgt': '#800080',
    'max': '#800080',
    'HUASOPEEK': '#800080',
    'buda': '#800080',
    'MartinezSa': '#800080'
};

// Function to create the chart
async function createChart(players, ratings, outputFileName, chartTitle) {
    try {
        const width = 1920; // chart width
        const height = 1080; // chart height
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Chart configuration
        const configuration = {
            type: 'bar',
            data: {
                labels: players,
                datasets: [{
                    label: 'HLTV Rating 2.0',
                    data: ratings,
                    backgroundColor: players.map(player => PLAYER_COLOR_MAPPING[player] || 'orange'),
                    borderColor: 'black',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Make bars horizontal
                animation: false, // Disable animations
                plugins: {
                    legend: {
                        display: false // Disable legend to simplify rendering
                    },
                    tooltip: {
                        enabled: true // Enable tooltips
                    },
                    datalabels: {
                        color: 'white',
                        anchor: 'end',
                        align: 'end',
                        formatter: (value) => value.toFixed(2) // Display values to the right of bars
                    },
                    title: {
                        display: true,
                        text: chartTitle,
                        color: 'white',
                        font: {
                            size: 24
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'white', // Set grid line color
                            borderDash: [5, 5] // Add dotted matrix lines
                        },
                        title: {
                            display: true,
                            text: 'HLTV Rating 2.0',
                            color: 'white'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 20 },
                            color: 'white'
                        },
                        title: {
                            display: true,
                            text: 'Player',
                            color: 'white'
                        }
                    }
                },
                layout: {
                    padding: 20
                }
            },
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    // Set the background color to #2e2e2e
                    ctx.fillStyle = '#2e2e2e';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }, {
                id: 'backgroundColorRegion',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    const xAxis = chart.scales['x'];
                    const yAxis = chart.scales['y'];
                    ctx.save();

                    // Draw BAD region (0 - 0.8)
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                    ctx.fillRect(xAxis.left, yAxis.top, xAxis.getPixelForValue(0.8) - xAxis.left, yAxis.bottom - yAxis.top);

                    // Draw AVERAGE region (0.8 - 1.2)
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
                    ctx.fillRect(xAxis.getPixelForValue(0.8), yAxis.top, xAxis.getPixelForValue(1.2) - xAxis.getPixelForValue(0.8), yAxis.bottom - yAxis.top);

                    // Draw GOOD region (1.2 onwards)
                    ctx.fillStyle = 'rgba(0, 128, 0, 0.2)';
                    ctx.fillRect(xAxis.getPixelForValue(1.2), yAxis.top, xAxis.right - xAxis.getPixelForValue(1.2), yAxis.bottom - yAxis.top);

                    // Add labels for the regions
                    ctx.fillStyle = 'white';
                    ctx.font = '16px Arial';
					ctx.fillStyle = 'red';
                    ctx.fillText('BAD', xAxis.getPixelForValue(0.4), yAxis.bottom + 40);
					ctx.fillStyle = 'yellow';
                    ctx.fillText('AVERAGE', xAxis.getPixelForValue(1.0), yAxis.bottom + 40);
					ctx.fillStyle = 'green';
                    ctx.fillText('GOOD', xAxis.getPixelForValue(1.4), yAxis.bottom + 40);
                    ctx.restore();
                }
            }]
        };

        // Create the chart
        const chart = new Chart(ctx, configuration);

        // Save to file
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputFileName, buffer);
        console.log(`Chart saved as ${outputFileName}`);
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

// Function to read the xlsx file and extract players and ratings
function readDataFromXlsxFile(filename) {
    try {
        const workbook = xlsx.readFile(filename);
        const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Reading the first sheet
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Convert sheet to array of arrays

        let players = [];
        let ratings = [];

        // Start from the second row (index 1) to skip the header
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const player = row[0]; // First column: Player name
            const rating = row[8]; // Ninth column: HLTV Rating

            // Push player and rating to arrays if they are valid
            if (player && !isNaN(parseFloat(rating))) {
                players.push(player);
                ratings.push(parseFloat(rating));
            } else {
                console.warn(`Invalid data on row ${i + 1}, skipping...`);
            }
        }

        // Sort players and ratings from best to worst
        const sortedData = players.map((player, index) => ({ player, rating: ratings[index] }))
            .sort((a, b) => b.rating - a.rating);

        players = sortedData.map(data => data.player);
        ratings = sortedData.map(data => data.rating);

        return { players, ratings };
    } catch (error) {
        console.error('Error reading xlsx file:', error);
        return { players: [], ratings: [] };
    }
}

// Function to generate output file name
async function generateOutputFileName(baseName) {
    let outputFileName = `${baseName}.png`;
    let count = 1;

    // Check for file existence and create a unique name
    while (true) {
        try {
            await fs.access(outputFileName); // Check if the file exists
            outputFileName = `${baseName}_chart_${count}.png`; // If it exists, modify the name
            count++;
        } catch (error) {
            // File doesn't exist, safe to use this name
            break;
        }
    }

    return outputFileName;
}

// Main function to prompt for the file name and generate the chart
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the XLSX file name with player data: ', (fileName) => {
        rl.question('Enter the chart title: ', async (chartTitle) => {
            try {
                const { players, ratings } = readDataFromXlsxFile(fileName);

                if (players.length === 0 || ratings.length === 0) {
                    console.error('No valid data found in the file.');
                    return;
                }

                const baseName = path.basename(fileName, path.extname(fileName));
                const outputFileName = await generateOutputFileName(baseName); // Generate output file name
                await createChart(players, ratings, outputFileName, chartTitle);
            } catch (error) {
                console.error('Error generating chart:', error);
            } finally {
                rl.close();
            }
        });
    });
}

main(); // Calling main function