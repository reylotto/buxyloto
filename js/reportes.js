// =================================================================
// MÓDULO DE BALANCES FINANCIEROS, AUDITORÍA Y HISTORIAL DE TICKETS
// =================================================================

let reporteDataCache = [];
let bancasCache = [];
let ticketsCache = [];
let loteriasCache = [];
let usuariosCache = [];

function getHoyYMD() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    if (ticket.nombre_banca) return ticket.nombre_banca;
    if (ticket.vendedor_nombre) return ticket.vendedor_nombre;
    if (ticket.banca && typeof ticket.banca === 'string' && !ticket.banca.includes('-')) return ticket.banca;

    const listaBancas = (bancasCache && bancasCache.length > 0) 
        ? bancasCache 
        : (window.AppState && window.AppState.bancas) || [];

    const idBuscar = bancaId || ticket.banca_id || ticket.banca;

    if (idBuscar) {
        const bancaEncontrada = listaBancas.find(b => 
            String(b.id).toLowerCase() === String(idBuscar).toLowerCase() || 
            String(b.codigo || b.code || b.numero || '').toLowerCase() === String(idBuscar).toLowerCase()
        );
        if (bancaEncontrada) {
            return bancaEncontrada.nombre_banca || bancaEncontrada.nombre || bancaEncontrada.vendedor_nombre || `Banca ${bancaEncontrada.codigo || bancaEncontrada.id}`;
        }
    }

    if (ticket.banca_numero || ticket.numero_banca) {
        return `Banca ${ticket.banca_numero || ticket.numero_banca}`;
    }

    return `Banca ${idBuscar || 'Central'}`;
}

/**
 * Obtiene el objeto de banca para consultar su comisión configurada
 */
function obtenerObjetoBanca(bancaId, ticket = {}) {
    const listaBancas = (bancasCache && bancasCache.length > 0) 
        ? bancasCache 
        : (window.AppState && window.AppState.bancas) || [];

    const idBuscar = bancaId || ticket.banca_id || ticket.banca;
    return listaBancas.find(b => String(b.id).toLowerCase() === String(idBuscar).toLowerCase()) || null;
}

export async function initReportesModule() {
    console.log("📊 Inicializando Módulo de Balances Financieros y Auditoría...");

    const hoyStr = getHoyYMD();
    const inputDesde = document.getElementById('rep-fecha-desde');
    const inputHasta = document.getElementById('rep-fecha-hasta');

    if (inputDesde && !inputDesde.value) inputDesde.value = hoyStr;
    if (inputHasta && !inputHasta.value) inputHasta.value = hoyStr;

    await cargarFiltrosDesplegables();
    await generarReporte();
}

/**
 * Carga Filtros Desplegables: Vendedores, Zonas, Supervisores y Loterías
 */
async function cargarFiltrosDesplegables() {
    await asegurarBancasCache();
    const supabase = window.supabase;

    try {
        // Cargar Supervisores y Usuarios si no existen en caché
        if (supabase && usuariosCache.length === 0) {
            const { data: usrs } = await supabase.from('usuarios').select('*');
            if (usrs) usuariosCache = usrs;
        }

        // Cargar Sorteos/Loterías si no existen
        if (supabase && loteriasCache.length === 0) {
            const { data: sort } = await supabase.from('sorteos').select('*');
            if (sort) loteriasCache = sort;
        }

        // 1. Desplegable Vendedores / Bancas
        const selVendedor = document.getElementById('rep-filtro-vendedor') || document.getElementById('rep-filtro-banca');
        if (selVendedor && bancasCache.length > 0) {
            selVendedor.innerHTML = '<option value="todos">Todas las bancas / vendedores</option>';
            bancasCache.forEach(b => {
                const nom = b.nombre_banca || b.vendedor_nombre || b.nombre || `Banca #${b.id}`;
                selVendedor.innerHTML += `<option value="${b.id}">${nom}</option>`;
            });
        }

        // 2. Desplegable Zonas
        const selZona = document.getElementById('rep-filtro-zona');
        if (selZona && bancasCache.length > 0) {
            const zonas = new Set();
            bancasCache.forEach(b => { if (b.zona && String(b.zona).trim() !== '') zonas.add(b.zona.trim()); });
            selZona.innerHTML = '<option value="todas">Todas las zonas</option>';
            zonas.forEach(z => selZona.innerHTML += `<option value="${z}">${z}</option>`);
        }

        // 3. Desplegable Supervisores
        const selSupervisor = document.getElementById('rep-filtro-supervisor');
        if (selSupervisor) {
            selSupervisor.innerHTML = '<option value="todos">Todos los supervisores</option>';
            const supervisores = usuariosCache.filter(u => String(u.rol || u.role).toLowerCase() === 'supervisor');
            supervisores.forEach(sup => {
                selSupervisor.innerHTML += `<option value="${sup.id}">${sup.nombre || sup.username || sup.email}</option>`;
            });
        }

        // 4. Desplegable Loterías / Sorteos
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

/**
 * Consulta de tickets y consolidación con COMISIONES REALES y EXCLUSIÓN DE CANCELADOS
 */
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

        resultados.forEach(t => {
            // Excluir estrictamente los tickets cancelados
            const estado = String(t.estatus || t.status || t.estado || 'pendiente').toLowerCase();
            if (estado === 'cancelado' || estado === 'anulado') return;

            // Filtro por Vendedor / Banca
            if (vendedorFiltro !== 'todos' && String(t.banca_id) !== String(vendedorFiltro)) return;

            // Filtro por Sorteo / Loteria
            if (loteriaFiltro !== 'todas' && String(t.sorteo_id) !== String(loteriaFiltro)) return;

            const bancaObj = obtenerObjetoBanca(t.banca_id, t);
            const bancaNombre = obtenerNombreBanca(t.banca_id, t);
            const zonaBanca = bancaObj?.zona || 'N/A';

            // Filtro por Zona
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
            
            // Lógica de Comisión Dinámica: Usar % de la banca (ej. 20%) o fallback
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
        });

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

/**
 * Limpia todos los filtros de auditoría y recarga la tabla
 */
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

/**
 * Exporta los datos formateados a un archivo CSV/Excel
 */
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

/**
 * Imprime / Genera PDF del desglose de auditoría sin paginas en blanco
 */
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

// Vinculación explícita a la ventana global (window)
window.initReportesModule = initReportesModule;
window.generarReporte = generarReporte;
window.limpiarFiltrosReportes = limpiarFiltrosReportes;
window.exportarReporteExcel = exportarReporteExcel;
window.imprimirReportePDF = imprimirReportePDF;