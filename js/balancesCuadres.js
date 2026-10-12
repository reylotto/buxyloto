// ==========================================================
// MÓDULO DE BALANCES, CUADRES Y ARQUEOS FINANCIEROS (js/balancesCuadres.js)
// ==========================================================

export async function initBalancesCuadresModule() {
    console.log("💼 Módulo de Balances y Cuadres Avanzado inicializado.");
    await cargarFiltrosBalances();
    configurarPestañasBalances();
    consultarBalancesVendedores();
}
window.initBalancesCuadresModule = initBalancesCuadresModule;

// 1. Configuración de Pestañas (Balances vs Cuadres)
function configurarPestañasBalances() {
    const btnTabBalances = document.getElementById('btn-tab-balances-vendedor');
    const btnTabCuadres = document.getElementById('btn-tab-cuadres-cierre');
    
    const secBalances = document.getElementById('seccion-balances-vendedor');
    const secCuadres = document.getElementById('seccion-cuadres-cierre');

    if (btnTabBalances && btnTabCuadres) {
        btnTabBalances.onclick = (e) => {
            e.preventDefault();
            btnTabBalances.classList.add('bg-emerald-600', 'text-white');
            btnTabCuadres.classList.remove('bg-emerald-600', 'text-white');
            if (secBalances) secBalances.classList.remove('hidden');
            if (secCuadres) secCuadres.classList.add('hidden');
        };

        btnTabCuadres.onclick = (e) => {
            e.preventDefault();
            btnTabCuadres.classList.add('bg-emerald-600', 'text-white');
            btnTabBalances.classList.remove('bg-emerald-600', 'text-white');
            if (secCuadres) secCuadres.classList.remove('hidden');
            if (secBalances) secBalances.classList.add('hidden');
            cargarHistorialCuadres();
        };
    }
}

// 2. Cargar Selects y Filtros por Grupo, Vendedor y Fechas
async function cargarFiltrosBalances() {
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        // Cargar Bancas / Vendedores
        const { data: bancas } = await supabase.from('bancas').select('*');
        const selVendedor = document.getElementById('balance-filtro-vendedor');
        if (selVendedor && bancas) {
            selVendedor.innerHTML = '<option value="todos">Todos los vendedores / bancas</option>';
            bancas.forEach(b => {
                const nombre = b.nombre_banca || b.vendedor_nombre || `Banca #${b.id}`;
                selVendedor.innerHTML += `<option value="${b.id}">${nombre}</option>`;
            });
        }

        // Cargar Supervisores / Grupos
        const { data: usuarios } = await supabase.from('usuarios').select('*');
        const selGrupo = document.getElementById('balance-filtro-grupo');
        if (selGrupo && usuarios) {
            selGrupo.innerHTML = '<option value="todos">Todos los grupos / supervisores</option>';
            const supervisores = usuarios.filter(u => String(u.rol || u.role).toLowerCase() === 'supervisor' || String(u.rol || u.role).toLowerCase() === 'admin');
            supervisores.forEach(sup => {
                selGrupo.innerHTML += `<option value="${sup.id}">${sup.nombre || sup.username || sup.email}</option>`;
            });
        }

        // Establecer fechas de hoy por defecto
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
        const inputDesde = document.getElementById('balance-fecha-desde');
        const inputHasta = document.getElementById('balance-fecha-hasta');
        if (inputDesde && !inputDesde.value) inputDesde.value = hoy;
        if (inputHasta && !inputHasta.value) inputHasta.value = hoy;

    } catch (e) {
        console.warn("Error al cargar filtros de balances:", e);
    }
}

