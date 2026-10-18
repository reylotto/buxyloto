// ==========================================================
// MÓDULO DE CONTROL DE CUADRES Y BALANCES (NUBE - SUPABASE)
// ==========================================================

let estadoBalances = {
    vendedores: [],
    pagosLocales: [], 
    vendedorActual: null
};

export async function initBalancesCuadresModule() {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const btnDesde = document.getElementById('cuadre-fecha-desde');
    const btnHasta = document.getElementById('cuadre-fecha-hasta');
    if (btnDesde && !btnDesde.value) btnDesde.value = hoy;
    if (btnHasta && !btnHasta.value) btnHasta.value = hoy;

    await cargarListaVendedores();
    await window.cargarResumenBalances();
}
window.initBalancesCuadresModule = initBalancesCuadresModule;

async function cargarListaVendedores() {
    try {
        const { data: bancas } = await window.supabase.from('bancas').select('*');
        estadoBalances.vendedores = bancas || [];
        
        const select = document.getElementById('cuadre-vendedor');
        if (select) {
            select.innerHTML = '<option value="">Seleccione Vendedor...</option>';
            estadoBalances.vendedores.forEach(b => {
                select.innerHTML += `<option value="${b.id}">${b.nombre_banca || b.vendedor_nombre || 'Banca ' + b.id}</option>`;
            });
        }
    } catch (e) {
        console.error("Error cargando vendedores:", e);
    }
}

