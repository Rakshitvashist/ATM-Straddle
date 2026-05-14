// Initialize
let currentTiming = '11:00 AM';
let charts = {};
let dashboardDataCache = {};

// Map UI timing strings to server API timings
const apiTimingMap = {
    '11:00 AM': '11:00'
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
    if (dtEl) dtEl.textContent = `${dateStr} | ${timeStr}`;
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

// Fetch Data (Static Version)
async function fetchDashboardData(timing) {
    if (window.ATM_DATA && window.ATM_DATA[timing]) {
        return window.ATM_DATA[timing];
    }
    console.error('Data not found for timing:', timing);
    return null;
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
            label: 'Total Net Points',
            value: metrics.netPoints || 0,
            icon: 'fa-bullseye',
            format: 'decimal',
            change: 'Points Captured'
        },
        {
            label: 'Estimated Capital',
            value: 1000000,
            icon: 'fa-money-bill',
            format: 'currency',
            change: 'Initial Required'
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

// Create Charts
function createCharts(timing, data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    if (!data || !data.chartData || !data.chartData.labels) return;

    // Equity Curve Chart
    const equityCtxEl = document.getElementById('equityChart');
    if (equityCtxEl) {
        const equityCtx = equityCtxEl.getContext('2d');
        charts.equity = new Chart(equityCtx, {
            type: 'line',
            data: {
                labels: data.chartData.labels,
                datasets: [{
                    label: timing + ' PnL',
                    data: data.chartData.pnlData,
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
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', maxTicksLimit: 12 }
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

    // Drawdown Chart
    const drawdownCtxEl = document.getElementById('drawdownChart');
    if (drawdownCtxEl && data.chartData.drawdownData) {
        const drawdownCtx = drawdownCtxEl.getContext('2d');
        charts.drawdown = new Chart(drawdownCtx, {
            type: 'line',
            data: {
                labels: data.chartData.labels,
                datasets: [{
                    label: 'Drawdown',
                    data: data.chartData.drawdownData,
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderWidth: 1,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
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
                        callbacks: {
                            label: (context) => 'DD: ' + formatNumber(context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxTicksLimit: 12 }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: (v) => formatNumber(v) }
                    }
                }
            }
        });
    }

    // Monthly Bar Chart
    const monthlyCtxEl = document.getElementById('monthlyBarChart');
    if (monthlyCtxEl && data.chartData.heatmap) {
        const monthlyCtx = monthlyCtxEl.getContext('2d');
        const heatmap = data.chartData.heatmap;
        const years = Object.keys(heatmap).sort();
        const yearLabels = years;
        const yearProfits = years.map(year => {
            return Object.values(heatmap[year]).reduce((a, b) => a + b, 0);
        });

        charts.monthly = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: yearLabels,
                datasets: [{
                    label: 'Yearly PnL',
                    data: yearProfits,
                    backgroundColor: yearProfits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                    borderColor: yearProfits.map(p => p >= 0 ? '#10b981' : '#ef4444'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => 'Total: ' + formatNumber(context.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: (v) => formatNumber(v) }
                    },
                    x: {
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

// Create Heatmap
function createHeatmap(data) {
    const table = document.getElementById('heatmap-table');
    if (!table || !data || !data.chartData || !data.chartData.heatmap) return;
    
    const heatmapRaw = data.chartData.heatmap;
    const years = Object.keys(heatmapRaw).sort((a,b)=>b-a);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let thead = `<thead><tr><th>Year</th>${months.map(m=>`<th>${m}</th>`).join('')}<th>YTD</th></tr></thead>`;
    let tbody = `<tbody>`;
    
    years.forEach(year => {
        let rowHtml = `<tr><td style="font-weight:bold; color:var(--accent-cyan); padding: 0.5rem;">${year}</td>`;
        let ytd = 0;
        for(let i=1; i<=12; i++) {
            let val = heatmapRaw[year][i];
            if(val !== undefined) ytd += val;
            
            let color = 'transparent';
            if(val !== undefined) {
                const opacity = Math.min(Math.abs(val) / 50000, 0.8) + 0.1;
                color = val >= 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`;
            }
            let valStr = val !== undefined ? `₹${(val/1000).toFixed(1)}k` : '-';
            rowHtml += `<td style="background-color: ${color}; padding: 0.5rem;">${valStr}</td>`;
        }
        const ytdColor = ytd >= 0 ? `rgba(16, 185, 129, 0.9)` : `rgba(239, 68, 68, 0.9)`;
        rowHtml += `<td style="background-color: ${ytdColor}; font-weight:bold; padding: 0.5rem;">₹${(ytd/1000).toFixed(1)}k</td></tr>`;
        tbody += rowHtml;
    });
    tbody += `</tbody>`;
    table.innerHTML = thead + tbody;
}



// Main Render Function
async function renderDashboard(timing) {
    const data = await fetchDashboardData(timing);
    if (!data) return;
    updateKPICards(data);
    createCharts(timing, data);
    createHeatmap(data);
}

// Tab Switching (Simplified)
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const timing = btn.dataset.timing;
        if (timing) {
            currentTiming = timing;
            renderDashboard(timing);
        }
    });
});

// Remove loading overlay if exists
const overlay = document.querySelector('.loading-overlay');
if (overlay) {
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 1500);
}

// Initial Load
renderDashboard(currentTiming);
