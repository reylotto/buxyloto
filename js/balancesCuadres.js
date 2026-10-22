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
        let bancasData = bancas || [];

        // --- 🚨 INICIO DE FILTRO DE SEGURIDAD POR ROL 🚨 ---
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        
        // CORRECCIÓN: Forzamos minúsculas y quitamos espacios en blanco
        const zonaUsuario = String(sesion.zona || '').trim().toLowerCase();
        const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;

        if (rol.includes('supervisor')) {
            // CORRECCIÓN: Comparamos forzando también la zona de la base de datos a minúsculas
            bancasData = bancasData.filter(b => String(b.zona || '').trim().toLowerCase() === zonaUsuario);
        } else if (!rol.includes('admin')) {
            bancasData = bancasData.filter(b => b.nombre_banca === nombreUsuario || b.vendedor_nombre === nombreUsuario);
        }
        // --- FIN DE FILTRO DE SEGURIDAD ---

        estadoBalances.vendedores = bancasData;
        
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
        if (!estadoBalances.vendedores || estadoBalances.vendedores.length === 0) {
            await cargarListaVendedores();
        }

        // 🚨 FILTRO MATEMÁTICO ABSOLUTO EN LA BASE DE DATOS
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        
        let queryTickets = window.supabase.from('tickets').select('*');

        if (rol.includes('supervisor')) {
            const zonaSup = String(sesion.zona || '').trim().toLowerCase();
            const { data: bData } = await window.supabase.from('bancas').select('id, zona');
            
            const idsPermitidos = (bData || [])
                .filter(b => String(b.zona || '').trim().toLowerCase() === zonaSup)
                .map(b => String(b.id));

            // Filtrar desde la descarga para mayor seguridad y velocidad
            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        } else if (!rol.includes('admin')) {
            // Filtro para cajeros
            const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;
            const { data: bData } = await window.supabase.from('bancas')
                .select('id')
                .or(`nombre_banca.eq.${nombreUsuario},vendedor_nombre.eq.${nombreUsuario}`);
            const idsPermitidos = (bData || []).map(b => String(b.id));
            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        }

        const { data: ticketsData } = await queryTickets;
        const { data: pagosBD } = await window.supabase.from('pagos_bancas').select('*');
        estadoBalances.pagosLocales = pagosBD || [];

        let tickets = ticketsData || [];
        let html = '';

        estadoBalances.vendedores.forEach(b => {
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

            const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.banca_id) === String(b.id));
            const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);
            const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);

            const resultadoNeto = ventas - premios - comisiones;
            let balanceFinal = resultadoNeto - totIngresos + totEgresos; 
            balanceFinal = Math.round(balanceFinal * 100) / 100;
            
            const colorClass = balanceFinal >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            const nombre = b.nombre_banca || b.vendedor_nombre || b.name || `Banca #${b.id}`;
            const grupo = b.zona || 'General';
            
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
        console.error("Error cargando resumen de balances:", e); 
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

    if (!estadoBalances.vendedores || estadoBalances.vendedores.length === 0) {
        await cargarListaVendedores();
    }

    let vendedor = estadoBalances.vendedores.find(v => String(v.id) === String(bancaId));
    
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
            
            const rawDate = t.created_at || t.createdAt;
            if (!rawDate) return; 

            const dia = rawDate.split('T')[0];
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

        const { data: pagosBD } = await window.supabase.from('pagos_bancas').select('*');
        estadoBalances.pagosLocales = pagosBD || [];

        const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.banca_id) === String(bancaId));
        
        const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((a, b) => a + parseFloat(b.monto), 0);
        const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((a, b) => a + parseFloat(b.monto), 0);

        const tbodyPagos = document.getElementById('tabla-pagos-negativos');
        
        tbodyPagos.innerHTML = pagosVendedor.map(p => {
            const esIngreso = p.tipo === 'ingreso';
            const fechaDisplay = p.created_at ? new Date(p.created_at).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
            const tipoIcono = esIngreso ? '<i class="fa-solid fa-arrow-down text-emerald-400 mr-1" title="Banca Pagó a Casa"></i>' : '<i class="fa-solid fa-arrow-up text-rose-400 mr-1" title="Casa Pagó a Banca"></i>';
            return `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="p-3 pl-4 font-mono text-[10px] text-slate-300">${tipoIcono} ${fechaDisplay}</td>
                <td class="p-3 text-right font-mono font-bold ${esIngreso ? 'text-emerald-400' : 'text-rose-400'}">${esIngreso ? '+$' : '-$'}${parseFloat(p.monto).toFixed(2)}</td>
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
        
        let displayPagosStr = '$0.00';
        if (totIngresos > 0) displayPagosStr = `+$${totIngresos.toFixed(2)} (Recibido)`;
        if (totEgresos > 0) displayPagosStr = `-$${totEgresos.toFixed(2)} (Pagado)`;
        if (totIngresos > 0 && totEgresos > 0) displayPagosStr = `+$${totIngresos.toFixed(2)} / -$${totEgresos.toFixed(2)}`;
        document.getElementById('cuadre-val-pagos').textContent = displayPagosStr;
        
        const balEl = document.getElementById('cuadre-val-balance');
        balEl.textContent = `$${balanceNeto.toFixed(2)}`;
        balEl.className = `font-black font-mono text-xl ${balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
        
    } catch (e) {
        console.error("Error al generar cuadre:", e);
        alert("Ocurrió un error al cargar los datos: " + e.message);
    }
};

window.procesarPagoVendedor = async function(tipoMovimiento) {
    if (!estadoBalances.vendedorActual) return alert("Seleccione un vendedor primero.");

    const fechaSugerida = document.getElementById('cuadre-fecha-hasta')?.value || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

    let mensajeMonto = tipoMovimiento === 'ingreso' 
        ? `⬇️ RECIBIR DINERO DE BANCA\nLa banca le está entregando dinero a la Casa.\n\nIngrese el MONTO A RECIBIR:`
        : `⬆️ PAGAR A LA BANCA\nUsted (La Casa) le está entregando dinero a la Banca.\n\nIngrese el MONTO A PAGAR:`;

    const montoStr = prompt(mensajeMonto);
    if (montoStr === null || montoStr.trim() === '') return;
    const monto = parseFloat(montoStr);
    
    if (isNaN(monto) || monto <= 0) return alert("Monto inválido. Ingrese un número mayor a 0.");

    let mensajeFecha = `📅 SELECCIONAR FECHA DE CUADRE\n\n¿A qué día de venta pertenece este pago?\n(Use el formato YYYY-MM-DD)\n\nDeje la fecha mostrada para cuadrar el día seleccionado:`;
    
    const fechaInput = prompt(mensajeFecha, fechaSugerida);
    if (fechaInput === null || fechaInput.trim() === '') return;
    
    const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexFecha.test(fechaInput.trim())) {
        return alert("❌ Formato de fecha inválido. Debe ser YYYY-MM-DD (Ejemplo: 2026-10-18).");
    }

    try {
        // 🚨 CORRECCIÓN 1: LEER EL USUARIO REAL DIRECTO DE LA SESIÓN ACTIVA 🚨
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const responsable = sesion.nombre || sesion.username || sesion.email || 'Administrador';

        const b = estadoBalances.vendedorActual;
        const nombreBancaReal = b.nombre_banca || b.vendedor_nombre || b.name || `Banca ${b.id}`;
        
        const nuevoPago = {
            banca_id: String(b.id),
            banca_nombre: String(nombreBancaReal), 
            monto: monto,
            tipo: tipoMovimiento,
            responsable: responsable,
            fecha: fechaInput.trim() 
        };

        const { error } = await window.supabase.from('pagos_bancas').insert([nuevoPago]);
        if (error) throw error;

        alert(`✅ Cuadre de $${monto} registrado exitosamente para el día ${fechaInput}.`);
        
        await window.cargarResumenBalances();
        await window.generarDetalleCuadre(); 
        
    } catch (e) {
        console.error("Error al registrar pago en Supabase:", e);
        alert("❌ Error al guardar el pago: " + e.message);
    }
};

