const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

// Mapping of timings to columns in comparsion_file.xlsx
const columnMapping = {
    '10:00': { metric: 0, single: 1, all: 2, dataFile: 'results20percent.xlsx' },
    '11:00': { metric: 6, single: 7, all: 8, dataFile: 'results20percent1100AM.xlsx' },
    '11:30': { metric: 12, single: 13, all: 14, dataFile: 'results20percent1130AM.xlsx' },
    '12:00': { metric: 18, single: 19, all: 20, dataFile: 'results20percent1200AM.xlsx' },
};

function getMetricsData(timing) {
    const filePath = path.join(__dirname, 'comparsion_file.xlsx');
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // sheet_to_json with header: 1 returns an array of arrays
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const mapping = columnMapping[timing];
    if (!mapping) return null;

    const metrics = {};
    const comparisonTable = [];
    
    // We start from row 2 (index 2), as 0 and 1 are headers
    for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;
        const metricName = row[mapping.metric];
        const singleCycle = row[mapping.single];
        const allCycles = row[mapping.all];

        if (metricName && typeof metricName === 'string' && singleCycle !== undefined) {
            comparisonTable.push({
                metric: metricName,
                single: singleCycle,
                all: allCycles !== undefined ? allCycles : null
            });
            
            // Extract some key metrics for KPIs based on names
            if (metricName === 'Total Gross Profit') metrics.grossProfit = singleCycle;
            if (metricName === 'Total Transaction Cost') metrics.transactionCost = singleCycle;
            if (metricName === 'Total Net Profit') metrics.netProfit = singleCycle;
            if (metricName === 'Win Rate %') metrics.winRate = singleCycle;
            if (metricName === 'Win Days') metrics.winDays = singleCycle;
            if (metricName === 'Loss Days') metrics.lossDays = singleCycle;
            if (metricName === 'Max Drawdown (Rupees)') metrics.maxDrawdown = singleCycle;
            if (metricName === 'Total Net Points Captured') metrics.netPoints = singleCycle;
        }
    }
    
    return { metrics, comparisonTable };
}

function getChartData(timing) {
    const mapping = columnMapping[timing];
    if (!mapping) return null;

    const filePath = path.join(__dirname, mapping.dataFile);
    if (!fs.existsSync(filePath)) {
        return null;
    }

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
            let dateStr = row.Date;
            let dateObj;
            if (typeof dateStr === 'number') {
                dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
            } else if (dateStr instanceof Date) {
                 dateObj = dateStr;
            } else {
                 dateObj = new Date(String(dateStr).split(' ')[0]);
            }
            
            if (isNaN(dateObj.getTime())) return;
            
            dateStr = dateObj.toISOString().split('T')[0];
            labels.push(dateStr);
            
            let dailyPnl = row.Total_Net_PnL || 0;
            let currentCumPnl;
            
            if (row.Cum_Net_PnL_All !== undefined) {
                currentCumPnl = row.Cum_Net_PnL_All;
            } else {
                cumPnl += dailyPnl;
                currentCumPnl = cumPnl;
            }
            pnlData.push(currentCumPnl);

            // Calculate or extract drawdown
            if (row.Drawdown_Net_All !== undefined) {
                drawdownData.push(row.Drawdown_Net_All);
            } else {
                if (currentCumPnl > maxPnl) maxPnl = currentCumPnl;
                const dd = currentCumPnl - maxPnl;
                drawdownData.push(dd);
            }

            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1; // 1-12
            if (!heatmapRaw[year]) heatmapRaw[year] = {};
            if (!heatmapRaw[year][month]) heatmapRaw[year][month] = 0;
            heatmapRaw[year][month] += dailyPnl;
        }
    });

    return { labels, pnlData, drawdownData, heatmap: heatmapRaw };
}

app.get('/api/data/:timing', (req, res) => {
    const { timing } = req.params;
    if (!columnMapping[timing]) {
        return res.status(400).json({ error: 'Invalid timing parameter' });
    }

    try {
        const metricsData = getMetricsData(timing);
        const chartData = getChartData(timing);

        if (!metricsData) {
            return res.status(404).json({ error: 'Metrics data not found' });
        }

        res.json({
            timing,
            ...metricsData,
            chartData: chartData || { labels: [], pnlData: [] }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error while processing data' });
    }
});

app.listen(port, () => {
    console.log(`Quantum Capital Dashboard server listening on http://localhost:${port}`);
});
