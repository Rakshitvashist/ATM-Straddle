const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const COMPARISON_FILE = 'comparsion_file.xlsx';
const columnMapping = {
    '11:00 AM': { 
        metricCol: 6, 
        c1Col: 7, 
        allCol: 8,
        dataFile: 'results20percent1100AM.xlsx',
        pointsFile: 'results20percent1100AM_points.xlsx'
    }
};

function getMetricsData(timing) {
    const mapping = columnMapping[timing];
    if (!mapping) return null;

    if (!fs.existsSync(COMPARISON_FILE)) return null;

    const workbook = xlsx.readFile(COMPARISON_FILE);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const metrics = {
        c1: {},
        all: {}
    };
    
    const metricCol = mapping.metricCol;

    data.forEach(row => {
        const metricName = row[metricCol] ? String(row[metricCol]).trim() : '';
        
        const processMetric = (target, valCol) => {
            const value = row[valCol];
            if (metricName === 'Total Net Profit') target.netProfit = value;
            if (metricName === 'Total Gross Profit') target.grossProfit = value;
            if (metricName === 'Max Drawdown (Rupees)') target.maxDrawdownRupees = value;
            if (metricName === 'Max Drawdown (Points)') target.maxDrawdownPoints = value;
            if (metricName.includes('Winning Days')) target.winDays = value;
            if (metricName.includes('Losing Days')) target.lossDays = value;
            if (metricName.includes('Total Transaction Cost')) target.transactionCost = value;
            if (metricName === 'Win Rate %') target.winRate = value;
            if (metricName === 'Total Net Points Captured') target.netPoints = value;
        };

        processMetric(metrics.c1, mapping.c1Col);
        processMetric(metrics.all, mapping.allCol);
    });

    // Ensure we have a default maxDrawdown for backward compatibility in the UI if needed
    metrics.c1.maxDrawdown = metrics.c1.maxDrawdownRupees || metrics.c1.maxDrawdownPoints;
    metrics.all.maxDrawdown = metrics.all.maxDrawdownRupees || metrics.all.maxDrawdownPoints;

    // Also get points from the specific points file if it exists
    if (mapping.pointsFile && fs.existsSync(mapping.pointsFile)) {
        const pointsWb = xlsx.readFile(mapping.pointsFile);
        const pointsData = xlsx.utils.sheet_to_json(pointsWb.Sheets[pointsWb.SheetNames[0]]);
        if (pointsData.length > 0) {
            const lastRow = pointsData[pointsData.length - 1];
            metrics.all.netPoints = lastRow.Cum_Net_Points_All || 0;
        }
    }

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
const finalData = {};
Object.keys(columnMapping).forEach(timing => {
    console.log(`Processing ${timing}...`);
    finalData[timing] = {
        metrics: getMetricsData(timing),
        chartData: getChartData(timing)
    };
});

const output = `window.ATM_DATA = ${JSON.stringify(finalData, null, 2)};`;
fs.writeFileSync(path.join(__dirname, 'data.js'), output);

console.log('Static data generated in ./data.js');
