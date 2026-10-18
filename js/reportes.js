// =================================================================
// MÓDULO DE BALANCES FINANCIEROS, AUDITORÍA Y HISTORIAL DE TICKETS
// =================================================================

let reporteDataCache = [];
let bancasCache = [];
let ticketsCache = [];
let loteriasCache = [];
let usuariosCache = [];

function getHoyYMD() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

async function asegurarBancasCache() {
    if (bancasCache.length > 0) return bancasCache;

    if (window.AppState && Array.isArray(window.AppState.bancas) && window.AppState.bancas.length > 0) {
        bancasCache = window.AppState.bancas;
        return bancasCache;
    }

    const supabase = window.supabase;
    if (supabase) {
        try {
            const { data: bancas } = await supabase.from('bancas').select('*');
            if (bancas && bancas.length > 0) {
                bancasCache = bancas;
                window._bancasCache = bancas;
            }
        } catch (e) {
            console.warn("Error al cargar caché de bancas:", e);
        }
    }
    return bancasCache;
}

function normalizarItemsTicket(ticket) {
    if (!ticket) return [];
    let items = ticket.items || ticket.apuestas || ticket.jugadas || ticket.detalles || [];
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    return Array.isArray(items) ? items : [];
}

function obtenerNombreBanca(bancaId, ticket = {}) {
    if (ticket.banca_nombre && !ticket.banca_nombre.includes('-')) return ticket.banca_nombre;
    if (ticket.nombre_banca && !ticket.nombre_banca.includes('-')) return ticket.nombre_banca;
    if (ticket.vendedor_nombre) return ticket.vendedor_nombre;
    if (ticket.banca && typeof ticket.banca === 'string' && !ticket.banca.includes('-')) return ticket.banca;

    const listaBancas = (bancasCache && bancasCache.length > 0) 
        ? bancasCache 
        : (window.AppState?.bancas || window._bancasCache || []);

    const idBuscar = String(bancaId || ticket.banca_id || ticket.banca || '');

    if (idBuscar) {
        const bancaEncontrada = listaBancas.find(b => 
            String(b.id).toLowerCase() === idBuscar.toLowerCase() || 
            String(b.codigo || b.code || b.numero || '').toLowerCase() === idBuscar.toLowerCase() ||
            String(b.username || '').toLowerCase() === idBuscar.toLowerCase()
        );
        if (bancaEncontrada) {
            return bancaEncontrada.nombre_banca || bancaEncontrada.nombre || bancaEncontrada.vendedor_nombre || `Banca ${bancaEncontrada.codigo || bancaEncontrada.id}`;
        }
    }

    if (ticket.banca_numero || ticket.numero_banca) {
        return `Banca ${ticket.banca_numero || ticket.numero_banca}`;
    }

    if (idBuscar.length > 8) {
        return `Banca ${idBuscar.substring(0, 5).toUpperCase()}`;
    }

    // Corrección quirúrgica: Evitar retornar strings vacíos o "undefined" que generen filas fantasma
    const fallbackId = String(idBuscar || '').trim();
    return fallbackId ? `Banca ${fallbackId}` : null;
}

function obtenerObjetoBanca(bancaId, ticket = {}) {
    const listaBancas = (bancasCache && bancasCache.length > 0) 
        ? bancasCache 
        : (window.AppState?.bancas || window._bancasCache || []);

    const idBuscar = String(bancaId || ticket.banca_id || ticket.banca || '');
    return listaBancas.find(b => String(b.id).toLowerCase() === idBuscar.toLowerCase()) || null;
}

export async function initReportesModule() {
    const hoyStr = getHoyYMD();
    const inputDesde = document.getElementById('rep-fecha-desde');
    const inputHasta = document.getElementById('rep-fecha-hasta');

    if (inputDesde && !inputDesde.value) inputDesde.value = hoyStr;
    if (inputHasta && !inputHasta.value) inputHasta.value = hoyStr;

    await asegurarBancasCache();
    await cargarFiltrosDesplegables(); 
    await generarReporte();

    // Vincular listeners automáticos para que los filtros funcionen al instante al seleccionarlos
    ['rep-fecha-desde', 'rep-fecha-hasta', 'rep-filtro-vendedor', 'rep-filtro-zona', 'rep-filtro-supervisor', 'rep-filtro-loteria', 'rep-filtro-jugada'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAttached) {
            el.addEventListener('change', () => generarReporte());
            el.dataset.listenerAttached = 'true';
        }
    });

    const btnConsultar = document.querySelector('button[onclick*="generarReporte"]') || document.getElementById('btn-consultar-auditoria');
    if (btnConsultar) {
        btnConsultar.onclick = (e) => {
            e.preventDefault();
            window.generarReporte();
        };
    }
}
window.initReportesModule = initReportesModule;

