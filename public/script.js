// Initialize
let currentTiming = '11:00 AM';
let charts = {};
let dashboardDataCache = {};

// Map UI timing strings to server API timings
const apiTimingMap = {
    '10:00 AM': '10:00',
    '11:00 AM': '11:00',
    '11:30 AM': '11:30',
    '12:00 PM': '12:00'
};

// Update DateTime
function updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dtEl = document.getElementById('datetime');
    if(dtEl) dtEl.textContent = `${dateStr} | ${timeStr}`;
}

setInterval(updateDateTime, 1000);
updateDateTime();

// Generate Particles
function generateParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.width = Math.random() * 4 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        container.appendChild(particle);
    }
}

generateParticles();

// Ticker Tape
function createTickerTape() {
    const symbols = [
        { symbol: 'NIFTY', price: '19,435.50', change: '+1.23%', up: true },
        { symbol: 'BANKNIFTY', price: '44,182.75', change: '+0.87%', up: true },
        { symbol: 'INDIA VIX', price: '12.45', change: '-2.15%', up: false },
        { symbol: 'NIFTY FUT', price: '19,455.80', change: '+1.05%', up: true },
        { symbol: 'USDINR', price: '83.24', change: '-0.15%', up: false },
        { symbol: 'GOLD', price: '61,245', change: '+0.45%', up: true },
        { symbol: 'CRUDE', price: '6,785', change: '-1.25%', up: false },
        { symbol: 'SENSEX', price: '65,280.45', change: '+0.95%', up: true }
    ];

    const ticker = document.getElementById('ticker');
    if (!ticker) return;

    const tickerItems = [...symbols, ...symbols].map(item => `
        <div class="ticker-item">
            <span class="ticker-symbol">${item.symbol}</span>
            <span class="ticker-price">${item.price}</span>
            <span class="ticker-change ${item.up ? 'up' : 'down'}">
                ${item.up ? '▲' : '▼'} ${item.change}
            </span>
        </div>
    `).join('');

    ticker.innerHTML = tickerItems;
}

createTickerTape();

// Format Number
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (Math.abs(num) >= 10000000) {
        return '₹' + (num / 10000000).toFixed(2) + 'Cr';
    } else if (Math.abs(num) >= 100000) {
        return '₹' + (num / 100000).toFixed(2) + 'L';
    } else if (Math.abs(num) >= 1000) {
        return '₹' + (num / 1000).toFixed(1) + 'K';
    } else {
        return '₹' + num.toFixed(2);
    }
}

