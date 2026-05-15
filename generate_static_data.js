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
            if (metricName === 'Win Days') target.winDays = value;
            if (metricName === 'Loss Days') target.lossDays = value;
            if (metricName.includes('Total Transaction Cost')) target.transactionCost = value;
            if (metricName === 'Win Rate %') target.winRate = value;
            if (metricName === 'Total Net Points Captured') target.netPoints = value;
        };

        processMetric(metrics.c1, mapping.c1Col);
        processMetric(metrics.all, mapping.allCol);
    });

    return metrics;
}

function getChartData(timing) {
    const mapping = columnMapping[timing];
    if (!mapping) return null;

    const filePath = path.join(__dirname, mapping.dataFile);
    if (!fs.existsSync(filePath)) return null;

    const workbook = xlsx.readFile(filePath);
    
    // Process Detailed Trade Log for per-cycle data
    const tradeSheet = workbook.Sheets['Detailed Trade Log'];
    if (!tradeSheet) return null;
    const tradeData = xlsx.utils.sheet_to_json(tradeSheet);

    const dailyPnL = {}; // { date: { c1: val, c2: val, all: val } }

    tradeData.forEach(row => {
        if (!row.Date) return;
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

        if (!dailyPnL[dateStr]) {
            dailyPnL[dateStr] = { c1: 0, c2: 0, all: 0 };
        }

        const netPnl = row.Net_PnL || 0;
        dailyPnL[dateStr].all += netPnl;
        if (row.Cycle === 1) dailyPnL[dateStr].c1 += netPnl;
        if (row.Cycle === 2) dailyPnL[dateStr].c2 += netPnl;
    });

    const dates = Object.keys(dailyPnL).sort();
    
    const processSeries = (type) => {
        const pnlData = [];
        const drawdownData = [];
        const heatmap = {};
        let cumPnl = 0;
        let maxPnl = -Infinity;

        dates.forEach(dateStr => {
            const daily = dailyPnL[dateStr][type];
            cumPnl += daily;
            pnlData.push(cumPnl);

            if (cumPnl > maxPnl) maxPnl = cumPnl;
            drawdownData.push(cumPnl - maxPnl);

            const dateObj = new Date(dateStr);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            if (!heatmap[year]) heatmap[year] = {};
            if (!heatmap[year][month]) heatmap[year][month] = 0;
            heatmap[year][month] += daily;
        });

        return { pnlData, drawdownData, heatmap };
    };

    return {
        labels: dates,
        c1: processSeries('c1'),
        c2: processSeries('c2'),
        all: processSeries('all')
    };
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