// ==========================================================
// CARGA DINÁMICA DE FILTROS DESPLEGABLES
// ==========================================================

async function cargarFiltrosDesplegables() {
    await asegurarBancasCache();
    const supabase = window.supabase;

    try {
        if (supabase && usuariosCache.length === 0) {
            const { data: usrs } = await supabase.from('usuarios').select('*');
            if (usrs) usuariosCache = usrs;
        }

        if (supabase && loteriasCache.length === 0) {
            const { data: sort } = await supabase.from('sorteos').select('*');
            if (sort) loteriasCache = sort;
        }

        // Poblar Vendedores / Bancas
        const selVendedor = document.getElementById('rep-filtro-vendedor');
        if (selVendedor) {
            selVendedor.innerHTML = '<option value="todos">Todos los vendedores</option>';
            bancasCache.forEach(b => {
                const nombre = b.nombre_banca || b.vendedor_nombre || b.name || `Banca #${b.id}`;
                selVendedor.innerHTML += `<option value="${b.id}">${nombre}</option>`;
            });
        }

        // Poblar Zonas
        const selZona = document.getElementById('rep-filtro-zona');
        if (selZona) {
            const zonas = new Set();
            bancasCache.forEach(b => { if (b.zona && String(b.zona).trim() !== '') zonas.add(b.zona.trim()); });
            selZona.innerHTML = '<option value="todas">Todas las zonas</option>';
            zonas.forEach(z => selZona.innerHTML += `<option value="${z}">${z}</option>`);
        }

        // Poblar Supervisores
        const selSupervisor = document.getElementById('rep-filtro-supervisor');
        if (selSupervisor) {
            selSupervisor.innerHTML = '<option value="todos">Todos los supervisores</option>';
            const sups = usuariosCache.filter(u => String(u.rol || u.role).toLowerCase() === 'supervisor' || String(u.rol || u.role).toLowerCase() === 'admin');
            sups.forEach(s => {
                const nombreSup = s.nombre || s.username || s.email || `Supervisor #${s.id}`;
                selSupervisor.innerHTML += `<option value="${s.id}">${nombreSup}</option>`;
            });
        }

        // Poblar Loterías
        const selLoteria = document.getElementById('rep-filtro-loteria');
        if (selLoteria) {
            selLoteria.innerHTML = '<option value="todas">Todas las loterías</option>';
            loteriasCache.forEach(l => {
                const nombreLot = l.nombre || l.name || `Sorteo #${l.id}`;
                selLoteria.innerHTML += `<option value="${l.id}">${nombreLot}</option>`;
            });
        }
    } catch (e) { console.warn("Error cargando filtros desplegables:", e); }
}

// ==========================================================
// RENDERIZADO DE TABLA CON ESTATUS REAL (Supabase)
// ==========================================================

