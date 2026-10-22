// ==========================================================================
// 📊 MÓDULO DE HISTORIAL Y CONTROL DE NÚMEROS (GLOBAL Y SEGURO)
// ==========================================================================

function initHistorialNumerosModule() {
    const inputFecha = document.getElementById('filtro-fecha-numeros');
    if (inputFecha && !inputFecha.value) {
        inputFecha.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    }

    cargarLoteriasParaFiltroHistorial();
    if (typeof window.cargarHistorialNumeros === 'function') {
        window.cargarHistorialNumeros();
    }

    // Activar búsqueda al presionar "Enter" en el nuevo buscador
    const inputBusqueda = document.getElementById('filtro-busqueda-numero');
    if (inputBusqueda && !inputBusqueda.dataset.listenerAttached) {
        inputBusqueda.dataset.listenerAttached = 'true';
        inputBusqueda.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                if (typeof window.cargarHistorialNumeros === 'function') window.cargarHistorialNumeros();
            }
        });
    }
}
window.initHistorialNumerosModule = initHistorialNumerosModule;

async function cargarLoteriasParaFiltroHistorial() {
    try {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) return;

        const { data, error } = await supabase.from('sorteos').select('id, nombre, estatus');
        if (error) throw error;

        const selectFiltro = document.getElementById('filtro-loteria-numeros');
        if (!selectFiltro) return;

        selectFiltro.innerHTML = '<option value="TODAS">Todas las Loterías</option>';
        if (data && data.length > 0) {
            data.forEach(loteria => {
                const option = document.createElement('option');
                option.value = String(loteria.nombre).toUpperCase();
                option.textContent = loteria.nombre;
                selectFiltro.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Error al cargar loterías:", err);
    }
}

window.cargarHistorialNumeros = async function() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const inputFecha = document.getElementById('filtro-fecha-numeros');
    const fechaFiltro = (inputFecha && inputFecha.value) ? inputFecha.value : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    
    const loteriaFiltro = document.getElementById('filtro-loteria-numeros')?.value || 'TODAS';
    const tipoFiltro = document.getElementById('filtro-tipo-numeros')?.value || 'todos';
    
    // 🔍 CAPTURAR EL VALOR DEL NUEVO BUSCADOR
    const busquedaFiltro = document.getElementById('filtro-busqueda-numero')?.value.trim() || '';

    const tbody = document.getElementById('tabla-historial-cuerpo');

    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-cyan-400 font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando números vendidos...</td></tr>`;

    try {
        const { data: reglas } = await supabase.from('restricciones_vendedor').select('*');
        const mapaTopes = {};
        const topeGlobalDefault = 20.00;
        
        (reglas || []).forEach(r => {
            const lKey = String(r.loteria || 'TODAS').toUpperCase();
            const tKey = String(r.tipo_jugada || 'todos').toLowerCase();
            const nKey = String(r.numero_especifico || '*').trim();
            const max = parseFloat(r.monto_maximo || 0);
            mapaTopes[nKey === '*' || nKey === '+' ? `${lKey}_${tKey}_GENERAL` : `${lKey}_${tKey}_${nKey}`] = max;
        });

        const startOfDay = `${fechaFiltro}T00:00:00`;
        const endOfDay = `${fechaFiltro}T23:59:59`;

        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        
        let queryTickets = supabase.from('tickets').select('id').gte('created_at', startOfDay).lte('created_at', endOfDay);

        if (rol.includes('supervisor')) {
            const zonaSup = String(sesion.zona || '').trim().toLowerCase();
            const { data: bData } = await supabase.from('bancas').select('id, zona');
            const idsPermitidos = (bData || []).filter(b => String(b.zona || '').trim().toLowerCase() === zonaSup).map(b => String(b.id));
            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        } else if (!rol.includes('admin') && !rol.includes('supervisor')) {
            const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;
            const { data: bData } = await supabase.from('bancas').select('id').or(`nombre_banca.eq.${nombreUsuario},vendedor_nombre.eq.${nombreUsuario}`);
            const idsPermitidos = (bData || []).map(b => String(b.id));
            queryTickets = queryTickets.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        }

        const { data: ticketsData } = await queryTickets;
        const idsTicketsPermitidos = new Set((ticketsData || []).map(t => String(t.id)));

        const { data: jugadasData, error: errJugadas } = await supabase
            .from('jugadas')
            .select('sorteo_nombre, tipo, numero, monto, estatus, estado, ticket_id')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (errJugadas) throw errJugadas;

        const jugadasPermitidas = (jugadasData || []).filter(j => idsTicketsPermitidos.has(String(j.ticket_id)));
        const acumuladoVentas = {};

        jugadasPermitidas.forEach(j => {
            if (String(j.estatus || j.estado).toLowerCase() === 'cancelado') return;

            const sorteoNombre = String(j.sorteo_nombre || 'GENERAL').toUpperCase();
            const tipoJ = String(j.tipo || 'chance').toLowerCase();
            let numJ = String(j.numero || '').trim();
            const montoJ = parseFloat(j.monto || 0);

            if (tipoJ === 'pale' && numJ.length === 4) {
                numJ = [numJ.substring(0, 2), numJ.substring(2, 4)].sort().join('');
            }

            // APLICAR TODOS LOS FILTROS
            if (loteriaFiltro !== 'TODAS' && !sorteoNombre.includes(loteriaFiltro)) return;
            if (tipoFiltro !== 'todos' && tipoJ !== tipoFiltro) return;
            
            // 🔍 FILTRAR POR NÚMERO BUSCADO (Si hay texto, verifica que el número lo contenga)
            if (busquedaFiltro && !numJ.includes(busquedaFiltro)) return;

            const clave = `${sorteoNombre}_${tipoJ}_${numJ}`;
            if (!acumuladoVentas[clave]) {
                acumuladoVentas[clave] = { loteria: sorteoNombre, tipo: tipoJ, numero: numJ, totalVendido: 0 };
            }
            acumuladoVentas[clave].totalVendido += montoJ;
        });

        const listaResultados = Object.values(acumuladoVentas).sort((a, b) => b.totalVendido - a.totalVendido);

        if (listaResultados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No hay números vendidos con los filtros seleccionados.</td></tr>`;
            return;
        }

        tbody.innerHTML = listaResultados.map(item => {
            const topeMax = mapaTopes[`${item.loteria}_${item.tipo}_${item.numero}`] || 
                            mapaTopes[`TODAS_${item.tipo}_GENERAL`] || 
                            mapaTopes[`TODAS_todos_GENERAL`] || topeGlobalDefault;

            const porcentaje = Math.min(Math.round((item.totalVendido / topeMax) * 100), 100);
            let colorClase = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            let semaforoTexto = 'Disponible (Verde)';
            let barraColor = 'bg-emerald-500';

            if (porcentaje >= 90) {
                colorClase = 'bg-rose-500/20 text-rose-400 border-rose-500/30'; semaforoTexto = 'Agotado (Rojo)'; barraColor = 'bg-rose-500';
            } else if (porcentaje >= 50) {
                colorClase = 'bg-amber-500/20 text-amber-400 border-amber-500/30'; semaforoTexto = 'Moderado (Amarillo)'; barraColor = 'bg-amber-500';
            }

            return `
                <tr class="hover:bg-slate-750 transition border-b border-slate-700/50 font-mono">
                    <td class="p-3 font-bold text-slate-300 uppercase">${item.loteria}</td>
                    <td class="p-3 uppercase text-xs text-cyan-300 font-sans font-semibold">${item.tipo}</td>
                    <td class="p-3 text-lg font-black text-white tracking-widest">${item.numero}</td>
                    <td class="p-3 text-right font-bold text-cyan-400">$${item.totalVendido.toFixed(2)}</td>
                    <td class="p-3 text-right text-slate-400">$${topeMax.toFixed(2)}</td>
                    <td class="p-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${colorClase}">${semaforoTexto}</span>
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                <div class="${barraColor} h-full rounded-full transition-all duration-500" style="width: ${porcentaje}%"></div>
                            </div>
                            <span class="text-xs font-bold text-slate-300 w-10 text-right">${porcentaje}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error en el historial de números:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al consultar los datos.</td></tr>`;
    }
};

// Auto-inicialización segura al cargar la vista
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tabla-historial-cuerpo')) {
        initHistorialNumerosModule();
    }
});