const { HLTV } = require('hltv');
const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter the player ID: ', (playerId) => {
    getPlayerStats(parseInt(playerId));
    rl.close();
});

async function getPlayerStats(playerId) {
    try {
        // Fetch player statistics for the past 6 months
        const stats = await HLTV.getPlayerStats({
            id: playerId
        });
        
        console.log('Full stats object:', stats);

        const { ign: playerAlias, matches } = stats;
        
        // Extract match date, rating, and result (win/loss)
        const matchData = matches.map(match => ({
            date: match.date ? new Date(match.date).toISOString().split('T')[0] : 'N/A',
            rating: match.rating !== undefined ? match.rating : 'N/A'
        }));

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Player Stats');

        // Add headers to the worksheet
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Rating', key: 'rating', width: 10 }
        ];

        // Add rows to the worksheet
        matchData.forEach(data => {
            worksheet.addRow(data);
        });

        // Determine file name and handle duplicate files
        let fileIndex = 0;
        let fileName = `player_stats_${playerAlias}.xlsx`;
        while (fs.existsSync(path.join(__dirname, fileName))) {
            fileIndex++;
            fileName = `player_stats_${playerAlias}_${fileIndex}.xlsx`;
        }

        // Write to Excel file with error handling
        try {
            await workbook.xlsx.writeFile(fileName);
            console.log(`Excel file has been written successfully as ${fileName}.`);
        } catch (error) {
            if (error.code === 'EBUSY') {
                console.error('The file is currently open or locked. Please close the file and try again.');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('An error occurred while fetching player stats:', error);
    }
}