async function renderizarTablaReporte(datos) {
    const tbody = document.getElementById('reports-banca-table-body') || document.getElementById('reportes-table-body') || document.querySelector('.tabla-balances-body');
    if (!tbody) return;

    const datosValidos = (datos || []).filter(d => d && d.vendedor && !d.vendedor.includes('undefined') && !d.vendedor.includes('Null'));
    
    const badgeRegistros = document.getElementById('cant-registros');
    if (badgeRegistros) badgeRegistros.textContent = `${datosValidos.length} Registros`;

    if (datosValidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">No hay ventas registradas con los filtros seleccionados.</td></tr>`;
        return;
    }

    // 1. OBTENER TODO EL HISTORIAL PARA CALCULAR EL BALANCE REAL DE CADA BANCA
    let todosLosTickets = [];
    let todosLosPagos = [];
    try {
        if(window.supabase) {
            const [resTickets, resPagos] = await Promise.all([
                window.supabase.from('tickets').select('banca_id, monto_total, monto_premio, estatus, estado'),
                window.supabase.from('pagos_bancas').select('*')
            ]);
            if (resTickets.data) todosLosTickets = resTickets.data;
            if (resPagos.data) todosLosPagos = resPagos.data;
        }
    } catch (e) {
        console.warn("No se pudieron cargar los datos históricos de Supabase:", e);
    }

    // PRE-CALCULAR EL BALANCE ACTUAL DE CADA BANCA
    const balancesActuales = {};
    const bancasIds = [...new Set(datosValidos.map(d => d.banca_id || d.vendedor))];

    for (const bId of bancasIds) {
        // Encontrar la comisión de esta banca
        let comisionPct = 10;
        const bObj = obtenerObjetoBanca(bId);
        if (bObj && bObj.comision) comisionPct = parseFloat(bObj.comision);

        // Calcular Ventas y Premios Históricos
        const ticketsBanca = todosLosTickets.filter(t => String(t.banca_id) === String(bId) && String(t.estatus).toLowerCase() !== 'cancelado' && String(t.estatus).toLowerCase() !== 'anulado');
        
        let ventasHist = 0; let premiosHist = 0;
        ticketsBanca.forEach(t => {
            ventasHist += parseFloat(t.monto_total || 0);
            const estatus = String(t.estatus || t.estado).toLowerCase();
            if (estatus === 'premiado' || estatus === 'ganador') {
                premiosHist += parseFloat(t.monto_premio || 0);
            }
        });

        const comisionesHist = ventasHist * (comisionPct / 100);

        // Calcular Pagos Históricos
        const pagosBanca = todosLosPagos.filter(p => String(p.banca_id) === String(bId));
        const ingresos = pagosBanca.filter(p => p.tipo === 'ingreso').reduce((sum, p) => sum + parseFloat(p.monto), 0);
        const egresos = pagosBanca.filter(p => p.tipo === 'egreso').reduce((sum, p) => sum + parseFloat(p.monto), 0);

        // Balance Final Real de la Banca
        let balanceBanca = (ventasHist - premiosHist - comisionesHist) - ingresos + egresos;
        balancesActuales[bId] = Math.round(balanceBanca * 100) / 100; // Redondeo para evitar decimales infinitos
    }


    let html = '';
    datosValidos.forEach(d => {
        // Cálculo del balance del día (Venta - Comisión - Premios)
        const resultadoDiaNeto = d.venta - d.comision - d.premios;
        const balanceClass = resultadoDiaNeto >= 0 ? 'text-emerald-400' : 'text-rose-400';

        // LÓGICA CORREGIDA: Si la banca tiene un balance actual de $0.00 (o negativo a su favor), 
        // significa que ha pagado todo su historial, por ende este día está "CUADRADO".
        const bId = d.banca_id || d.vendedor;
        const balanceActualBanca = balancesActuales[bId] || 0;
        
        const estaCuadrado = balanceActualBanca <= 0;

        const estatusLabel = estaCuadrado ? 'CUADRADO' : 'PENDIENTE DE CUADRE';
        const estatusClass = estaCuadrado 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold' 
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold';

        html += `
            <tr class="hover:bg-slate-700/35 transition-all border-b border-slate-700/40 text-xs">
                <td class="p-3 font-mono text-slate-300 capitalize">${d.fecha}</td>
                <td class="p-3 font-bold text-white">${d.vendedor}</td>
                <td class="p-3 text-slate-400">${d.zona}</td>
                <td class="p-3 text-center font-mono text-cyan-400">${d.ticketsCount}</td>
                <td class="p-3 font-mono font-semibold text-white">$${d.venta.toFixed(2)}</td>
                <td class="p-3 font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                <td class="p-3 font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                <td class="p-3 font-mono font-bold ${balanceClass}">$${resultadoDiaNeto.toFixed(2)}</td>
                <td class="p-3 text-center">
                    <span class="text-[10px] px-2.5 py-1 rounded-full uppercase ${estatusClass}">
                        ${estatusLabel}
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ==========================================================
// EXPORTACIÓN EXCEL Y PDF
// ==========================================================

window.exportarReporteExcel = function() {
    if (!reporteDataCache || reporteDataCache.length === 0) {
        return alert("No hay datos para exportar. Consulte el reporte primero.");
    }
    let csvContent = "FECHA;BANCA/VENDEDOR;ZONA;TICKETS;VENTA BRUTA;COMISION;PREMIOS;BALANCE NETO\n";

    reporteDataCache.forEach(d => {
        if (!d || !d.vendedor || d.vendedor.includes('undefined')) return;
        const neto = d.venta - d.comision - d.premios;
        csvContent += `"${d.fecha}";"${d.vendedor}";"${d.zona}";${d.ticketsCount};${d.venta.toFixed(2)};${d.comision.toFixed(2)};${d.premios.toFixed(2)};${neto.toFixed(2)}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Auditoria_${getHoyYMD()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
window.exportarReporteExcel = exportarReporteExcel;

window.imprimirReportePDF = function() {
    if (!reporteDataCache || reporteDataCache.length === 0) {
        return alert("Genere y consulte el reporte en la tabla antes de imprimir el PDF.");
    }

    let filasHTML = '';
    reporteDataCache.forEach(d => {
        if (!d || !d.vendedor || d.vendedor.includes('undefined')) return;
        const neto = d.venta - d.comision - d.premios;
        filasHTML += `
            <tr>
                <td>${d.fecha}</td>
                <td>${d.vendedor}</td>
                <td>${d.zona}</td>
                <td style="text-align:center;">${d.ticketsCount}</td>
                <td style="text-align:right;">$${d.venta.toFixed(2)}</td>
                <td style="text-align:right;">$${d.comision.toFixed(2)}</td>
                <td style="text-align:right;">$${d.premios.toFixed(2)}</td>
                <td style="text-align:right;">$${neto.toFixed(2)}</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank', 'width=900,height=600');
    if (!printWindow) {
        return alert("El navegador bloqueó la ventana emergente. Por favor permita las ventanas emergentes para este sitio.");
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte de Auditoría - BuxyLoto</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                h2 { text-align: center; color: #000; margin-bottom: 5px; }
                p { text-align: center; font-size: 11px; color: #555; margin-bottom: 25px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
                th { background-color: #eee; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>BUXYLOTO POS - REPORTE DE AUDITORÍA FINANCIERA</h2>
            <p>Fecha de emisión: ${new Date().toLocaleString('es-PA')}</p>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Vendedor</th>
                        <th>Zona</th>
                        <th style="text-align:center;">Tickets</th>
                        <th style="text-align:right;">Venta Bruta</th>
                        <th style="text-align:right;">Comisión</th>
                        <th style="text-align:right;">Premios</th>
                        <th style="text-align:right;">Balance Neto</th>
                    </tr>
                </thead>
                <tbody>${filasHTML}</tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
};
window.imprimirReportePDF = imprimirReportePDF;
window.exportarReportePDF = imprimirReportePDF;

// ==========================================================
// CONSULTA PRINCIPAL Y FILTRADO
// ==========================================================

export async function generarReporte() {
    const supabase = window.supabase;
    const tbody = document.getElementById('reports-banca-table-body') || document.getElementById('reportes-table-body') || document.querySelector('.tabla-balances-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-emerald-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando ventas y balances...</td></tr>`;

    const fechaDesde = document.getElementById('rep-fecha-desde')?.value || document.getElementById('reporte-fecha-desde')?.value;
    const fechaHasta = document.getElementById('rep-fecha-hasta')?.value || document.getElementById('reporte-fecha-hasta')?.value;
    const vendedorFiltro = document.getElementById('rep-filtro-vendedor')?.value || document.getElementById('rep-filtro-banca')?.value || 'todos';
    const zonaFiltro = document.getElementById('rep-filtro-zona')?.value || 'todas';
    const supervisorFiltro = document.getElementById('rep-filtro-supervisor')?.value || 'todos';
    const loteriaFiltro = document.getElementById('rep-filtro-loteria')?.value || 'todas';
    const tipoJugadaFiltro = document.getElementById('rep-filtro-jugada')?.value || 'todas';

    await asegurarBancasCache();

    try {
        let query = supabase ? supabase.from('tickets').select('*') : null;
        let resultados = [];

        if (query) {
            if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
            if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

            const { data: tickets, error } = await query;
            if (error) throw error;
            resultados = tickets || [];
        } else {
            resultados = window.AppState?.tickets || [];
        }

        const agrupado = {};
        let totalVentaBruta = 0;
        let totalComisiones = 0;
        let totalPremios = 0;

        resultados.forEach(t => {
            const estado = String(t.estatus || t.status || t.estado || 'pendiente').toLowerCase();
            if (estado === 'cancelado' || estado === 'anulado') return;

            // Filtro por Vendedor
            if (vendedorFiltro !== 'todos' && vendedorFiltro !== '' && String(t.banca_id) !== String(vendedorFiltro)) return;

            // Filtro por Lotería
            if (loteriaFiltro !== 'todas' && loteriaFiltro !== '' && String(t.sorteo_id) !== String(loteriaFiltro)) return;

            const bancaNombre = obtenerNombreBanca(t.banca_id, t);
            if (!bancaNombre || bancaNombre.includes('undefined')) return; // Descarta registros inválidos o fantasmas

            const bancaObj = obtenerObjetoBanca(t.banca_id, t);
            const zonaBanca = bancaObj?.zona || 'Zona General';
            const supervisorBanca = String(bancaObj?.supervisor_id || bancaObj?.supervisor || '').trim();

            // Filtro por Zona
            if (zonaFiltro !== 'todas' && zonaFiltro !== '' && zonaBanca.toLowerCase() !== zonaFiltro.toLowerCase()) return;

            // Filtro por Supervisor
            if (supervisorFiltro !== 'todos' && supervisorFiltro !== '' && supervisorBanca !== String(supervisorFiltro)) return;

            // Filtro por Tipo de Jugada
            const itemsTicket = normalizarItemsTicket(t);
            if (tipoJugadaFiltro !== 'todas' && tipoJugadaFiltro !== '' && tipoJugadaFiltro !== 'todos') {
                const coincideTipo = itemsTicket.some(j => String(j.tipo || '').toLowerCase() === tipoJugadaFiltro.toLowerCase());
                if (!coincideTipo) return;
            }

            const fechaObj = new Date(t.created_at || t.createdAt);
            const fechaKey = isNaN(fechaObj) ? getHoyYMD() : fechaObj.toLocaleDateString('es-PA');
            const key = `${fechaKey}_${t.banca_id || bancaNombre}`;

            if (!agrupado[key]) {
                agrupado[key] = {
                    fecha: fechaKey,
                    vendedor: bancaNombre,
                    banca_id: t.banca_id,
                    zona: zonaBanca,
                    ticketsCount: 0,
                    venta: 0,
                    comision: 0,
                    premios: 0
                };
            }

            const venta = parseFloat(t.monto_total || t.monto || t.total || 0);
            
            let pctComision = 10;
            if (bancaObj && bancaObj.comision !== undefined && bancaObj.comision !== null) {
                pctComision = parseFloat(bancaObj.comision);
            } else if (t.comision_porcentaje !== undefined && t.comision_porcentaje !== null) {
                pctComision = parseFloat(t.comision_porcentaje);
            }

            const comisionMonto = venta * (pctComision / 100);
            
            let premio = parseFloat(t.monto_premio || t.premio_monto || t.premio || 0);
            if (estado === 'premiado' || estado === 'ganador') {
                if (premio === 0 && Array.isArray(itemsTicket)) {
                    itemsTicket.forEach(j => {
                        premio += parseFloat(j.premio || j.monto_premio || 0);
                    });
                }
            } else {
                premio = 0;
            }

            agrupado[key].ticketsCount += 1;
            agrupado[key].venta += venta;
            agrupado[key].comision += comisionMonto;
            agrupado[key].premios += premio;

            totalVentaBruta += venta;
            totalComisiones += comisionMonto;
            totalPremios += premio;
        });

        const balanceNetoTotal = totalVentaBruta - totalComisiones - totalPremios;
        
        const actualizarMétricaDOM = (ids, valor) => {
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = `$${valor.toFixed(2)}`;
            });
        };

        actualizarMétricaDOM(['rep-venta-bruta', 'kpi-rep-venta-bruta', 'venta-bruta-total', 'reporte-venta-bruta'], totalVentaBruta);
        actualizarMétricaDOM(['rep-comisiones', 'kpi-rep-comisiones', 'comisiones-generadas', 'reporte-comisiones'], totalComisiones);
        actualizarMétricaDOM(['rep-premios', 'kpi-rep-premios', 'premios-ganados', 'reporte-premios'], totalPremios);
        actualizarMétricaDOM(['rep-balance-neto', 'kpi-rep-balance-neto', 'resultado-neto-balance', 'reporte-resultado-neto'], balanceNetoTotal);

        reporteDataCache = Object.values(agrupado);
        renderizarTablaReporte(reporteDataCache);

    } catch (err) {
        console.error("❌ Error al consultar reportes:", err);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-400">Error al consultar los registros.</td></tr>`;
    }
}
window.generarReporte = generarReporte;

export function limpiarFiltrosReportes() {
    const hoyStr = getHoyYMD();
    const inputDesde = document.getElementById('rep-fecha-desde');
    const inputHasta = document.getElementById('rep-fecha-hasta');
    const selVendedor = document.getElementById('rep-filtro-vendedor');
    const selZona = document.getElementById('rep-filtro-zona');
    const selSupervisor = document.getElementById('rep-filtro-supervisor');
    const selLoteria = document.getElementById('rep-filtro-loteria');
    const selJugada = document.getElementById('rep-filtro-jugada');

    if (inputDesde) inputDesde.value = hoyStr;
    if (inputHasta) inputHasta.value = hoyStr;
    if (selVendedor) selVendedor.value = 'todos';
    if (selZona) selZona.value = 'todas';
    if (selSupervisor) selSupervisor.value = 'todos';
    if (selLoteria) selLoteria.value = 'todas';
    if (selJugada) selJugada.value = 'todas';

    generarReporte();
}
window.limpiarFiltrosReportes = limpiarFiltrosReportes;

// =================================================================
// MÓDULO DE HISTORIAL DE TICKETS (Intacto)
// =================================================================

export async function initTicketsHistoryModule() {
    const hoyStr = getHoyYMD();
    const dateFrom = document.getElementById('tickets-date-from');
    const dateTo = document.getElementById('tickets-date-to');
    const btnToday = document.getElementById('btn-tickets-today');
    const btnConsultar = document.getElementById('btn-tickets-consultar');
    const searchInput = document.getElementById('tickets-search-input');
    const statusFilter = document.getElementById('tickets-status-filter');

    if (dateFrom && !dateFrom.value) dateFrom.value = hoyStr;
    if (dateTo && !dateTo.value) dateTo.value = hoyStr;

    if (dateFrom) dateFrom.onchange = () => cargarHistorialTickets();
    if (dateTo) dateTo.onchange = () => cargarHistorialTickets();
    if (statusFilter) statusFilter.onchange = () => filtrarYRenderizarTicketsLocal();
    if (searchInput) searchInput.oninput = () => filtrarYRenderizarTicketsLocal();

    if (btnConsultar) {
        btnConsultar.onclick = (e) => {
            e.preventDefault();
            cargarHistorialTickets();
        };
    }

    if (btnToday) {
        btnToday.onclick = (e) => {
            e.preventDefault();
            const hoyActual = getHoyYMD();
            if (dateFrom) dateFrom.value = hoyActual;
            if (dateTo) dateTo.value = hoyActual;
            if (statusFilter) statusFilter.value = 'all';
            if (searchInput) searchInput.value = '';
            cargarHistorialTickets();
        };
    }

    await cargarHistorialTickets();
}
window.initTicketsHistoryModule = initTicketsHistoryModule;

export async function cargarHistorialTickets() {
    const tbody = document.getElementById('tickets-table-body') || document.getElementById('tickets-list-body');
    const dateFromVal = document.getElementById('tickets-date-from')?.value || getHoyYMD();
    const dateToVal = document.getElementById('tickets-date-to')?.value || getHoyYMD();

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-emerald-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando historial de tickets...</td></tr>`;
    }

    await asegurarBancasCache();
    const supabase = window.supabase;

    if (supabase) {
        try {
            const { data, error } = await supabase.from('tickets')
                .select('*')
                .gte('created_at', `${dateFromVal}T00:00:00`)
                .lte('created_at', `${dateToVal}T23:59:59`)
                .order('created_at', { ascending: false });

            if (!error && data) {
                ticketsCache = data;
                filtrarYRenderizarTicketsLocal();
                return;
            }
        } catch (e) {
            console.warn("Error en Supabase:", e);
        }
    }

    const startDate = new Date(`${dateFromVal}T00:00:00`);
    const endDate = new Date(`${dateToVal}T23:59:59`);
    const localTickets = window.AppState?.tickets || [];

    ticketsCache = localTickets.filter(t => {
        if (!t.createdAt && !t.created_at) return false;
        const d = new Date(t.createdAt || t.created_at);
        return d >= startDate && d <= endDate;
    });

    filtrarYRenderizarTicketsLocal();
}
window.cargarHistorialTickets = cargarHistorialTickets;

function filtrarYRenderizarTicketsLocal() {
    const searchVal = (document.getElementById('tickets-search-input')?.value || '').toLowerCase().trim();
    const statusVal = (document.getElementById('tickets-status-filter')?.value || 'all').toLowerCase();

    let filtrados = [...ticketsCache];

    if (statusVal !== 'all') {
        filtrados = filtrados.filter(t => {
            const st = String(t.estatus || t.status || t.estado || 'pendiente').toLowerCase();
            if (statusVal === 'cancelado') return st === 'cancelado' || st === 'anulado';
            if (statusVal === 'premiado' || statusVal === 'ganador') return st === 'premiado' || st === 'ganador';
            if (statusVal === 'no_premiado' || statusVal === 'perdedor') return st === 'no_premiado' || st === 'perdedor';
            if (statusVal === 'pendiente') return st === 'pendiente';
            return st === statusVal;
        });
    }

    if (searchVal !== '') {
        filtrados = filtrados.filter(t => {
            const folio = String(t.codigo_ticket || t.folio || t.ticket_id || t.id || '').toLowerCase();
            const banca = String(obtenerNombreBanca(t.banca_id, t)).toLowerCase();
            return folio.includes(searchVal) || banca.includes(searchVal);
        });
    }

    renderizarTablaTickets(filtrados);
}
window.filtrarYRenderizarTicketsLocal = filtrarYRenderizarTicketsLocal;

function renderizarTablaTickets(lista) {
    const tbody = document.getElementById('tickets-table-body') || document.getElementById('tickets-list-body');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-8 text-slate-400">
                    No se encontraron tickets registrados con los filtros seleccionados.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map((t, idx) => {
        const uniqueId = t.codigo_ticket || t.folio || t.id || idx;
        const fechaObj = new Date(t.created_at || t.createdAt);
        const fecha = isNaN(fechaObj) ? 'N/A' : fechaObj.toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });
        
        const folioDisplay = t.codigo_ticket || t.folio || t.ticket_numero || `#${t.id || uniqueId}`;
        const bancaNombre = obtenerNombreBanca(t.banca_id, t);
        
        const items = normalizarItemsTicket(t);
        const cantJugadas = items.length > 0 ? items.length : 1;

        const montoVenta = parseFloat(t.monto_total || t.monto || t.total || 0).toFixed(2);
        const montoPremio = parseFloat(t.monto_premio || t.premio_monto || t.premio || 0).toFixed(2);
        const estado = String(t.estatus || t.status || t.estado || 'pendiente').toLowerCase();

        let badgeClass = 'bg-amber-900/50 text-amber-300 border-amber-700/50';
        let estadoLabel = 'PENDIENTE';

        if (estado === 'premiado' || estado === 'ganador') {
            badgeClass = 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50';
            estadoLabel = 'PREMIADO';
        } else if (estado === 'cancelado' || estado === 'anulado') {
            badgeClass = 'bg-rose-900/50 text-rose-300 border-rose-700/50';
            estadoLabel = 'CANCELADO';
        } else if (estado === 'no_premiado' || estado === 'perdedor') {
            badgeClass = 'bg-slate-700 text-slate-400 border-slate-600';
            estadoLabel = 'NO PREMIADO';
        }

        const esCancelado = estado === 'cancelado' || estado === 'anulado';

        return `
            <tr class="border-b border-slate-700/40 hover:bg-slate-700/30 transition-all text-xs">
                <td class="p-3 font-mono text-emerald-400 font-bold">${folioDisplay}</td>
                <td class="p-3 text-slate-300">${fecha}</td>
                <td class="p-3 text-slate-200 font-semibold">${bancaNombre}</td>
                <td class="p-3 text-center font-mono text-slate-300">${cantJugadas} ap.</td>
                <td class="p-3 text-right font-mono font-bold text-white">$${montoVenta}</td>
                <td class="p-3 text-right font-mono font-bold text-emerald-400">$${montoPremio}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                        ${estadoLabel}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="window.verTicketHistorial('${uniqueId}')" title="Ver Detalle Ticket" class="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg transition-colors text-xs">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button onclick="window.imprimirTicketHistorial('${uniqueId}')" title="Reimprimir Ticket" class="bg-emerald-700/80 hover:bg-emerald-600 text-white p-1.5 rounded-lg transition-colors text-xs">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        ${!esCancelado ? `
                        <button onclick="window.cancelarTicketHistorial('${uniqueId}')" title="Anular / Cancelar Ticket" class="bg-rose-700/80 hover:bg-rose-600 text-white p-1.5 rounded-lg transition-colors text-xs">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                        ` : `
                        <button disabled title="Ticket ya cancelado" class="bg-slate-800 text-slate-600 p-1.5 rounded-lg cursor-not-allowed text-xs">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function buscarTicketEnCache(targetId) {
    return ticketsCache.find(t => 
        String(t.codigo_ticket) === String(targetId) ||
        String(t.id) === String(targetId) || 
        String(t.folio) === String(targetId) ||
        String(t.ticket_numero) === String(targetId)
    );
}

window.verTicketHistorial = async function(uniqueId) {
    const ticket = buscarTicketEnCache(uniqueId);
    if (!ticket) {
        alert("No se encontró el detalle del ticket seleccionado.");
        return;
    }

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    let items = normalizarItemsTicket(ticket);

    if ((!items || items.length === 0) && supabase) {
        try {
            const { data: jugadasBD } = await supabase.from('jugadas').select('*').eq('ticket_id', ticket.id);
            if (jugadasBD && jugadasBD.length > 0) {
                items = jugadasBD.map(j => ({
                    type: (j.tipo || 'DIRECTO').toUpperCase(),
                    number: j.numero || '',
                    amount: parseFloat(j.monto || 0)
                }));
            }
        } catch (e) {}
    }

    let loteriaNombre = ticket.sorteo_nombre || ticket.sorteo || 'Sorteo General';
    if ((!loteriaNombre || loteriaNombre === 'N/A') && ticket.sorteo_id && supabase) {
        try {
            const { data: s } = await supabase.from('sorteos').select('nombre').eq('id', ticket.sorteo_id).maybeSingle();
            if (s && s.nombre) loteriaNombre = s.nombre;
        } catch (e) {}
    }

    const ticketParaPOSModal = {
        id: ticket.id,
        folio: ticket.codigo_ticket || ticket.folio || ticket.id,
        createdAt: ticket.created_at || ticket.createdAt || new Date().toISOString(),
        bancaId: ticket.banca_id,
        bancaNombre: obtenerNombreBanca(ticket.banca_id, ticket),
        loteriaIds: [ticket.sorteo_id],
        loteriaNombre: loteriaNombre,
        sorteo_nombre: loteriaNombre,
        items: items,
        total: parseFloat(ticket.monto_total || ticket.monto || ticket.total || 0),
        status: String(ticket.estatus || ticket.estado || 'pendiente').toLowerCase(),
        esCopia: true
    };

    try {
        const fnModal = typeof showTicketModal === 'function' ? showTicketModal : window.showTicketModal;
        if (typeof fnModal === 'function') {
            fnModal(ticketParaPOSModal);
        } else {
            alert(`Ticket #${ticketParaPOSModal.folio} - Total: $${ticketParaPOSModal.total.toFixed(2)}`);
        }
    } catch (err) {
        console.error("Error al abrir modal del ticket:", err);
    }
};

window.cancelarTicketHistorial = async function(uniqueId) {
    const ticket = buscarTicketEnCache(uniqueId);
    const folioTarget = ticket ? (ticket.codigo_ticket || ticket.folio || ticket.id) : uniqueId;

    if (!folioTarget) return alert("Ticket no encontrado.");
    if (!confirm(`¿Está seguro de que desea cancelar el ticket #${folioTarget}?`)) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) throw new Error("Cliente de Supabase no disponible.");

        const { data, error } = await supabase.rpc('cancelar_ticket_universal', { p_referencia: String(folioTarget).trim() });
        if (error) throw error;

        if (data && data.success) {
            alert(`✅ ${data.message}`);
            await cargarHistorialTickets();
        } else {
            alert(`⚠️ ${data?.message || 'No se pudo cancelar el ticket.'}`);
        }
    } catch (err) {
        console.error("Error al cancelar ticket:", err);
        alert("❌ Error: " + err.message);
    }
};

window.imprimirTicketHistorial = async function(uniqueId) {
    const ticket = buscarTicketEnCache(uniqueId);
    if (!ticket) return alert("No se encontró el ticket.");
    window.verTicketHistorial(uniqueId);
};

// Corrección robusta para prevenir que la sección se quede colgada o flotando en otras vistas
document.addEventListener('DOMContentLoaded', () => {
    const ticketSection = document.getElementById('section-reports');
    if (ticketSection) {
        const observerTickets = new MutationObserver(() => {
            if (ticketSection.classList.contains('hidden')) {
                ticketSection.style.display = 'none';
            } else {
                ticketSection.style.display = 'block';
            }
        });
        observerTickets.observe(ticketSection, { attributes: true, attributeFilter: ['class'] });
    }
});

// Asignaciones globales
window.initReportesModule = initReportesModule;
window.generarReporte = generarReporte;
window.limpiarFiltrosReportes = limpiarFiltrosReportes;
window.exportarReporteExcel = exportarReporteExcel;
window.imprimirReportePDF = imprimirReportePDF;
window.exportarReportePDF = imprimirReportePDF;
window.initTicketsHistoryModule = initTicketsHistoryModule;
window.cargarHistorialTickets = cargarHistorialTickets;
window.filtrarYRenderizarTicketsLocal = filtrarYRenderizarTicketsLocal;