// 🚨 CORRECCIÓN 2: FUNCIÓN PARA ELIMINAR EL PAGO (FALTABA EN EL CÓDIGO) 🚨
window.eliminarPagoRegistrado = async function(pagoId) {
    if (!confirm('¿Está seguro de que desea anular y eliminar este pago registrado?')) return;
    
    try {
        const { error } = await window.supabase.from('pagos_bancas').delete().eq('id', pagoId);
        if (error) throw error;
        
        alert('✅ Pago eliminado correctamente.');
        await window.cargarResumenBalances();
        await window.generarDetalleCuadre();
    } catch (err) {
        console.error("Error al eliminar pago:", err);
        alert("❌ Error al eliminar el pago: " + err.message);
    }
};

// ==========================================================
// VIGILANTE AGRESIVO: CARGA AUTOMÁTICA DE LA PESTAÑA DE RESUMEN
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    const linksMenu = document.querySelectorAll('.nav-link, a');
    linksMenu.forEach(link => {
        if (link.textContent.includes('Balances & Cuadres') || link.dataset.target === 'balances-cuadres') {
            link.addEventListener('click', () => {
                setTimeout(() => {
                    if (typeof window.cargarResumenBalances === 'function') {
                        window.cargarResumenBalances();
                    }
                }, 300);
            });
        }
    });

    const botonesPestanas = document.querySelectorAll('button');
    botonesPestanas.forEach(btn => {
        if (btn.textContent.includes('Resumen de Balances')) {
            btn.addEventListener('click', () => {
                const tbody = document.getElementById('tabla-resumen-balances');
                if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-emerald-400"><i class="fa-solid fa-spinner fa-spin"></i> Cargando datos desde Supabase...</td></tr>';
                
                setTimeout(() => {
                    if (typeof window.cargarResumenBalances === 'function') {
                        window.cargarResumenBalances();
                    }
                }, 100);
            });
        }
    });

    const btnActualizarResumen = document.querySelector('button[onclick*="cargarResumenBalances"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Actualizar'));
    if (btnActualizarResumen) {
        btnActualizarResumen.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.cargarResumenBalances === 'function') {
                window.cargarResumenBalances();
            }
        });
    }

    setTimeout(() => {
        const contenedorResumen = document.getElementById('tabla-resumen-balances');
        if (contenedorResumen && contenedorResumen.innerHTML.includes('No hay datos')) {
             if (typeof window.cargarResumenBalances === 'function') {
                window.cargarResumenBalances();
            }
        }
    }, 1000);
});