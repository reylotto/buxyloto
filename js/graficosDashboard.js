// ==========================================================
// MÓDULO EXCLUSIVO DE GRÁFICOS Y BALANCES DE SORTEO (js/graficosDashboard.js)
// ==========================================================

let instanceChartBancas = null;
let instanceChartSorteos = null;

/**
 * Función principal para procesar tickets y actualizar todos los gráficos
 * @param {Array} tickets - Lista de tickets del día (excluyendo cancelados)
 */
export function renderizarGraficosCompletos(tickets = []) {
    if (typeof Chart === 'undefined') {
        console.warn("⚠️ Chart.js no está disponible en la página.");
        return;
    }

    // Filtrar para asegurar que no se contabilicen cancelados
    const ticketsValidos = tickets.filter(t => {
        const est = String(t.estatus || t.estado || '').toLowerCase();
        return est !== 'cancelado' && est !== 'anulado';
    });

    renderizarGraficoVentaYGananciaBancas(ticketsValidos);
    renderizarGraficoDistribucionYBalanceSorteos(ticketsValidos);
}
window.renderizarGraficosCompletos = renderizarGraficosCompletos;

// ----------------------------------------------------------
// 1. GRÁFICO DE VENTAS Y COMISIONES POR BANCA / VENDEDOR
// ----------------------------------------------------------
function renderizarGraficoVentaYGananciaBancas(tickets) {
    const canvas = document.getElementById('chart-ventas-vendedor') || 
                   document.getElementById('chartVentasBanca');
    if (!canvas) return;

    const bancasMap = {};
    const bancasCache = window._bancasCache || [];

    tickets.forEach(t => {
        let nombre = t.banca_nombre || t.vendedor_nombre || t.banca || t.vendedor || '';
        if (!nombre && (t.banca_id || t.usuario_id)) {
            const bId = String(t.banca_id || t.usuario_id);
            const encontrada = bancasCache.find(b => String(b.id) === bId);
            if (encontrada) nombre = encontrada.nombre_banca || encontrada.vendedor_nombre;
        }
        if (!nombre) nombre = 'Banca General';

        const monto = parseFloat(t.total || t.monto || t.monto_total || 0);
        bancasMap[nombre] = (bancasMap[nombre] || 0) + monto;
    });

    const labels = Object.keys(bancasMap);
    const dataVentas = Object.values(bancasMap);

    if (instanceChartBancas) {
        instanceChartBancas.destroy();
    }

    const ctx = canvas.getContext('2d');
    instanceChartBancas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sin Datos'],
            datasets: [{
                label: 'Ventas Totales ($)',
                data: dataVentas.length ? dataVentas : [0],
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Venta: $${Number(ctx.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });
}

// ----------------------------------------------------------
// 2. GRÁFICO DE DISTRIBUCIÓN Y GANANCIA/PÉRDIDA POR SORTEO
// ----------------------------------------------------------
function renderizarGraficoDistribucionYBalanceSorteos(tickets) {
    const canvas = document.getElementById('chart-distribucion-sorteo') || 
                   document.getElementById('chartDistribucionSorteo');
    if (!canvas) return;

    const sorteosMap = {};

    tickets.forEach(t => {
        const nombreSorteo = t.sorteo_nombre || t.sorteo || t.nombre_sorteo || 'Sorteo General';
        const montoVenta = parseFloat(t.total || t.monto || t.monto_total || 0);
        
        let montoPremio = parseFloat(t.premio || t.monto_premio || t.total_premio || 0);
        const est = String(t.estatus || t.estado || '').toLowerCase();
        
        if (est === 'premiado' || est === 'ganador') {
            if (montoPremio === 0 && Array.isArray(t.jugadas || t.detalles)) {
                (t.jugadas || t.detalles).forEach(j => {
                    montoPremio += parseFloat(j.premio || j.monto_premio || 0);
                });
            }
        } else {
            montoPremio = 0;
        }

        if (!sorteosMap[nombreSorteo]) {
            sorteosMap[nombreSorteo] = { venta: 0, premios: 0, balance: 0 };
        }

        sorteosMap[nombreSorteo].venta += montoVenta;
        sorteosMap[nombreSorteo].premios += montoPremio;
        sorteosMap[nombreSorteo].balance = sorteosMap[nombreSorteo].venta - sorteosMap[nombreSorteo].premios;
    });

    const labels = Object.keys(sorteosMap);
    const dataVentas = labels.map(l => sorteosMap[l].venta);
    const dataBalances = labels.map(l => sorteosMap[l].balance);

    // Asignar colores según si el sorteo tuvo ganancia (verde) o pérdida (rojo)
    const backgroundColors = dataBalances.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(244, 63, 94, 0.8)');
    const borderColors = dataBalances.map(b => b >= 0 ? '#10b981' : '#f43f5e');

    if (instanceChartSorteos) {
        instanceChartSorteos.destroy();
    }

    const ctx = canvas.getContext('2d');
    instanceChartSorteos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sin Datos'],
            datasets: [{
                label: 'Ventas por Sorteo ($)',
                data: dataVentas.length ? dataVentas : [1],
                backgroundColor: [
                    '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'
                ],
                borderWidth: 2,
                borderColor: '#0f172a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.label || '';
                            const info = sorteosMap[label];
                            if (!info) return `${label}: $${ctx.raw}`;
                            const estadoStr = info.balance >= 0 ? 'GANANCIA' : 'PÉRDIDA';
                            return [
                                ` Venta Total: $${info.venta.toFixed(2)}`,
                                ` Premios Pagados: $${info.premios.toFixed(2)}`,
                                ` Balance (${estadoStr}): $${info.balance.toFixed(2)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}