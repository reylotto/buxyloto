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

    return `Banca ${idBuscar || 'Central'}`;
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

    await cargarFiltrosDesplegables();
    await generarReporte();
}

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

        const selVendedor = document.getElementById('rep-filtro-vendedor') || document.getElementById('rep-filtro-banca');
        if (selVendedor && bancasCache.length > 0) {
            selVendedor.innerHTML = '<option value="todos">Todas las bancas / vendedores</option>';
            bancasCache.forEach(b => {
                const nom = b.nombre_banca || b.vendedor_nombre || b.nombre || `Banca #${b.id}`;
                selVendedor.innerHTML += `<option value="${b.id}">${nom}</option>`;
            });
        }

        const selZona = document.getElementById('rep-filtro-zona');
        if (selZona && bancasCache.length > 0) {
            const zonas = new Set();
            bancasCache.forEach(b => { if (b.zona && String(b.zona).trim() !== '') zonas.add(b.zona.trim()); });
            selZona.innerHTML = '<option value="todas">Todas las zonas</option>';
            zonas.forEach(z => selZona.innerHTML += `<option value="${z}">${z}</option>`);
        }

        const selSupervisor = document.getElementById('rep-filtro-supervisor');
        if (selSupervisor) {
            selSupervisor.innerHTML = '<option value="todos">Todos los supervisores</option>';
            const supervisores = usuariosCache.filter(u => String(u.rol || u.role).toLowerCase() === 'supervisor');
            supervisores.forEach(sup => {
                selSupervisor.innerHTML += `<option value="${sup.id}">${sup.nombre || sup.username || sup.email}</option>`;
            });
        }

        const selLoteria = document.getElementById('rep-filtro-loteria');
        if (selLoteria && loteriasCache.length > 0) {
            selLoteria.innerHTML = '<option value="todas">Todas las loterías</option>';
            loteriasCache.forEach(s => {
                selLoteria.innerHTML += `<option value="${s.id}">${s.nombre || s.descripcion}</option>`;
            });
        }

    } catch (e) {
        console.warn("Error cargando filtros desplegables de reportes:", e);
    }
}

export async function generarReporte() {
    const supabase = window.supabase;
    const tbody = document.getElementById('reports-banca-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-emerald-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando ventas y balances...</td></tr>`;

    const fechaDesde = document.getElementById('rep-fecha-desde')?.value;
    const fechaHasta = document.getElementById('rep-fecha-hasta')?.value;
    const vendedorFiltro = document.getElementById('rep-filtro-vendedor')?.value || 'todos';
    const zonaFiltro = document.getElementById('rep-filtro-zona')?.value || 'todas';
    const loteriaFiltro = document.getElementById('rep-filtro-loteria')?.value || 'todas';

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

            if (vendedorFiltro !== 'todos' && String(t.banca_id) !== String(vendedorFiltro)) return;
            if (loteriaFiltro !== 'todas' && String(t.sorteo_id) !== String(loteriaFiltro)) return;

            const bancaObj = obtenerObjetoBanca(t.banca_id, t);
            const bancaNombre = obtenerNombreBanca(t.banca_id, t);
            const zonaBanca = bancaObj?.zona || 'N/A';

            if (zonaFiltro !== 'todas' && zonaBanca !== zonaFiltro) return;

            const fechaObj = new Date(t.created_at || t.createdAt);
            const fechaKey = isNaN(fechaObj) ? getHoyYMD() : fechaObj.toLocaleDateString('es-PA');
            const key = `${fechaKey}_${bancaNombre}`;

            if (!agrupado[key]) {
                agrupado[key] = {
                    fecha: fechaKey,
                    vendedor: bancaNombre,
                    zona: zonaBanca,
                    supervisor: 'N/A',
                    ticketsCount: 0,
                    venta: 0,
                    comision: 0,
                    premios: 0
                };
            }

            const venta = parseFloat(t.monto_total || t.monto || t.total || 0);
            
            let pctComision = 15;
            if (bancaObj && bancaObj.comision !== undefined && bancaObj.comision !== null) {
                pctComision = parseFloat(bancaObj.comision);
            } else if (t.comision_porcentaje) {
                pctComision = parseFloat(t.comision_porcentaje);
            }

            const comisionMonto = t.comision_monto ? parseFloat(t.comision_monto) : (venta * (pctComision / 100));
            const premio = parseFloat(t.monto_premio || t.premio_monto || t.premio || 0);

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

        actualizarMétricaDOM(['rep-venta-bruta', 'kpi-rep-venta-bruta', 'venta-bruta-total'], totalVentaBruta);
        actualizarMétricaDOM(['rep-comisiones', 'kpi-rep-comisiones', 'comisiones-generadas'], totalComisiones);
        actualizarMétricaDOM(['rep-premios', 'kpi-rep-premios', 'premios-ganados'], totalPremios);
        actualizarMétricaDOM(['rep-balance-neto', 'kpi-rep-balance-neto', 'resultado-neto-balance'], balanceNetoTotal);

        reporteDataCache = Object.values(agrupado);
        renderizarTablaReporte(reporteDataCache);

    } catch (err) {
        console.error("❌ Error al consultar reportes:", err);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-400">Error al consultar los registros.</td></tr>`;
    }
}

