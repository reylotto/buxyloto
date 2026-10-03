// =================================================================
// MÓDULO DE BALANCES FINANCIEROS Y CUADRES ROBUSTO
// =================================================================

let reporteDataCache = [];
let bancasCache = [];

/**
 * Inicializa el módulo
 */
export async function initReportesModule() {
    console.log("📊 Inicializando Módulo de Balances Financieros...");

    const hoyStr = new Date().toISOString().split('T')[0];
    const inputDesde = document.getElementById('rep-fecha-desde');
    const inputHasta = document.getElementById('rep-fecha-hasta');

    if (inputDesde) inputDesde.value = hoyStr;
    if (inputHasta) inputHasta.value = hoyStr;

    await cargarFiltrosDesplegables();
    await generarReporte();
}

/**
 * Carga Loterías, Supervisores y Bancas de forma independiente
 */
async function cargarFiltrosDesplegables() {
    const supabase = window.supabase;
    if (!supabase) return;

    // 1. CARGAR BANCAS Y ZONAS
    try {
        const { data: bancas } = await supabase.from('bancas').select('*');
        if (bancas && bancas.length > 0) {
            bancasCache = bancas;
            const selVendedor = document.getElementById('rep-filtro-vendedor');
            const selZona = document.getElementById('rep-filtro-zona');

            if (selVendedor) {
                selVendedor.innerHTML = '<option value="todos">Todos los vendedores</option>';
                bancas.forEach(b => {
                    const nom = b.nombre_banca || b.vendedor_nombre || b.nombre || `Banca #${b.id}`;
                    selVendedor.innerHTML += `<option value="${b.id}">${nom}</option>`;
                });
            }

            if (selZona) {
                const zonas = new Set();
                bancas.forEach(b => { if (b.zona && String(b.zona).trim() !== '') zonas.add(b.zona.trim()); });
                selZona.innerHTML = '<option value="todas">Todas las zonas</option>';
                zonas.forEach(z => selZona.innerHTML += `<option value="${z}">${z}</option>`);
            }
        }
    } catch (e) {
        console.warn("Error cargando bancas:", e);
    }

    // 2. CARGAR SUPERVISORES EXCLUSIVOS
    try {
        const supervisores = new Set();
        
        // Intentar obtener de la tabla usuarios
        const { data: usuarios } = await supabase.from('usuarios').select('*');
        if (usuarios) {
            usuarios.forEach(u => {
                const rol = String(u.rol || u.role || u.tipo || '').toLowerCase();
                if (rol.includes('superv') || rol.includes('admin')) {
                    const nombreSup = u.nombre || u.usuario || u.vendedor_nombre;
                    if (nombreSup) supervisores.add(nombreSup.trim());
                }
            });
        }

        // Revisar columna supervisor en bancas
        if (bancasCache.length > 0) {
            bancasCache.forEach(b => {
                if (b.supervisor && String(b.supervisor).trim() !== '' && b.supervisor !== 'null') {
                    supervisores.add(b.supervisor.trim());
                }
            });
        }

        const selSupervisor = document.getElementById('rep-filtro-supervisor');
        if (selSupervisor) {
            selSupervisor.innerHTML = '<option value="todos">Todos los supervisores</option>';
            supervisores.forEach(sup => {
                selSupervisor.innerHTML += `<option value="${sup}">${sup}</option>`;
            });
        }
    } catch (e) {
        console.warn("Error cargando supervisores:", e);
    }

    // 3. CARGAR LOTERÍAS (Estrategia doble: 'loterias' o 'sorteos')
    try {
        let loterias = [];
        const { data: lotData } = await supabase.from('loterias').select('*');
        if (lotData && lotData.length > 0) {
            loterias = lotData;
        } else {
            const { data: sortData } = await supabase.from('sorteos').select('*');
            if (sortData && sortData.length > 0) loterias = sortData;
        }

        const selLoteria = document.getElementById('rep-filtro-loteria');
        if (selLoteria) {
            selLoteria.innerHTML = '<option value="todas">Todas las loterías</option>';
            if (loterias.length > 0) {
                loterias.forEach(l => {
                    const nom = l.nombre || l.nombre_loteria || l.titulo || l.sorteo_nombre || `Lotería #${l.id}`;
                    selLoteria.innerHTML += `<option value="${l.id}">${nom}</option>`;
                });
            } else {
                selLoteria.innerHTML = '<option value="todas">Todas las loterías (0 registradas)</option>';
            }
        }
    } catch (e) {
        console.warn("Error cargando loterías:", e);
    }
}

