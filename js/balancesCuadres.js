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

    const selectJugada = document.querySelector('select[name="jugada"]') || document.getElementById('filtro-jugada');
    if (selectJugada && !selectJugada.innerHTML.includes('chance')) {
        if(!selectJugada.querySelector('option[value="chance"]')) {
             selectJugada.insertAdjacentHTML('beforeend', '<option value="chance">Chance</option>');
        }
        if(!selectJugada.querySelector('option[value="billete"]')) {
             selectJugada.insertAdjacentHTML('beforeend', '<option value="billete">Billete</option>');
        }
    }

    await cargarListaVendedores();
    await cargarFiltrosAisladosBalances();
    await window.cargarResumenBalances();
}
window.initBalancesCuadresModule = initBalancesCuadresModule;

async function cargarFiltrosAisladosBalances() {
    try {
        const inquilinoId = localStorage.getItem('inquilino_id');

        let querySuper = window.supabase.from('usuarios').select('id, nombre_banca, username, nombre').eq('rol', 'supervisor');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            querySuper = querySuper.eq('inquilino_id', inquilinoId);
        } else {
            querySuper = querySuper.is('inquilino_id', null);
        }
        
        const { data: superData, error: errSuper } = await querySuper;
        if (errSuper) throw errSuper;
        
        const selectSuper = document.querySelector('select#filtro-supervisor') || document.querySelector('select[name="supervisor"]');
        if (selectSuper) {
            selectSuper.innerHTML = '<option value="TODOS">Todos los supervisores</option>';
            (superData || []).forEach(s => {
                const nombreMostrar = s.nombre || s.nombre_banca || s.username || 'Supervisor';
                selectSuper.insertAdjacentHTML('beforeend', `<option value="${s.id}">${nombreMostrar}</option>`);
            });
        }

        let queryLot = window.supabase.from('sorteos').select('id, nombre');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            queryLot = queryLot.eq('inquilino_id', inquilinoId);
        } else {
            queryLot = queryLot.is('inquilino_id', null);
        }
        
        const { data: lotData, error: errLot } = await queryLot;
        if (errLot) throw errLot;

        const selectLot = document.querySelector('select#filtro-loteria') || document.querySelector('select[name="loteria"]');
        if (selectLot) {
            selectLot.innerHTML = '<option value="TODAS">Todas las loterías</option>';
            (lotData || []).forEach(l => {
                selectLot.insertAdjacentHTML('beforeend', `<option value="${l.id}">${l.nombre}</option>`);
            });
        }
    } catch (e) {
        console.error("Error cargando filtros aislados en Balances:", e);
    }
}

