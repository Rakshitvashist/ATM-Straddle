const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const COMPARISON_FILE = 'comparsion_file.xlsx';
const columnMapping = {
    '11:00': { 
        col: 10, 
        dataFile: 'results20percent.xlsx' // Mapping based on previous logic
    }
};

function getMetricsData(timing) {
    const mapping = columnMapping[timing];
    if (!mapping) return null;

    const workbook = xlsx.readFile(COMPARISON_FILE);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const metrics = {};
    const colIndex = mapping.col;

    // Based on previous mapping of the comparison Excel
    data.forEach(row => {
        const metricName = row[0] ? String(row[0]).trim() : '';
        const value = row[colIndex];

        if (metricName.includes('Total Net Profit')) metrics.netProfit = value;
        if (metricName.includes('Total Gross Profit')) metrics.grossProfit = value;
        if (metricName.includes('Max Drawdown')) metrics.maxDrawdown = value;
        if (metricName.includes('Winning Days')) metrics.winDays = value;
        if (metricName.includes('Losing Days')) metrics.lossDays = value;
        if (metricName.includes('Net Points')) metrics.netPoints = value;
        if (metricName.includes('Total Transaction Cost')) metrics.transactionCost = value;
    });

    return metrics;
}

function getChartData(timing) {
    const mapping = columnMapping[timing];
    if (!mapping) return null;

    const filePath = path.join(__dirname, mapping.dataFile);
    if (!fs.existsSync(filePath)) return null;

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    const labels = [];
    const pnlData = [];
    const drawdownData = [];
    const heatmapRaw = {};

    let cumPnl = 0;
    let maxPnl = -Infinity;

    rawData.forEach(row => {
        if (row.Date) {
            let dateObj;
            if (typeof row.Date === 'number') {
                dateObj = new Date(Math.round((row.Date - 25569) * 86400 * 1000));
            } else if (row.Date instanceof Date) {
                 dateObj = row.Date;
            } else {
                 dateObj = new Date(String(row.Date).split(' ')[0]);
            }
            if (isNaN(dateObj.getTime())) return;
            
            const dateStr = dateObj.toISOString().split('T')[0];
            labels.push(dateStr);
            
            let dailyPnl = row.Total_Net_PnL || 0;
            let currentCumPnl = row.Cum_Net_PnL_All !== undefined ? row.Cum_Net_PnL_All : (cumPnl += dailyPnl);
            
            pnlData.push(currentCumPnl);

            if (row.Drawdown_Net_All !== undefined) {
                drawdownData.push(row.Drawdown_Net_All);
            } else {
                if (currentCumPnl > maxPnl) maxPnl = currentCumPnl;
                drawdownData.push(currentCumPnl - maxPnl);
            }

            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            if (!heatmapRaw[year]) heatmapRaw[year] = {};
            if (!heatmapRaw[year][month]) heatmapRaw[year][month] = 0;
            heatmapRaw[year][month] += dailyPnl;
        }
    });

    return { labels, pnlData, drawdownData, heatmap: heatmapRaw };
}

// Generate Data
const finalData = {
    '11:00 AM': {
        metrics: getMetricsData('11:00'),
        chartData: getChartData('11:00')
    }
};

const output = `window.ATM_DATA = ${JSON.stringify(finalData, null, 2)};`;
fs.writeFileSync(path.join(__dirname, 'public', 'data.js'), output);

console.log('Static data generated in public/data.js');
