export async function cargarModuloVentas() {
    const tbody = document.getElementById('tabla-ventas-body');
    if (!tbody) return;

    const fechaDesde = document.getElementById('ventas-fecha-desde')?.value || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const fechaHasta = document.getElementById('ventas-fecha-hasta')?.value || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    
    document.getElementById('ventas-fecha-desde').value = fechaDesde;
    document.getElementById('ventas-fecha-hasta').value = fechaHasta;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-emerald-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Calculando rentabilidad...</td></tr>`;

    try {
        const supabase = window.supabaseClient || window.supabase;
        
        // 1. Cargar Bancas para las comisiones
        let queryBancas = supabase.from('bancas').select('id, nombre_banca, vendedor_nombre, comision');
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null') {
            queryBancas = queryBancas.eq('inquilino_id', inquilinoId);
        } else {
            queryBancas = queryBancas.is('inquilino_id', null);
        }
        const { data: bancas } = await queryBancas;

        // 2. Cargar Tickets
        let queryTickets = supabase.from('tickets').select('*')
            .gte('created_at', `${fechaDesde}T00:00:00`)
            .lte('created_at', `${fechaHasta}T23:59:59`);
        if (inquilinoId && inquilinoId !== 'null') {
            queryTickets = queryTickets.eq('inquilino_id', inquilinoId);
        } else {
            queryTickets = queryTickets.is('inquilino_id', null);
        }
        
        const { data: tickets, error } = await queryTickets;
        if (error) throw error;

        let totVentas = 0, totComision = 0, totPremios = 0;
        let countEmitidos = 0, countGanadores = 0, countCancelados = 0;
        const agrupadoPorBanca = {};

        (tickets || []).forEach(t => {
            const estado = String(t.estatus || t.estado || '').toLowerCase();
            if (estado === 'cancelado' || estado === 'anulado') {
                countCancelados++;
                return;
            }

            countEmitidos++;
            if (estado === 'premiado' || estado === 'ganador') countGanadores++;

            const bancaId = String(t.banca_id);
            const bancaInfo = (bancas || []).find(b => String(b.id) === bancaId) || {};
            const nombreBanca = bancaInfo.nombre_banca || bancaInfo.vendedor_nombre || `Banca ${bancaId}`;
            const pctComision = parseFloat(t.comision_porcentaje || bancaInfo.comision || 10) / 100;

            const venta = parseFloat(t.monto_total || t.monto || 0);
            const comision = venta * pctComision;
            let premio = 0;
            if (estado === 'premiado' || estado === 'ganador') {
                premio = parseFloat(t.monto_premio || t.premio || 0);
            }

            totVentas += venta;
            totComision += comision;
            totPremios += premio;

            const fechaStr = new Date(t.created_at).toLocaleDateString('es-PA');
            const key = `${fechaStr}_${bancaId}`;

            if (!agrupadoPorBanca[key]) {
                agrupadoPorBanca[key] = { fecha: fechaStr, banca: nombreBanca, tickets: 0, ventas: 0, comision: 0, premios: 0 };
            }
            agrupadoPorBanca[key].tickets++;
            agrupadoPorBanca[key].ventas += venta;
            agrupadoPorBanca[key].comision += comision;
            agrupadoPorBanca[key].premios += premio;
        });

        const rentabilidad = totVentas - totComision - totPremios;
        
        // Actualizar KPIs Superiores
        document.getElementById('kpi-ventas-total').textContent = `$${totVentas.toFixed(2)}`;
        document.getElementById('kpi-ventas-comision').textContent = `$${totComision.toFixed(2)}`;
        document.getElementById('kpi-ventas-premios').textContent = `$${totPremios.toFixed(2)}`;
        
        const kpiNeta = document.getElementById('kpi-ventas-neta');
        kpiNeta.textContent = `$${rentabilidad.toFixed(2)}`;
        kpiNeta.className = `text-xl font-black mt-1 ${rentabilidad >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;

        document.getElementById('kpi-tickets-emitidos').textContent = countEmitidos;
        document.getElementById('kpi-tickets-ganadores').textContent = countGanadores;
        document.getElementById('kpi-tickets-cancelados').textContent = countCancelados;

        // Renderizar Tabla
        const lista = Object.values(agrupadoPorBanca).sort((a, b) => b.ventas - a.ventas);
        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">No hay ventas en este periodo.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(d => {
            const neto = d.ventas - d.comision - d.premios;
            const colorNeto = neto >= 0 ? 'text-emerald-400' : 'text-rose-400';
            return `
                <tr class="hover:bg-slate-700/40 border-b border-slate-700/50">
                    <td class="p-4 text-slate-400 font-mono">${d.fecha}</td>
                    <td class="p-4 font-bold text-white">${d.banca}</td>
                    <td class="p-4 text-center text-cyan-400 font-mono">${d.tickets}</td>
                    <td class="p-4 text-right font-mono font-bold text-white">$${d.ventas.toFixed(2)}</td>
                    <td class="p-4 text-right font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                    <td class="p-4 text-right font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                    <td class="p-4 text-right font-mono font-black ${colorNeto}">$${neto.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error cargando ventas:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error al procesar las ventas.</td></tr>`;
    }
}
window.cargarModuloVentas = cargarModuloVentas;

// Inicializador automático al abrir la pestaña
document.addEventListener('DOMContentLoaded', () => {
    const linkVentas = document.querySelector('[data-target="section-ventas"]');
    if (linkVentas) {
        linkVentas.addEventListener('click', () => {
            setTimeout(() => window.cargarModuloVentas(), 200);
        });
    }
});