async function cargarListaVendedores() {
    try {
        let query = window.supabase.from('bancas').select('*');
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            query = query.eq('inquilino_id', inquilinoId);
        } else {
            query = query.is('inquilino_id', null);
        }

        const { data: bancas } = await query;
        let bancasData = bancas || [];

        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        const zonaUsuario = String(sesion.zona || '').trim().toLowerCase();
        const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;

        if (rol.includes('supervisor')) {
            bancasData = bancasData.filter(b => String(b.zona || '').trim().toLowerCase() === zonaUsuario);
        } else if (!rol.includes('admin')) {
            bancasData = bancasData.filter(b => b.nombre_banca === nombreUsuario || b.vendedor_nombre === nombreUsuario);
        }

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
window.cargarListaVendedores = cargarListaVendedores;

window.cargarResumenBalances = async function() {
    const tbody = document.getElementById('tabla-resumen-balances');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-emerald-400"><i class="fa-solid fa-spinner fa-spin"></i> Calculando balances globales...</td></tr>';

    try {
        const inquilinoId = localStorage.getItem('inquilino_id');

        if (!estadoBalances.vendedores || estadoBalances.vendedores.length === 0) {
            await cargarListaVendedores();
        }

        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && estadoBalances.vendedores) {
            estadoBalances.vendedores = estadoBalances.vendedores.filter(b => String(b.inquilino_id) === String(inquilinoId));
        }

        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        
        let queryTickets = window.supabase.from('tickets').select('*');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            queryTickets = queryTickets.eq('inquilino_id', inquilinoId);
        } else {
            queryTickets = queryTickets.is('inquilino_id', null);
        }

        if (rol.includes('supervisor')) {
            const zonaSup = String(sesion.zona || '').trim().toLowerCase();
            let queryBancasSup = window.supabase.from('bancas').select('id, zona');
            if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
                queryBancasSup = queryBancasSup.eq('inquilino_id', inquilinoId);
            } else {
                queryBancasSup = queryBancasSup.is('inquilino_id', null);
            }
            const { data: bData } = await queryBancasSup;
            const idsPermitidos = (bData || [])
                .filter(b => String(b.zona || '').trim().toLowerCase() === zonaSup)
                .map(b => String(b.id));

            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        } else if (!rol.includes('admin')) {
            const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;
            let queryBancasCaj = window.supabase.from('bancas').select('id').or(`nombre_banca.eq.${nombreUsuario},vendedor_nombre.eq.${nombreUsuario}`);
            if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
                queryBancasCaj = queryBancasCaj.eq('inquilino_id', inquilinoId);
            } else {
                queryBancasCaj = queryBancasCaj.is('inquilino_id', null);
            }
            const { data: bData } = await queryBancasCaj;
            const idsPermitidos = (bData || []).map(b => String(b.id));
            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        }

        const { data: ticketsData } = await queryTickets;
        const { data: pagosBD } = await window.supabase.from('pagos_bancas').select('*');
        estadoBalances.pagosLocales = pagosBD || [];

        // Consultar gastos operativos para descontar los asignados a cada banca
        let queryGastos = window.supabase.from('gastos').select('*');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            queryGastos = queryGastos.eq('inquilino_id', inquilinoId);
        } else {
            queryGastos = queryGastos.is('inquilino_id', null);
        }
        const { data: gastosBD } = await queryGastos;

        let tickets = ticketsData || [];
        let html = '';

        if (!estadoBalances.vendedores || estadoBalances.vendedores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400">No hay bancas registradas para este inquilino.</td></tr>';
            return;
        }

        estadoBalances.vendedores.forEach(b => {
            const ticketsVendedor = (tickets || []).filter(t => String(t.banca_id) === String(b.id) && String(t.estatus || t.estado).toLowerCase() !== 'cancelado' && String(t.estatus || t.estado).toLowerCase() !== 'anulado');
            
            let ventas = 0; let premios = 0; let comisiones = 0;
            const comisionPct = parseFloat(b.comision || 10) / 100;

            ticketsVendedor.forEach(t => {
                const ventaT = parseFloat(t.monto_total || t.monto || 0);
                ventas += ventaT;
                comisiones += ventaT * comisionPct;
                const estT = String(t.estatus || t.estado).toLowerCase();
                if (estT === 'premiado' || estT === 'ganador') {
                    let premioVal = parseFloat(t.monto_premio || t.premio || 0);
                    if(premioVal === 0 && Array.isArray(t.jugadas || t.detalles)){
                        (t.jugadas || t.detalles).forEach(j => {
                            premioVal += parseFloat(j.premio || j.monto_premio || 0);
                        });
                    }
                    premios += premioVal;
                }
            });

            const gastosVendedor = (gastosBD || [])
                .filter(g => g.banca_id && String(g.banca_id) === String(b.id))
                .reduce((acc, g) => acc + parseFloat(g.monto || 0), 0);

            const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.banca_id) === String(b.id));
            const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);
            const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);

            const resultadoNeto = ventas - premios - comisiones - gastosVendedor;
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