/**
 * Consulta de tickets y consolidación de ventas
 */
export async function generarReporte() {
    const supabase = window.supabase;
    const tbody = document.getElementById('reports-banca-table-body');
    if (!supabase || !tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-emerald-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando ventas en Supabase...</td></tr>`;

    const fechaDesde = document.getElementById('rep-fecha-desde')?.value;
    const fechaHasta = document.getElementById('rep-fecha-hasta')?.value;
    const zona = document.getElementById('rep-filtro-zona')?.value;
    const supervisor = document.getElementById('rep-filtro-supervisor')?.value;
    const vendedorId = document.getElementById('rep-filtro-vendedor')?.value;
    const loteriaId = document.getElementById('rep-filtro-loteria')?.value;
    const tipoJugada = document.getElementById('rep-filtro-jugada')?.value;

    try {
        // Consulta directa a tickets (sin joins para evitar errores 400)
        let query = supabase.from('tickets').select('*');

        if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
        if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);
        if (vendedorId && vendedorId !== 'todos') query = query.eq('banca_id', vendedorId);
        if (loteriaId && loteriaId !== 'todas') query = query.eq('loteria_id', loteriaId);

        const { data: tickets, error } = await query;
        if (error) throw error;

        let resultados = tickets || [];

        // Mapear con la información de la banca
        const bancasMap = {};
        bancasCache.forEach(b => { bancasMap[b.id] = b; });

        // Filtros secundarios
        if (zona && zona !== 'todas') {
            resultados = resultados.filter(t => bancasMap[t.banca_id]?.zona === zona);
        }
        if (supervisor && supervisor !== 'todos') {
            resultados = resultados.filter(t => bancasMap[t.banca_id]?.supervisor === supervisor);
        }
        if (tipoJugada && tipoJugada !== 'todas') {
            resultados = resultados.filter(t => String(t.tipo_jugada || '').toLowerCase().includes(tipoJugada.toLowerCase()));
        }

        // Agrupar resultados por Día y Banca
        const agrupado = {};

        resultados.forEach(t => {
            const fechaObj = new Date(t.created_at);
            const fechaKey = fechaObj.toLocaleDateString('es-PA', {
                weekday: 'short',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            const bInfo = bancasMap[t.banca_id] || {};
            const bancaNombre = bInfo.nombre_banca || bInfo.vendedor_nombre || `Banca #${t.banca_id || 'N/A'}`;
            const key = `${fechaKey}_${bancaNombre}`;

            if (!agrupado[key]) {
                agrupado[key] = {
                    fecha: fechaKey,
                    vendedor: bancaNombre,
                    zona: bInfo.zona || 'N/A',
                    supervisor: bInfo.supervisor || 'N/A',
                    ticketsCount: 0,
                    venta: 0,
                    comision: 0,
                    premios: 0
                };
            }

            const venta = parseFloat(t.monto_total || t.monto || t.total || 0);
            const comision = parseFloat(t.comision_monto || t.comision || (venta * 0.15));
            const premio = parseFloat(t.premio_monto || t.premio || 0);

            agrupado[key].ticketsCount += 1;
            agrupado[key].venta += venta;
            agrupado[key].comision += comision;
            agrupado[key].premios += premio;
        });

        reporteDataCache = Object.values(agrupado);
        renderizarTablaReporte(reporteDataCache);

    } catch (err) {
        console.error("❌ Error al consultar reportes:", err);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-400">Error al consultar los registros en la base de datos.</td></tr>`;
    }
}