// Fetch Data from API
async function fetchDashboardData(timing) {
    const apiTiming = apiTimingMap[timing];
    if (!apiTiming) return null;
    
    if (dashboardDataCache[timing]) {
        return dashboardDataCache[timing];
    }
    
    try {
        const response = await fetch(`/api/data/${apiTiming}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        dashboardDataCache[timing] = data;
        return data;
    } catch (error) {
        console.error('Error fetching data for', timing, error);
        return null;
    }
}

// Update KPI Cards
function updateKPICards(data) {
    const kpiGrid = document.getElementById('kpi-grid');
    if (!kpiGrid || !data || !data.metrics) return;

    const metrics = data.metrics;
    
    // Fallback logic for derived metrics if not strictly present
    const total_net_profit = metrics.netProfit || 0;
    const max_drawdown = metrics.maxDrawdown || 0;
    const win_rate = metrics.winRate !== undefined ? metrics.winRate : (metrics.winDays / (metrics.winDays + metrics.lossDays) * 100) || 0;
    const avg_daily_pnl = total_net_profit / (metrics.winDays + metrics.lossDays || 1);
    
    const kpis = [
        {
            label: 'Total Net Profit',
            value: total_net_profit,
            icon: 'fa-wallet',
            format: 'currency',
            change: 'Overall PnL'
        },
        {
            label: 'Total Gross Profit',
            value: metrics.grossProfit || 0,
            icon: 'fa-chart-line',
            format: 'currency',
            change: 'Before Cost'
        },
        {
            label: 'Max Drawdown',
            value: max_drawdown,
            icon: 'fa-arrow-down',
            format: 'currency',
            change: 'Max Peak to Trough',
            negative: true
        },
        {
            label: 'Win Rate',
            value: win_rate,
            icon: 'fa-percentage',
            format: 'percent',
            change: (metrics.winDays || 0) + ' Win Days'
        },
        {
            label: 'Avg Daily PnL',
            value: avg_daily_pnl,
            icon: 'fa-calendar-day',
            format: 'currency',
            change: 'Per Trading Day'
        },
        {
            label: 'Transaction Cost',
            value: metrics.transactionCost || 0,
            icon: 'fa-exchange-alt',
            format: 'currency',
            change: 'Total Cost',
            negative: true
        }
    ];

    kpiGrid.innerHTML = kpis.map(kpi => `
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">${kpi.label}</span>
                <div class="kpi-icon">
                    <i class="fas ${kpi.icon}"></i>
                </div>
            </div>
            <div class="kpi-value" data-value="${kpi.value}" data-format="${kpi.format}">
                ${kpi.format === 'currency' ? formatNumber(kpi.value) :
                  kpi.format === 'percent' ? kpi.value.toFixed(2) + '%' :
                  kpi.value.toFixed(2)}
            </div>
            <div class="kpi-change ${kpi.negative ? 'negative' : 'positive'}">
                <i class="fas ${kpi.negative ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                <span>${kpi.change}</span>
            </div>
        </div>
    `).join('');
}

// Generate Data Points for Charts
function generateEquityCurve(data) {
    if (!data.chartData || !data.chartData.labels) return [];
    const points = [];
    for (let i = 0; i < data.chartData.labels.length; i++) {
        points.push({
            x: data.chartData.labels[i],
            y: data.chartData.pnlData[i]
        });
    }
    return points;
}

// Create Charts
function createCharts(timing, data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    if (!data) return;

    // Equity Curve Chart
    const equityCtxEl = document.getElementById('equityChart');
    if (equityCtxEl) {
        const equityCtx = equityCtxEl.getContext('2d');
        charts.equity = new Chart(equityCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: timing + ' PnL',
                    data: generateEquityCurve(data),
                    borderColor: 'rgba(0, 240, 255, 1)',
                    backgroundColor: 'rgba(0, 240, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 20, 32, 0.9)',
                        titleColor: '#00f0ff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(0, 240, 255, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => 'PnL: ' + formatNumber(context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'month' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: (value) => formatNumber(value)
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
    
    // Additional charts can be implemented as needed.
}

// Create Comparison Table
function createComparisonTable(data) {
    const tbody = document.getElementById('comparison-tbody');
    if (!tbody || !data || !data.comparisonTable) return;
    
    tbody.innerHTML = data.comparisonTable.map(row => {
        let singleStr = row.single;
        let allStr = row.all !== null ? row.all : '-';
        
        // simple formatting heuristic
        if (typeof singleStr === 'number') {
            if (singleStr % 1 !== 0) singleStr = singleStr.toFixed(2);
        }
        if (typeof allStr === 'number') {
            if (allStr % 1 !== 0) allStr = allStr.toFixed(2);
        }

        return `
            <tr>
                <td class="metric-name">${row.metric}</td>
                <td class="metric-value">${singleStr}</td>
                <td class="metric-value">${allStr}</td>
            </tr>
        `;
    }).join('');
}

// Main Render Function
async function renderDashboard(timing) {
    const data = await fetchDashboardData(timing);
    if (!data) return;
    updateKPICards(data);
    createCharts(timing, data);
    createComparisonTable(data);
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const timing = btn.dataset.timing;
        if (timing && timing !== 'comparison') {
            currentTiming = timing;
            renderDashboard(timing);
        }
    });
});

// Remove loading overlay if exists
const overlay = document.querySelector('.loading-overlay');
if(overlay) {
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 1500);
}

// Start
renderDashboard(currentTiming);