function renderizarTablaReporte(datos) {
    const tbody = document.getElementById('reports-banca-table-body');
    if (!tbody) return;

    if (!datos || datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">No hay ventas registradas con los filtros seleccionados.</td></tr>`;
        return;
    }

    let html = '';
    datos.forEach(d => {
        const balanceNeto = d.venta - d.comision - d.premios;
        const balanceClass = balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400';

        html += `
            <tr class="hover:bg-slate-700/30 transition-all border-b border-slate-700/40">
                <td class="p-3 font-mono text-slate-300 capitalize">${d.fecha}</td>
                <td class="p-3 font-bold text-white">${d.vendedor}</td>
                <td class="p-3 text-slate-400">${d.zona}</td>
                <td class="p-3 text-center font-mono text-slate-300">${d.ticketsCount}</td>
                <td class="p-3 text-right font-mono font-semibold text-emerald-400">$${d.venta.toFixed(2)}</td>
                <td class="p-3 text-right font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                <td class="p-3 text-right font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                <td class="p-3 text-right font-mono font-bold ${balanceClass}">$${balanceNeto.toFixed(2)}</td>
                <td class="p-3 text-center">
                    <span class="bg-slate-700 text-slate-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase">
                        ${balanceNeto >= 0 ? 'A Favor Casa' : 'A Favor Banca'}
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function limpiarFiltrosReportes() {
    const hoyStr = getHoyYMD();
    const inputDesde = document.getElementById('rep-fecha-desde');
    const inputHasta = document.getElementById('rep-fecha-hasta');
    const selVendedor = document.getElementById('rep-filtro-vendedor') || document.getElementById('rep-filtro-banca');
    const selZona = document.getElementById('rep-filtro-zona');
    const selSupervisor = document.getElementById('rep-filtro-supervisor');
    const selLoteria = document.getElementById('rep-filtro-loteria');

    if (inputDesde) inputDesde.value = hoyStr;
    if (inputHasta) inputHasta.value = hoyStr;
    if (selVendedor) selVendedor.value = 'todos';
    if (selZona) selZona.value = 'todas';
    if (selSupervisor) selSupervisor.value = 'todos';
    if (selLoteria) selLoteria.value = 'todas';

    generarReporte();
}

export function exportarReporteExcel() {
    if (!reporteDataCache || reporteDataCache.length === 0) {
        alert("No hay datos para exportar en este momento.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,FECHA,BANCA/VENDEDOR,ZONA,TICKETS,VENTA TOTAL,COMISIÓN,PREMIOS,BALANCE NETO\n";

    reporteDataCache.forEach(d => {
        const net = d.venta - d.comision - d.premios;
        csvContent += `"${d.fecha}","${d.vendedor}","${d.zona}",${d.ticketsCount},${d.venta.toFixed(2)},${d.comision.toFixed(2)},${d.premios.toFixed(2)},${net.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Ventas_${getHoyYMD()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function imprimirReportePDF() {
    const tbody = document.getElementById('reports-banca-table-body');
    if (!tbody || !tbody.innerHTML.includes('tr')) {
        alert("No hay datos en la tabla para imprimir.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert("Por favor permita las ventanas emergentes para imprimir el reporte.");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte de Balances y Cuadres - ${getHoyYMD()}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
                h2 { text-align: center; color: #0f172a; margin-bottom: 5px; }
                p.sub { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                th { background-color: #f1f5f9; font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
            </style>
        </head>
        <body>
            <h2>🎰 BUXYLOTO POS - DESGLOSE FINANCIERO</h2>
            <p class="sub">Fecha de emisión: ${new Date().toLocaleString('es-PA')}</p>
            <table>
                <thead>
                    <tr>
                        <th>FECHA</th>
                        <th>BANCA / VENDEDOR</th>
                        <th>ZONA</th>
                        <th class="text-center">TICKETS</th>
                        <th class="text-right">VENTA TOTAL</th>
                        <th class="text-right">COMISIÓN</th>
                        <th class="text-right">PREMIOS</th>
                        <th class="text-right">BALANCE NETO</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbody.innerHTML}
                </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); setTimeout(() => window.close(), 500); };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// =================================================================
// MÓDULO DE HISTORIAL DE TICKETS (ACCIONES: VER, IMPRIMIR, CANCELAR)
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
            console.warn("Error en Supabase, usando estado local:", e);
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
            <tr class="border-b border-slate-700/40 hover:bg-slate-700/30 transition-all">
                <td class="p-3 font-mono text-emerald-400 font-bold text-xs">${folioDisplay}</td>
                <td class="p-3 text-xs text-slate-300">${fecha}</td>
                <td class="p-3 text-xs text-slate-200 font-semibold">${bancaNombre}</td>
                <td class="p-3 text-center text-xs font-mono text-slate-300">${cantJugadas} ap.</td>
                <td class="p-3 text-right font-mono font-bold text-white text-xs">$${montoVenta}</td>
                <td class="p-3 text-right font-mono font-bold text-emerald-400 text-xs">$${montoPremio}</td>
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

// ==========================================================
// VISUALIZACIÓN DEL TICKET DESDE EL HISTORIAL
// ==========================================================
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
            const { data: jugadasBD } = await supabase
                .from('jugadas')
                .select('*')
                .eq('ticket_id', ticket.id);
            if (jugadasBD && jugadasBD.length > 0) {
                items = jugadasBD.map(j => ({
                    type: (j.tipo || 'DIRECTO').toUpperCase(),
                    number: j.numero || j.num1 || '',
                    amount: parseFloat(j.monto || 0)
                }));
            }
        } catch (e) {
            console.warn("Error al cargar jugadas:", e);
        }
    }

    let loteriaNombre = ticket.sorteo_nombre || ticket.sorteo || 'Sorteo General';
    if ((!loteriaNombre || loteriaNombre === 'N/A') && ticket.sorteo_id && supabase) {
        try {
            const { data: s } = await supabase.from('sorteos').select('nombre').eq('id', ticket.sorteo_id).maybeSingle();
            if (s && s.nombre) loteriaNombre = s.nombre;
        } catch (e) {}
    }

    if (typeof window.cfg === 'undefined') {
        window.cfg = window.AppState || {};
    }

    const ticketParaPOSModal = {
        id: ticket.id,
        folio: ticket.codigo_ticket || ticket.folio || ticket.id,
        createdAt: ticket.created_at || ticket.createdAt || new Date().toISOString(),
        bancaId: ticket.banca_id || ticket.bancaId,
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

            setTimeout(() => {
                const container = document.querySelector('#ticketModal .modal-body') || 
                                  document.querySelector('#ticketModal') || 
                                  document.querySelector('.ticket-container');
                if (container && !document.getElementById('etiqueta-copia-historial')) {
                    const copiaDiv = document.createElement('div');
                    copiaDiv.id = 'etiqueta-copia-historial';
                    copiaDiv.style.cssText = 'text-align: center; font-weight: bold; font-size: 16px; color: #ef4444; margin: 8px 0; border: 1px dashed #ef4444; padding: 4px; border-radius: 4px; background: rgba(239, 68, 68, 0.1);';
                    copiaDiv.innerHTML = '*** REIMPRESIÓN / COPIA ***';
                    container.insertBefore(copiaDiv, container.firstChild);
                }
            }, 150);
        } else {
            alert("La función showTicketModal no está disponible.");
        }
    } catch (err) {
        console.error("Error al abrir modal del ticket:", err);
        alert("Ocurrió un error al desplegar el ticket: " + err.message);
    }
};

// ==========================================================
// CANCELACIÓN DE TICKET VÍA RPC ÚNICA Y ROBUSTA
// ==========================================================
window.cancelarTicketHistorial = async function(uniqueId) {
    const ticket = typeof buscarTicketEnCache === 'function' ? buscarTicketEnCache(uniqueId) : null;
    const folioTarget = ticket ? (ticket.codigo_ticket || ticket.folio || ticket.ticket_numero || ticket.id) : uniqueId;

    if (!folioTarget) return alert("Ticket no encontrado.");

    const conf = confirm(`¿Está seguro de que desea cancelar el ticket #${folioTarget}?`);
    if (!conf) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) throw new Error("Cliente de Supabase no disponible.");

        let data = null;
        let error = null;

        const resRpc = await supabase.rpc('anular_ticket_por_codigo', { p_referencia: String(folioTarget).trim() });
        data = resRpc.data;
        error = resRpc.error;

        if (error) {
            const fallbackRpc = await supabase.rpc('cancelar_ticket_universal', { p_referencia: String(folioTarget).trim() });
            data = fallbackRpc.data;
            error = fallbackRpc.error;
        }

        if (error) throw error;

        if (data && data.success) {
            alert(`✅ ${data.message}`);
            if (typeof cargarHistorialTickets === 'function') await cargarHistorialTickets();
            else location.reload();
        } else {
            alert(`⚠️ ${data?.message || 'No se pudo cancelar el ticket.'}`);
        }
    } catch (err) {
        console.error("Error al cancelar ticket en reportes:", err);
        alert("❌ Error: " + err.message);
    }
};

window.imprimirTicketHistorial = async function(uniqueId) {
    const ticket = buscarTicketEnCache(uniqueId);
    if (!ticket) {
        alert("No se encontró el ticket.");
        return;
    }

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    let nombreSorteo = ticket.sorteo_nombre || ticket.sorteo || 'Sorteo General';

    if ((!nombreSorteo || nombreSorteo === 'Sorteo General') && ticket.sorteo_id && supabase) {
        const { data: s } = await supabase.from('sorteos').select('nombre').eq('id', ticket.sorteo_id).maybeSingle();
        if (s && s.nombre) nombreSorteo = s.nombre;
    }

    const items = normalizarItemsTicket(ticket);
    const folio = ticket.codigo_ticket || ticket.folio || ticket.id;
    const estatus = String(ticket.estatus || ticket.estado || 'pendiente').toUpperCase();

    let mensajeWA = `*--- TICKET DE JUGADA (COPIA) ---*\n`;
    if (estatus === 'CANCELADO') mensajeWA += `*=== TICKET CANCELADO ===*\n`;
    mensajeWA += `*Folio:* ${folio}\n`;
    mensajeWA += `*Sorteo:* ${nombreSorteo}\n`;
    mensajeWA += `*Banca:* ${obtenerNombreBanca(ticket.banca_id, ticket)}\n`;
    mensajeWA += `--------------------------------\n`;
    mensajeWA += `*JUGADAS:*\n`;

    items.forEach(j => {
        const tipo = (j.tipo || 'DIRECTO').toUpperCase();
        const num = j.numero || j.num1 || '';
        const monto = parseFloat(j.monto || 0).toFixed(2);
        mensajeWA += `• [${tipo}] ${num} -> $${monto}\n`;
    });

    mensajeWA += `--------------------------------\n`;
    mensajeWA += `*TOTAL:* $${parseFloat(ticket.monto_total || ticket.monto || 0).toFixed(2)}\n`;
    mensajeWA += `*ESTADO:* ${estatus}\n`;
    mensajeWA += `*** REIMPRESIÓN / COPIA ***`;

    const opcion = confirm("¿Desea enviar esta COPIA por WhatsApp?\n\n(Aceptar = WhatsApp / Cancelar = Imprimir en Ticketera)");

    if (opcion) {
        const urlWA = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeWA)}`;
        window.open(urlWA, '_blank');
    } else {
        const ticketParaImprimir = {
            ...ticket,
            folio: folio,
            sorteo: nombreSorteo,
            items: items,
            esCopia: true,
            encabezado_tipo: '*** COPIA ***'
        };

        if (typeof window.imprimirTicketTermico === 'function') {
            window.imprimirTicketTermico(ticketParaImprimir);
        } else {
            window.verTicketHistorial(uniqueId);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const ticketSection = document.getElementById('section-tickets');
    if (ticketSection) {
        const observerTickets = new MutationObserver(() => {
            if (!ticketSection.classList.contains('hidden')) {
                initTicketsHistoryModule();
            }
        });
        observerTickets.observe(ticketSection, { attributes: true });
    }
});

// Exportaciones globales
window.initReportesModule = initReportesModule;
window.generarReporte = generarReporte;
window.limpiarFiltrosReportes = limpiarFiltrosReportes;
window.exportarReporteExcel = exportarReporteExcel;
window.imprimirReportePDF = imprimirReportePDF;
window.exportarReportePDF = imprimirReportePDF;
window.initTicketsHistoryModule = initTicketsHistoryModule;
window.cargarHistorialTickets = cargarHistorialTickets;
window.filtrarYRenderizarTicketsLocal = filtrarYRenderizarTicketsLocal;