window.cargarResumenBalances = async function() {
    const tbody = document.getElementById('tabla-resumen-balances');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-emerald-400"><i class="fa-solid fa-spinner fa-spin"></i> Calculando balances globales...</td></tr>';

    try {
        const { data: tickets } = await window.supabase.from('tickets').select('*');
        const { data: pagosBD } = await window.supabase.from('pagos_bancas').select('*');
        estadoBalances.pagosLocales = pagosBD || [];

        let html = '';

        estadoBalances.vendedores.forEach(b => {
            // Se calcula el histórico TOTAL de esta banca
            const ticketsVendedor = (tickets || []).filter(t => String(t.banca_id) === String(b.id) && String(t.estatus).toLowerCase() !== 'cancelado' && String(t.estatus).toLowerCase() !== 'anulado');
            
            let ventas = 0; let premios = 0; let comisiones = 0;
            const comisionPct = parseFloat(b.comision || 10) / 100;

            ticketsVendedor.forEach(t => {
                const ventaT = parseFloat(t.monto_total || 0);
                ventas += ventaT;
                comisiones += ventaT * comisionPct;
                if (String(t.estatus).toLowerCase() === 'premiado' || String(t.estatus).toLowerCase() === 'ganador') {
                    let premioVal = parseFloat(t.monto_premio || t.premio || 0);
                    if(premioVal === 0 && Array.isArray(t.jugadas || t.detalles)){
                        (t.jugadas || t.detalles).forEach(j => {
                            premioVal += parseFloat(j.premio || j.monto_premio || 0);
                        });
                    }
                    premios += premioVal;
                }
            });

            // Se suman todos los pagos que ha hecho o recibido esta banca
            const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.banca_id) === String(b.id));
            const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);
            const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);

            // RESULTADO ACUMULADO DESDE EL DÍA CERO HASTA HOY
            const resultadoNeto = ventas - premios - comisiones;
            let balanceFinal = resultadoNeto - totIngresos + totEgresos; 
            
            // REDONDEO PARA EVITAR DECIMALES FANTASMA (Ej: 0.00000001)
            balanceFinal = Math.round(balanceFinal * 100) / 100;
            
            const colorClass = balanceFinal >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            const nombre = b.nombre_banca || b.vendedor_nombre || b.name || `Banca #${b.id}`;
            const grupo = b.zona || 'General';
            
            // LÓGICA DE ESTATUS REAL: Solo está cuadrado si la banca no nos debe (0.00)
            const estaCuadrado = (balanceFinal === 0);
            const estatusLabel = estaCuadrado ? 'CUADRADO' : (balanceFinal > 0 ? 'PENDIENTE (DEBE)' : 'SALDO A FAVOR');
            const estatusClass = estaCuadrado 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold' 
                : (balanceFinal > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold');

            html += `
                <tr class="hover:bg-slate-700/30 border-b border-slate-700/50">
                    <td class="p-4 font-bold text-white">${nombre}</td>
                    <td class="p-4 text-slate-400">${grupo}</td>
                    <td class="p-4 text-center">
                        <span class="px-3 py-1 rounded-full border font-mono font-bold text-xs ${colorClass}">
                            $${balanceFinal.toFixed(2)}
                        </span>
                    </td>
                    <td class="p-4 text-center">
                        <span class="text-[10px] px-2.5 py-1 rounded-full uppercase ${estatusClass}">
                            ${estatusLabel}
                        </span>
                    </td>
                    <td class="p-4 text-center">
                        <button onclick="window.irACuadreDetalle('${b.id}')" class="bg-slate-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow">Cuadrar</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="5" class="text-center py-6 text-slate-500">No hay datos para mostrar.</td></tr>';
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-rose-400">Error al cargar saldos.</td></tr>';
    }
};

window.irACuadreDetalle = function(bancaId) {
    const select = document.getElementById('cuadre-vendedor');
    if (select) select.value = bancaId;
    if (typeof window.mostrarTabFinanzas === 'function') {
        window.mostrarTabFinanzas('nuevo-cuadre');
    }
    window.generarDetalleCuadre();
};

window.generarDetalleCuadre = async function() {
    const bancaId = document.getElementById('cuadre-vendedor').value;
    const fDesde = document.getElementById('cuadre-fecha-desde').value;
    const fHasta = document.getElementById('cuadre-fecha-hasta').value;

    if (!bancaId) return alert("Por favor seleccione un vendedor para ver el cuadre.");

    // 🛡️ BLINDAJE: Si la lista está vacía, intentamos cargarla o rescatarla de Supabase
    if (!estadoBalances.vendedores || estadoBalances.vendedores.length === 0) {
        const { data: bancasSupabase } = await window.supabase.from('bancas').select('*');
        estadoBalances.vendedores = bancasSupabase || [];
    }

    let vendedor = estadoBalances.vendedores.find(v => String(v.id) === String(bancaId));
    
    // Si aún así no se encuentra en memoria, hacemos una consulta directa de rescate
    if (!vendedor) {
        const { data: bancaDirecta } = await window.supabase.from('bancas').select('*').eq('id', bancaId).maybeSingle();
        vendedor = bancaDirecta || { id: bancaId, nombre_banca: 'Banca ' + bancaId, comision: 10 };
    }

    estadoBalances.vendedorActual = vendedor;
    const comisionPct = parseFloat(vendedor?.comision || 10) / 100;

    const nombreVendedorDisplay = vendedor.nombre_banca || vendedor.vendedor_nombre || vendedor.name || `Banca ${bancaId}`;
    document.getElementById('cuadre-nombre-vendedor').textContent = nombreVendedorDisplay;
    document.getElementById('cuadre-rango-fechas').textContent = `${fDesde} al ${fHasta}`;

    const tbodyVentas = document.getElementById('tabla-detalles-ventas');
    tbodyVentas.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-emerald-400"></i></td></tr>';

    try {
        const { data: tickets } = await window.supabase.from('tickets')
            .select('*')
            .eq('banca_id', bancaId)
            .gte('created_at', `${fDesde}T00:00:00`)
            .lte('created_at', `${fHasta}T23:59:59`);

        let htmlVentas = '';
        let totVentas = 0; let totPremios = 0; let totComision = 0;
        const agrupadoDias = {};

        (tickets || []).forEach(t => {
            const estatus = String(t.estatus || t.estado || '').toLowerCase();
            if (estatus === 'cancelado' || estatus === 'anulado') return;
            
            const dia = (t.created_at || t.createdAt).split('T')[0];
            if (!agrupadoDias[dia]) agrupadoDias[dia] = { ventas: 0, premios: 0, comision: 0 };
            
            const venta = parseFloat(t.monto_total || t.monto || t.total || 0);
            let pctComisionIndividual = comisionPct;
            if(t.comision_porcentaje) pctComisionIndividual = parseFloat(t.comision_porcentaje)/100;
            
            const comision = venta * pctComisionIndividual;
            let premio = 0;
            if (estatus === 'premiado' || estatus === 'ganador') {
                premio = parseFloat(t.monto_premio || t.premio || 0);
                if(premio === 0 && Array.isArray(t.jugadas || t.detalles)){
                    (t.jugadas || t.detalles).forEach(j => {
                        premio += parseFloat(j.premio || j.monto_premio || 0);
                    });
                }
            }

            agrupadoDias[dia].ventas += venta;
            agrupadoDias[dia].comision += comision;
            agrupadoDias[dia].premios += premio;

            totVentas += venta;
            totComision += comision;
            totPremios += premio;
        });

        Object.keys(agrupadoDias).sort().forEach(dia => {
            const d = agrupadoDias[dia];
            const resultado = d.ventas - d.premios - d.comision;
            htmlVentas += `
                <tr class="hover:bg-slate-700/40 border-b border-slate-700/50">
                    <td class="p-3 font-mono pl-4">${dia}</td>
                    <td class="p-3 text-right font-mono">$${d.ventas.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-rose-400">$${d.premios.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-amber-400">$${d.comision.toFixed(2)}</td>
                    <td class="p-3 text-right pr-4 font-mono font-bold ${resultado >= 0 ? 'text-emerald-400' : 'text-rose-400'}">$${resultado.toFixed(2)}</td>
                </tr>
            `;
        });
        tbodyVentas.innerHTML = htmlVentas || '<tr><td colspan="5" class="text-center py-4 text-slate-500">No hay ventas en este rango.</td></tr>';

        // RECARGAR PAGOS DESDE SUPABASE
        const { data: pagosBD } = await window.supabase.from('pagos_bancas').select('*');
        estadoBalances.pagosLocales = pagosBD || [];

        const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.banca_id) === String(bancaId));
        
        const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((a, b) => a + parseFloat(b.monto), 0);
        const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((a, b) => a + parseFloat(b.monto), 0);
        const impactoVisualPagos = totIngresos - totEgresos;

        const tbodyPagos = document.getElementById('tabla-pagos-negativos');
        
        tbodyPagos.innerHTML = pagosVendedor.map(p => {
            const esIngreso = p.tipo === 'ingreso';
            const fechaDisplay = p.created_at ? new Date(p.created_at).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
            const tipoIcono = esIngreso ? '<i class="fa-solid fa-arrow-down text-emerald-400 mr-1" title="Banca Pagó"></i>' : '<i class="fa-solid fa-arrow-up text-rose-400 mr-1" title="Casa Pagó"></i>';
            return `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="p-3 pl-4 font-mono text-[10px] text-slate-300">${tipoIcono} ${fechaDisplay}</td>
                <td class="p-3 text-right font-mono font-bold ${esIngreso ? 'text-cyan-400' : 'text-rose-400'}">${esIngreso ? '+$' : '-$'}${parseFloat(p.monto).toFixed(2)}</td>
                <td class="p-3 text-center text-slate-400 text-[10px]">${p.responsable || 'Admin'}</td>
                <td class="p-3 text-center pr-4">
                     <button onclick="window.eliminarPagoRegistrado('${p.id}')" class="text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition text-[10px]" title="Anular / Eliminar Pago">
                        <i class="fa-solid fa-xmark"></i>
                     </button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="4" class="text-center py-4 text-slate-500">No hay pagos registrados.</td></tr>';

        const totResultado = totVentas - totPremios - totComision;
        const balanceNeto = totResultado - totIngresos + totEgresos;

        document.getElementById('cuadre-val-ventas').textContent = `$${totVentas.toFixed(2)}`;
        document.getElementById('cuadre-val-premios').textContent = `$${totPremios.toFixed(2)}`;
        document.getElementById('cuadre-val-comision').textContent = `$${totComision.toFixed(2)}`;
        document.getElementById('cuadre-val-resultado').textContent = `$${totResultado.toFixed(2)}`;
        document.getElementById('cuadre-val-pagos').textContent = impactoVisualPagos >= 0 ? `-$${impactoVisualPagos.toFixed(2)}` : `+$${Math.abs(impactoVisualPagos).toFixed(2)}`;
        
        const balEl = document.getElementById('cuadre-val-balance');
        balEl.textContent = `$${balanceNeto.toFixed(2)}`;
        balEl.className = `font-black font-mono text-xl ${balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
        
    } catch (e) {
        console.error("Error al generar cuadre:", e);
    }
};

window.procesarPagoVendedor = async function(tipoMovimiento) {
    if (!estadoBalances.vendedorActual) return alert("Seleccione un vendedor primero.");

    let mensaje = tipoMovimiento === 'ingreso' 
        ? `⬇️ RECIBIR DINERO DE BANCA\nLa banca le está entregando dinero a la Casa.\n\nIngrese el monto:`
        : `⬆️ PAGAR A LA BANCA\nUsted (La Casa) le está entregando dinero a la Banca por premios acumulados.\n\nIngrese el monto:`;

    const montoStr = prompt(mensaje);
    if (montoStr === null || montoStr.trim() === '') return;
    const monto = parseFloat(montoStr);
    
    if (isNaN(monto) || monto <= 0) return alert("Monto inválido. Ingrese un número mayor a 0.");

    try {
        let responsable = 'Administrador';
        if (window.currentUserProfile) {
            responsable = window.currentUserProfile.email || window.currentUserProfile.user_metadata?.full_name || 'Administrador';
        }

        const b = estadoBalances.vendedorActual;
        const nombreBancaReal = b.nombre_banca || b.vendedor_nombre || b.name || `Banca ${b.id}`;
        
        // OBTENER LA FECHA ACTUAL EXACTA (VITAL PARA LA APK Y EL ACUMULATIVO)
        const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

        const nuevoPago = {
            banca_id: String(b.id),
            banca_nombre: String(nombreBancaReal), 
            monto: monto,
            tipo: tipoMovimiento,
            responsable: responsable,
            fecha: fechaHoy // ESTA ES LA PIEZA CLAVE QUE FALTABA
        };

        const { error } = await window.supabase.from('pagos_bancas').insert([nuevoPago]);
        if (error) throw error;

        alert(`✅ Cuadre registrado exitosamente.`);
        
        await window.cargarResumenBalances();
        await window.generarDetalleCuadre(); 
        
    } catch (e) {
        console.error("Error al registrar pago en Supabase:", e);
        alert("❌ Error al guardar el pago: " + e.message);
    }
};

// 🚨 NUEVO: Función para eliminar / anular un pago
window.eliminarPagoRegistrado = async function(pagoId) {
    if (!pagoId) return;
    
    if(!confirm("¿Está seguro de que desea eliminar este pago? Esta acción revertirá el balance y no se puede deshacer.")) {
        return;
    }

    try {
        const { error } = await window.supabase.from('pagos_bancas').delete().eq('id', pagoId);
        
        if (error) throw error;

        alert("✅ Pago eliminado correctamente. El balance se ha recalculado.");
        
        // Recargar datos para mostrar los cambios
        await window.cargarResumenBalances();
        await window.generarDetalleCuadre();
        
    } catch (e) {
        console.error("Error al eliminar pago:", e);
        alert("❌ Error al eliminar el pago: " + e.message);
    }
// ==========================================================
// VIGILANTE: CARGA AUTOMÁTICA DE LA PESTAÑA DE RESUMEN
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Busca los botones que cambian de pestaña en el dashboard
    const botonesPestanas = document.querySelectorAll('button');
    
    botonesPestanas.forEach(btn => {
        // Si el botón contiene el texto "Resumen de Balances"
        if (btn.textContent.includes('Resumen de Balances')) {
            btn.addEventListener('click', () => {
                // Fuerzo una pequeña pausa y luego cargo el resumen
                setTimeout(() => {
                    if (typeof window.cargarResumenBalances === 'function') {
                        window.cargarResumenBalances();
                    }
                }, 100);
            });
        }
    });

    // Cargar automáticamente también al presionar F5 en esa sección
    setTimeout(() => {
        const contenedorResumen = document.getElementById('tabla-resumen-balances');
        // Si la tabla es visible en pantalla, la cargamos
        if (contenedorResumen && contenedorResumen.offsetParent !== null) {
             if (typeof window.cargarResumenBalances === 'function') {
                window.cargarResumenBalances();
            }
        }
    }, 500);
});

};