window.irACuadreDetalle = async function(bancaId) {
    const select = document.getElementById('cuadre-vendedor');
    if (select) {
        if (select.options.length <= 1) {
            await cargarListaVendedores();
        }
        select.value = String(bancaId);
    }
    if (typeof window.mostrarTabFinanzas === 'function') {
        window.mostrarTabFinanzas('nuevo-cuadre');
    }
    await window.generarDetalleCuadre();
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

        // Consultar gastos asignados a esta banca en el rango de fechas
        let queryGastosBanca = window.supabase.from('gastos')
            .select('*')
            .eq('banca_id', String(bancaId));
        if (fDesde) queryGastosBanca = queryGastosBanca.gte('fecha', fDesde);
        if (fHasta) queryGastosBanca = queryGastosBanca.lte('fecha', fHasta);

        const { data: gastosBanca } = await queryGastosBanca;
        const totGastos = (gastosBanca || []).reduce((acc, g) => acc + parseFloat(g.monto || 0), 0);

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

        const totResultado = totVentas - totPremios - totComision - totGastos;
        const balanceNeto = totResultado - totIngresos + totEgresos;

        document.getElementById('cuadre-val-ventas').textContent = `$${totVentas.toFixed(2)}`;
        document.getElementById('cuadre-val-premios').textContent = `$${totPremios.toFixed(2)}`;
        document.getElementById('cuadre-val-comision').textContent = `$${totComision.toFixed(2)}`;
        const elGastosCuadre = document.getElementById('cuadre-val-gastos');
        if (elGastosCuadre) elGastosCuadre.textContent = `-$${totGastos.toFixed(2)}`;
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

// ==========================================================
// GESTIÓN DE GASTOS OPERATIVOS (SUPABASE)
// ==========================================================
window.cargarGastosOperativos = async function() {
    const tbody = document.getElementById('tabla-gastos-body');
    const totalEl = document.getElementById('total-gastos-kpi');
    const selectBanca = document.getElementById('gasto-banca');
    const inputFecha = document.getElementById('gasto-fecha');

    if (inputFecha && !inputFecha.value) {
        inputFecha.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    }

    if (selectBanca && selectBanca.options.length <= 1 && estadoBalances.vendedores) {
        estadoBalances.vendedores.forEach(b => {
            selectBanca.innerHTML += `<option value="${b.id}">${b.nombre_banca || b.vendedor_nombre || 'Banca ' + b.id}</option>`;
        });
    }

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-emerald-400"><i class="fa-solid fa-spinner fa-spin"></i> Cargando gastos...</td></tr>';

    try {
        const inquilinoId = localStorage.getItem('inquilino_id');
        let query = window.supabase.from('gastos').select('*').order('fecha', { ascending: false });
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            query = query.eq('inquilino_id', inquilinoId);
        } else {
            query = query.is('inquilino_id', null);
        }

        const { data: gastos, error } = await query;
        if (error) throw error;

        let total = 0;
        if (!gastos || gastos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-500">No hay gastos registrados aún.</td></tr>';
            if (totalEl) totalEl.textContent = '$0.00';
            return;
        }

        tbody.innerHTML = gastos.map(g => {
            const mnt = parseFloat(g.monto || 0);
            total += mnt;
            return `
                <tr class="hover:bg-slate-700/30 border-b border-slate-700/50">
                    <td class="p-3 pl-4 font-mono text-slate-300">${g.fecha || '-'}</td>
                    <td class="p-3 font-semibold text-white">${g.banca_nombre || 'General'}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px]">${g.categoria || 'Operativo'}</span></td>
                    <td class="p-3 text-slate-300">${g.concepto}</td>
                    <td class="p-3 text-right font-mono font-bold text-rose-400">-$${mnt.toFixed(2)}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.eliminarGastoOperativo('${g.id}')" class="text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-1 rounded text-xs" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    } catch (e) {
        console.error("Error cargando gastos:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-400">Error al cargar gastos: ${e.message}</td></tr>`;
    }
};

window.registrarGastoOperativo = async function() {
    const bancaSelect = document.getElementById('gasto-banca');
    const bancaId = bancaSelect?.value || null;
    const bancaNombre = bancaId ? bancaSelect.options[bancaSelect.selectedIndex].text : 'General';
    const categoria = document.getElementById('gasto-categoria')?.value || 'Operativo';
    const concepto = document.getElementById('gasto-concepto')?.value.trim();
    const monto = parseFloat(document.getElementById('gasto-monto')?.value || 0);
    const fecha = document.getElementById('gasto-fecha')?.value;

    if (!concepto || isNaN(monto) || monto <= 0) {
        return alert("⚠️ Complete el concepto y un monto válido.");
    }

    try {
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const inquilinoId = localStorage.getItem('inquilino_id');

        const nuevoGasto = {
            banca_id: bancaId,
            banca_nombre: bancaNombre,
            categoria,
            concepto,
            monto,
            fecha,
            responsable: sesion.nombre || sesion.username || 'Admin'
        };

        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            nuevoGasto.inquilino_id = inquilinoId;
        }

        const { error } = await window.supabase.from('gastos').insert([nuevoGasto]);
        if (error) throw error;

        document.getElementById('form-registrar-gasto').reset();
        document.getElementById('gasto-fecha').value = fecha;
        alert("✅ Gasto registrado correctamente.");
        await window.cargarGastosOperativos();
        if (typeof window.generarReporte === 'function') window.generarReporte();
        if (typeof window.cargarResumenBalances === 'function') window.cargarResumenBalances();
    } catch (e) {
        console.error("Error registrando gasto:", e);
        alert("❌ Error al guardar gasto: " + e.message);
    }
};

window.eliminarGastoOperativo = async function(id) {
    if (!confirm("¿Eliminar este registro de gasto?")) return;
    try {
        const { error } = await window.supabase.from('gastos').delete().eq('id', id);
        if (error) throw error;
        await window.cargarGastosOperativos();
        if (typeof window.generarReporte === 'function') window.generarReporte();
        if (typeof window.cargarResumenBalances === 'function') window.cargarResumenBalances();
    } catch (e) {
        alert("❌ Error al eliminar gasto: " + e.message);
    }
};