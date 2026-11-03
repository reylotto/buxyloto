export async function cargarModuloVentas() {
    const tbody = document.getElementById('tabla-ventas-body');
    if (!tbody) return;

    const fechaDesde = document.getElementById('ventas-fecha-desde')?.value || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const fechaHasta = document.getElementById('ventas-fecha-hasta')?.value || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const filtroZona = document.getElementById('ventas-filtro-zona')?.value || 'todas';
    const filtroVendedor = document.getElementById('ventas-filtro-vendedor')?.value || 'todos';

    document.getElementById('ventas-fecha-desde').value = fechaDesde;
    document.getElementById('ventas-fecha-hasta').value = fechaHasta;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-emerald-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Calculando ventas...</td></tr>`;

    try {
        const supabase = window.supabaseClient || window.supabase;
        
        // 1. Cargar Bancas (Aislamiento Inquilino)
        let queryBancas = supabase.from('bancas').select('id, nombre_banca, vendedor_nombre, comision, zona');
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId.trim() !== '') {
            queryBancas = queryBancas.eq('inquilino_id', inquilinoId);
        } else {
            queryBancas = queryBancas.is('inquilino_id', null);
        }
        const { data: bancas } = await queryBancas;

        // Poblar filtros de zona combinando Bancas y Usuarios (CON ESCUDO MULTI-TENANT)
        const selZona = document.getElementById('ventas-filtro-zona');
        const selVendedor = document.getElementById('ventas-filtro-vendedor');
        
        if (selZona && selZona.options.length <= 1) {
            const zonas = new Set();
            
            // 1. Zonas de las bancas (Bancas ya venía filtrado por inquilino arriba)
            (bancas || []).forEach(b => { 
                if (b.zona && String(b.zona).trim() !== '') zonas.add(String(b.zona).trim()); 
            });
            
            // 2. Zonas de los usuarios (Supervisores) - 🔥 BLINDAJE INYECTADO AQUÍ
            let queryUsuarios = supabase.from('usuarios').select('zona').not('zona', 'is', null);
            if (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '') {
                queryUsuarios = queryUsuarios.eq('inquilino_id', inquilinoId);
            } else {
                queryUsuarios = queryUsuarios.is('inquilino_id', null);
            }
            const { data: usuarios } = await queryUsuarios;
            
            (usuarios || []).forEach(u => { 
                if (u.zona && String(u.zona).trim() !== '') zonas.add(String(u.zona).trim()); 
            });
            
            // Ordenar alfabéticamente e inyectar
            Array.from(zonas).sort().forEach(z => {
                selZona.innerHTML += `<option value="${z}">${z}</option>`;
            });
        }
        if (selVendedor && selVendedor.options.length <= 1) {
            (bancas || []).forEach(b => {
                const nombre = b.nombre_banca || b.vendedor_nombre || `Banca #${b.id}`;
                selVendedor.innerHTML += `<option value="${b.id}">${nombre}</option>`;
            });
        }

        // 2. Cargar Tickets
        let queryTickets = supabase.from('tickets').select('*')
            .gte('created_at', `${fechaDesde}T00:00:00`)
            .lte('created_at', `${fechaHasta}T23:59:59`);
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId.trim() !== '') {
            queryTickets = queryTickets.eq('inquilino_id', inquilinoId);
        } else {
            queryTickets = queryTickets.is('inquilino_id', null);
        }
        
        const { data: tickets, error } = await queryTickets;
        if (error) throw error;

        let totVentas = 0, totComision = 0, totPremios = 0;
        let countEmitidos = 0, countGanadores = 0, countCancelados = 0;
        const agrupado = {};

        (tickets || []).forEach(t => {
            const estado = String(t.estatus || t.estado || '').toLowerCase();
            if (estado === 'cancelado' || estado === 'anulado') {
                countCancelados++; return;
            }

            const bancaId = String(t.banca_id);
            const bancaInfo = (bancas || []).find(b => String(b.id) === bancaId) || {};
            const zonaBanca = bancaInfo.zona || 'General';
            
            // Aplicar Filtros Visuales
            if (filtroZona !== 'todas' && zonaBanca !== filtroZona) return;
            if (filtroVendedor !== 'todos' && bancaId !== filtroVendedor) return;

            countEmitidos++;
            if (estado === 'premiado' || estado === 'ganador') countGanadores++;

            const nombreBanca = bancaInfo.nombre_banca || bancaInfo.vendedor_nombre || `Banca ${bancaId}`;
            const pctComision = parseFloat(t.comision_porcentaje || bancaInfo.comision || 10) / 100;
            const venta = parseFloat(t.monto_total || t.monto || 0);
            const comision = venta * pctComision;
            const premio = (estado === 'premiado' || estado === 'ganador') ? parseFloat(t.monto_premio || t.premio || 0) : 0;

            totVentas += venta; totComision += comision; totPremios += premio;

            const fechaStr = new Date(t.created_at).toLocaleDateString('es-PA');
            const key = `${fechaStr}_${bancaId}`;

            if (!agrupado[key]) {
                agrupado[key] = { fecha: fechaStr, zona: zonaBanca, banca: nombreBanca, tickets: 0, ventas: 0, comision: 0, premios: 0 };
            }
            agrupado[key].tickets++;
            agrupado[key].ventas += venta;
            agrupado[key].comision += comision;
            agrupado[key].premios += premio;
        });

        const rentabilidad = totVentas - totComision - totPremios;
        
        // Actualizar KPIs Superiores
        document.getElementById('kpi-ventas-total').textContent = `$${totVentas.toFixed(2)}`;
        document.getElementById('kpi-ventas-comision').textContent = `$${totComision.toFixed(2)}`;
        document.getElementById('kpi-ventas-premios').textContent = `$${totPremios.toFixed(2)}`;
        const kpiNeta = document.getElementById('kpi-ventas-neta');
        kpiNeta.textContent = `$${rentabilidad.toFixed(2)}`;
        kpiNeta.className = `text-2xl font-bold mt-1 ${rentabilidad >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
        document.getElementById('kpi-tickets-emitidos').textContent = countEmitidos;
        document.getElementById('kpi-tickets-ganadores').textContent = countGanadores;
        document.getElementById('kpi-tickets-cancelados').textContent = countCancelados;

        // Renderizar Tabla
        const lista = Object.values(agrupado).sort((a, b) => b.ventas - a.ventas);
        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">No hay ventas con estos filtros.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(d => {
            const neto = d.ventas - d.comision - d.premios;
            const colorNeto = neto >= 0 ? 'text-emerald-400' : 'text-rose-400';
            return `
                <tr class="hover:bg-slate-700/40 border-b border-slate-700/50">
                    <td class="p-3 pl-4 text-slate-400 font-mono">${d.fecha}</td>
                    <td class="p-3 text-slate-400">${d.zona}</td>
                    <td class="p-3 font-bold text-white">${d.banca}</td>
                    <td class="p-3 text-center text-cyan-400 font-mono">${d.tickets}</td>
                    <td class="p-3 text-right font-mono font-bold text-white">$${d.ventas.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                    <td class="p-3 pr-4 text-right font-mono font-black ${colorNeto}">$${neto.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error cargando ventas:", err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-500">Error al procesar las ventas.</td></tr>`;
    }
}
window.cargarModuloVentas = cargarModuloVentas;

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('[data-section="section-ventas"]');
    navLinks.forEach(link => {
        link.addEventListener('click', () => { setTimeout(() => window.cargarModuloVentas(), 200); });
    });
});