function renderizarTablaReporte(datos) {
    const tbody = document.getElementById('reports-banca-table-body');
    const cantElem = document.getElementById('cant-registros');
    
    let totalVentas = 0;
    let totalComisiones = 0;
    let totalPremios = 0;

    if (!datos || datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">No hay ventas registradas con los filtros seleccionados.</td></tr>`;
        if (cantElem) cantElem.textContent = "0 Registros";
        actualizarKPIs(0, 0, 0, 0);
        return;
    }

    let html = '';
    datos.forEach(d => {
        const balanceNeto = d.venta - d.comision - d.premios;
        const balanceClass = balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400';

        totalVentas += d.venta;
        totalComisiones += d.comision;
        totalPremios += d.premios;

        html += `
            <tr class="hover:bg-slate-700/30 transition-all border-b border-slate-700/40">
                <td class="p-3 font-mono text-slate-300 capitalize">${d.fecha}</td>
                <td class="p-3 font-bold text-white">${d.vendedor}</td>
                <td class="p-3 text-slate-400">${d.zona} / <span class="text-slate-300">${d.supervisor}</span></td>
                <td class="p-3 text-center font-mono text-slate-300">${d.ticketsCount}</td>
                <td class="p-3 text-right font-mono font-semibold text-emerald-400">$${d.venta.toFixed(2)}</td>
                <td class="p-3 text-right font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                <td class="p-3 text-right font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                <td class="p-3 text-right font-mono font-bold ${balanceClass}">$${balanceNeto.toFixed(2)}</td>
                <td class="p-3 text-center">
                    <span class="bg-slate-700 text-slate-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                        ${balanceNeto >= 0 ? 'A Favor Casa' : 'A Favor Banca'}
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (cantElem) cantElem.textContent = `${datos.length} Registros`;
    
    const totalNeto = totalVentas - totalComisiones - totalPremios;
    actualizarKPIs(totalVentas, totalComisiones, totalPremios, totalNeto);
}

function actualizarKPIs(v, c, p, n) {
    const vElem = document.getElementById('tot-ventas');
    const cElem = document.getElementById('tot-comisiones');
    const pElem = document.getElementById('tot-premios');
    const rElem = document.getElementById('tot-resultado');

    if (vElem) vElem.textContent = `$${v.toFixed(2)}`;
    if (cElem) cElem.textContent = `$${c.toFixed(2)}`;
    if (pElem) pElem.textContent = `$${p.toFixed(2)}`;
    
    if (rElem) {
        rElem.textContent = `$${n.toFixed(2)}`;
        rElem.className = `text-2xl font-bold mt-1 ${n >= 0 ? 'text-sky-400' : 'text-rose-400'}`;
    }
}

export function limpiarFiltrosReportes() {
    const hoyStr = new Date().toISOString().split('T')[0];
    if (document.getElementById('rep-fecha-desde')) document.getElementById('rep-fecha-desde').value = hoyStr;
    if (document.getElementById('rep-fecha-hasta')) document.getElementById('rep-fecha-hasta').value = hoyStr;
    if (document.getElementById('rep-filtro-zona')) document.getElementById('rep-filtro-zona').value = 'todas';
    if (document.getElementById('rep-filtro-supervisor')) document.getElementById('rep-filtro-supervisor').value = 'todos';
    if (document.getElementById('rep-filtro-vendedor')) document.getElementById('rep-filtro-vendedor').value = 'todos';
    if (document.getElementById('rep-filtro-loteria')) document.getElementById('rep-filtro-loteria').value = 'todas';
    if (document.getElementById('rep-filtro-jugada')) document.getElementById('rep-filtro-jugada').value = 'todas';
    generarReporte();
}

export function exportarReporteExcel() {
    if (!reporteDataCache || reporteDataCache.length === 0) {
        alert("No hay registros en pantalla para exportar.");
        return;
    }

    let csv = "Fecha,Banca / Vendedor,Zona,Supervisor,Tickets,Venta Bruta,Comision,Premios,Balance Neto\n";
    reporteDataCache.forEach(d => {
        const net = d.venta - d.comision - d.premios;
        csv += `"${d.fecha}","${d.vendedor}","${d.zona}","${d.supervisor}",${d.ticketsCount},${d.venta.toFixed(2)},${d.comision.toFixed(2)},${d.premios.toFixed(2)},${net.toFixed(2)}\n`;
    });

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = `Cuadre_Financiero_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportarReportePDF() {
    window.print();
}

document.addEventListener('DOMContentLoaded', () => {
    const reportSection = document.getElementById('section-reports');
    if (reportSection) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isHidden = reportSection.classList.contains('hidden');
                    if (!isHidden) {
                        initReportesModule();
                    }
                }
            });
        });
        observer.observe(reportSection, { attributes: true });
    }
});

window.initReportesModule = initReportesModule;
window.generarReporte = generarReporte;
window.limpiarFiltrosReportes = limpiarFiltrosReportes;
window.exportarReporteExcel = exportarReporteExcel;
window.exportarReportePDF = exportarReportePDF;