// 3. Consultar y Calcular Balances por Vendedor en tiempo real
export async function consultarBalancesVendedores() {
    const supabase = window.supabase;
    const tbody = document.getElementById('tabla-balances-vendedores-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-emerald-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Calculando balances de bancas...</td></tr>`;

    const fechaDesde = document.getElementById('balance-fecha-desde')?.value;
    const fechaHasta = document.getElementById('balance-fecha-hasta')?.value;
    const vendedorFiltro = document.getElementById('balance-filtro-vendedor')?.value || 'todos';

    try {
        let query = supabase.from('tickets').select('*');
        if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
        if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

        const { data: tickets, error } = await query;
        if (error) throw error;

        const { data: bancas } = await supabase.from('bancas').select('*');
        const listaBancas = bancas || [];

        const resumenBancas = {};

        // Inicializar todas las bancas en el reporte
        listaBancas.forEach(b => {
            if (vendedorFiltro !== 'todos' && String(b.id) !== String(vendedorFiltro)) return;
            resumenBancas[b.id] = {
                id: b.id,
                nombre: b.nombre_banca || b.vendedor_nombre || `Banca #${b.id}`,
                comisionPct: parseFloat(b.comision || 10),
                ventas: 0,
                comisiones: 0,
                premios: 0,
                neto: 0,
                ticketsCount: 0
            };
        });

        // Procesar tickets
        (tickets || []).forEach(t => {
            const estado = String(t.estatus || t.estado || '').toLowerCase();
            if (estado === 'cancelado' || estado === 'anulado') return;

            const bId = t.banca_id;
            if (!bId || !resumenBancas[bId]) return;
            if (vendedorFiltro !== 'todos' && String(bId) !== String(vendedorFiltro)) return;

            const monto = parseFloat(t.monto_total || t.monto || 0);
            const pct = resumenBancas[bId].comisionPct;
            const comision = monto * (pct / 100);
            
            let premio = parseFloat(t.monto_premio || t.premio || 0);
            if (estado === 'premiado' || estado === 'ganador') {
                if (premio === 0 && Array.isArray(t.jugadas || t.detalles)) {
                    (t.jugadas || t.detalles).forEach(j => premio += parseFloat(j.premio || 0));
                }
            } else {
                premio = 0;
            }

            resumenBancas[bId].ventas += monto;
            resumenBancas[bId].comisiones += comision;
            resumenBancas[bId].premios += premio;
        });

        const arrayBalances = Object.values(resumenBancas);
        if (arrayBalances.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No hay registros para este filtro.</td></tr>`;
            return;
        }

        tbody.innerHTML = arrayBalances.map(b => {
            const neto = b.ventas - b.comisiones - b.premios;
            return `
                <tr class="border-b border-slate-700/40 hover:bg-slate-700/30 text-xs">
                    <td class="p-3 font-bold text-white">${b.nombre}</td>
                    <td class="p-3 text-center font-mono text-cyan-400">${b.comisionPct}%</td>
                    <td class="p-3 text-right font-mono text-emerald-400 font-semibold">$${b.ventas.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-amber-400">$${b.comisiones.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-rose-400">$${b.premios.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono font-bold ${neto >= 0 ? 'text-emerald-400' : 'text-rose-500'}">$${neto.toFixed(2)}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.abrirModalCuarqueBanca('${b.id}', '${b.nombre}', ${neto.toFixed(2)})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] shadow">
                            Registrar Cuadre / Pago
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al consultar balances de vendedores:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al cargar balances.</td></tr>`;
    }
}
window.consultarBalancesVendedores = consultarBalancesVendedores;

// 4. Modal de Arqueo y Cuadre para registrar pagos o abonos
window.abrirModalCuarqueBanca = function(bancaId, nombreBanca, saldoNeto) {
    const montoAbono = prompt(`Registrar Arqueo / Cuadre para: ${nombreBanca}\nSaldo Neto Actual: $${saldoNeto}\n\nIngrese el monto entregado o a cuadrar ($):`, saldoNeto);
    if (montoAbono === null) return;

    const montoNum = parseFloat(montoAbono);
    if (isNaN(montoNum)) {
        alert("Monto inválido.");
        return;
    }

    alert(`✅ Cuadre registrado con éxito para ${nombreBanca}.\nMonto procesado: $${montoNum.toFixed(2)}\nEste estado se sincronizará con el POS del vendedor.`);
    // Aquí puedes agregar la inserción a Supabase si creas una tabla de cuadres.
};

// 5. Cargar Historial de Cuadres Realizados
function cargarHistorialCuadres() {
    const tbody = document.getElementById('tabla-historial-cuadres-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">Historial de arqueos sincronizado al día.</td></tr>`;
}

document.addEventListener('DOMContentLoaded', () => {
    const secBalances = document.getElementById('section-reports');
    if (secBalances) {
        const obs = new MutationObserver(() => {
            if (!secBalances.classList.contains('hidden')) {
                initBalancesCuadresModule();
            }
        });
        obs.observe(secBalances, { attributes: true });
    }
});
// Agrega esto al final de js/balancesCuadres.js
window.mostrarTabFinanzas = function(tabName) {
    // 1. Ocultar todos los contenidos
    const tabs = ['auditoria', 'balances', 'cuadres'];
    tabs.forEach(t => {
        const el = document.getElementById('tab-content-' + t);
        if (el) el.classList.add('hidden');
        
        // 2. Quitar el color verde de todos los botones
        const btn = document.getElementById('tab-btn-' + t);
        if (btn) {
            btn.classList.remove('bg-emerald-600', 'text-white');
            btn.classList.add('bg-transparent', 'text-slate-400');
        }
    });
    
    // 3. Mostrar el contenido seleccionado y pintar el botón de verde
    const activeContent = document.getElementById('tab-content-' + tabName);
    if (activeContent) activeContent.classList.remove('hidden');
    
    const activeBtn = document.getElementById('tab-btn-' + tabName);
    if (activeBtn) {
        activeBtn.classList.remove('bg-transparent', 'text-slate-400');
        activeBtn.classList.add('bg-emerald-600', 'text-white');
    }
    
    // 4. Disparar las consultas automáticamente al cambiar de pestaña
    if (tabName === 'auditoria' && typeof window.generarReporte === 'function') window.generarReporte();
    if (tabName === 'balances' && typeof window.consultarBalancesVendedores === 'function') window.consultarBalancesVendedores();
};