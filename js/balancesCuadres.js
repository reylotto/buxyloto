// ==========================================================
// MÓDULO DE CONTROL DE CUADRES Y BALANCES
// ==========================================================

let estadoBalances = {
    vendedores: [],
    pagosLocales: JSON.parse(localStorage.getItem('buxy_pagos_vendedores')) || [],
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
        let html = '';

        estadoBalances.vendedores.forEach(b => {
            const ticketsVendedor = (tickets || []).filter(t => String(t.banca_id) === String(b.id) && t.estatus !== 'cancelado');
            
            let ventas = 0; let premios = 0; let comisiones = 0;
            const comisionPct = parseFloat(b.comision || 10) / 100;

            ticketsVendedor.forEach(t => {
                const ventaT = parseFloat(t.monto_total || 0);
                ventas += ventaT;
                comisiones += ventaT * comisionPct;
                if (String(t.estatus).toLowerCase() === 'premiado') {
                    premios += parseFloat(t.monto_premio || 0);
                }
            });

            // Contabilidad Inteligente
            const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.bancaId) === String(b.id));
            const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);
            const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((acc, p) => acc + parseFloat(p.monto), 0);

            const resultadoNeto = ventas - premios - comisiones;
            const balanceFinal = resultadoNeto - totIngresos + totEgresos; // Si recibimos plata (ingreso) la deuda baja. Si le pagamos (egreso) la deuda sube.
            
            const colorClass = balanceFinal >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            const nombre = b.nombre_banca || b.vendedor_nombre;
            const grupo = b.zona || 'General';

            html += `
                <tr class="hover:bg-slate-700/30 border-b border-slate-700/50">
                    <td class="p-4 font-bold text-white">${nombre}</td>
                    <td class="p-4 text-slate-400">${grupo}</td>
                    <td class="p-4 text-center">
                        <span class="px-3 py-1 rounded-full border font-mono font-bold text-xs ${colorClass}">
                            $${balanceFinal.toFixed(2)}
                        </span>
                    </td>
                    <td class="p-4 text-right text-slate-400">Calculado Hoy</td>
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

// Se arregló el error de consola al hacer clic en "Cuadrar"
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

    const vendedor = estadoBalances.vendedores.find(v => String(v.id) === String(bancaId));
    estadoBalances.vendedorActual = vendedor;
    const comisionPct = parseFloat(vendedor?.comision || 10) / 100;

    document.getElementById('cuadre-nombre-vendedor').textContent = vendedor.nombre_banca || vendedor.vendedor_nombre;
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
            if (t.estatus === 'cancelado') return;
            const dia = t.created_at.split('T')[0];
            if (!agrupadoDias[dia]) agrupadoDias[dia] = { ventas: 0, premios: 0, comision: 0 };
            
            const venta = parseFloat(t.monto_total || 0);
            const comision = venta * comisionPct;
            let premio = 0;
            if (String(t.estatus).toLowerCase() === 'premiado') premio = parseFloat(t.monto_premio || 0);

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

        // Cargar Pagos Negativos/Positivos
        const pagosVendedor = estadoBalances.pagosLocales.filter(p => String(p.bancaId) === String(bancaId));
        
        const totIngresos = pagosVendedor.filter(p => p.tipo === 'ingreso').reduce((a, b) => a + parseFloat(b.monto), 0);
        const totEgresos = pagosVendedor.filter(p => p.tipo === 'egreso').reduce((a, b) => a + parseFloat(b.monto), 0);
        const impactoVisualPagos = totIngresos - totEgresos; // Solo para mostrar en la tablita de pagos

        const tbodyPagos = document.getElementById('tabla-pagos-negativos');
        tbodyPagos.innerHTML = pagosVendedor.map(p => {
            const esIngreso = p.tipo === 'ingreso';
            return `
            <tr class="border-b border-slate-700/50">
                <td class="p-3 pl-4 font-mono text-[10px]">${p.fecha}</td>
                <td class="p-3 text-right font-mono font-bold ${esIngreso ? 'text-cyan-400' : 'text-rose-400'}">${esIngreso ? '+$' : '-$'}${parseFloat(p.monto).toFixed(2)}</td>
                <td class="p-3 text-center text-slate-400">${esIngreso ? 'Banca Pagó a Casa' : 'Casa Pagó a Banca'}</td>
            </tr>
        `}).join('') || '<tr><td colspan="3" class="text-center py-4 text-slate-500">No hay pagos registrados.</td></tr>';

        // Matemáticas perfectas
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

window.procesarPagoVendedor = function(tipoMovimiento) {
    if (!estadoBalances.vendedorActual) return alert("Seleccione un vendedor primero.");
    const balanceTexto = document.getElementById('cuadre-val-balance').textContent.replace('$', '');
    const maxSaldo = parseFloat(balanceTexto);

    let mensaje = tipoMovimiento === 'ingreso' 
        ? `⬇️ RECIBIR DINERO DE BANCA\nLa banca le está entregando dinero a la Casa.\n\nIngrese el monto:`
        : `⬆️ PAGAR A LA BANCA\nUsted (La Casa) le está entregando dinero a la Banca por premios acumulados.\n\nIngrese el monto:`;

    const montoStr = prompt(mensaje);
    if (montoStr === null || montoStr.trim() === '') return;
    const monto = parseFloat(montoStr);
    
    if (isNaN(monto) || monto <= 0) return alert("Monto inválido. Ingrese un número mayor a 0 sin el signo de menos.");

    const nuevoPago = {
        bancaId: estadoBalances.vendedorActual.id,
        fecha: new Date().toLocaleString(),
        monto: monto,
        tipo: tipoMovimiento, // 'ingreso' o 'egreso'
        responsable: window.currentUserProfile?.email || 'Administrador'
    };

    estadoBalances.pagosLocales.push(nuevoPago);
    localStorage.setItem('buxy_pagos_vendedores', JSON.stringify(estadoBalances.pagosLocales));

    alert(`✅ Registro guardado exitosamente.\nEl balance se ha actualizado.`);
    window.generarDetalleCuadre(); 
};