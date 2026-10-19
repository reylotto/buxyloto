// ==========================================================================
// 📊 MÓDULO DE HISTORIAL Y CONTROL DE NÚMEROS (DASHBOARD ADMINISTRATIVO)
// ==========================================================================

// ==========================================
// CARGAR LOTERÍAS DINÁMICAS EN EL FILTRO
// ==========================================
async function cargarLoteriasParaFiltroHistorial() {
    try {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            console.warn("Supabase no está inicializado aún para cargar loterías en historial.");
            return;
        }

        const { data, error } = await supabase
            .from('sorteos')
            .select('id, nombre, estatus');

        if (error) throw error;

        const selectFiltro = document.getElementById('filtro-loteria-numeros');
        if (!selectFiltro) return;

        // Limpiar opciones previas pero mantener "TODAS"
        selectFiltro.innerHTML = '<option value="TODAS">Todas las Loterías</option>';

        // Rellenar con los datos dinámicos
        if (data && data.length > 0) {
            data.forEach(loteria => {
                const option = document.createElement('option');
                // Usamos el nombre en mayúsculas como 'value' porque en cargarHistorialNumeros 
                // se filtra comparando con sorteoTicket (que está en mayúsculas).
                option.value = String(loteria.nombre).toUpperCase();
                option.textContent = loteria.nombre;
                selectFiltro.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Error al sincronizar loterías en el filtro de historial:", err);
    }
}

// ==========================================
// FUNCIÓN PRINCIPAL DE CONSULTA Y SEMÁFORO
// ==========================================
window.cargarHistorialNumeros = async function() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) {
        console.error("Supabase no está inicializado.");
        return alert("Error de conexión con la base de datos.");
    }

    const inputFecha = document.getElementById('filtro-fecha-numeros');
    const fechaFiltro = (inputFecha && inputFecha.value) ? inputFecha.value : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    
    const loteriaFiltro = document.getElementById('filtro-loteria-numeros')?.value || 'TODAS';
    const tipoFiltro = document.getElementById('filtro-tipo-numeros')?.value || 'todos';
    const tbody = document.getElementById('tabla-historial-cuerpo');

    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-cyan-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando jugadas en la base de datos...</td></tr>`;

    try {
        // 1. Traer reglas de riesgo y topes
        const { data: reglas, error: errReglas } = await supabase.from('restricciones_vendedor').select('*');
        if (errReglas) throw errReglas;
        
        let topeGlobalDefault = 20.00;
        const mapaTopes = {};
        
        (reglas || []).forEach(r => {
            const lKey = String(r.loteria || 'TODAS').toUpperCase();
            const tKey = String(r.tipo_jugada || 'todos').toLowerCase();
            const nKey = String(r.numero_especifico || '*').trim();
            const max = parseFloat(r.monto_maximo || 0);
            
            if (nKey === '*' || nKey === '+') {
                mapaTopes[`${lKey}_${tKey}_GENERAL`] = max;
            } else {
                mapaTopes[`${lKey}_${tKey}_${nKey}`] = max;
            }
        });

        // 2. Definir rango de inicio y fin del día para filtrar por created_at
        const startOfDay = new Date(`${fechaFiltro}T00:00:00-05:00`).toISOString();
        const endOfDay = new Date(`${fechaFiltro}T23:59:59-05:00`).toISOString();

        // 3. Consultar directamente a la tabla JUGADAS
        const { data: jugadas, error: errJugadas } = await supabase
            .from('jugadas')
            .select('sorteo_nombre, tipo, numero, monto, estatus, estado')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (errJugadas) throw errJugadas;

        // 4. Agrupar y sumar las jugadas
        const acumuladoVentas = {};

        (jugadas || []).forEach(j => {
            // Filtramos las canceladas
            if (j.estatus === 'cancelado' || j.estado === 'cancelado') return;

            const sorteoNombre = String(j.sorteo_nombre || 'GENERAL').toUpperCase();
            const tipoJ = String(j.tipo || 'chance').toLowerCase();
            let numJ = String(j.numero || '').trim();
            const montoJ = parseFloat(j.monto || 0);

            // Normalizar Palés ordenando los números
            if (tipoJ === 'pale' && numJ.length === 4) {
                const p1 = numJ.substring(0, 2);
                const p2 = numJ.substring(2, 4);
                numJ = [p1, p2].sort().join('');
            }

            // Aplicar filtros visuales de la interfaz
            if (loteriaFiltro !== 'TODAS' && !sorteoNombre.includes(loteriaFiltro)) return;
            if (tipoFiltro !== 'todos' && tipoJ !== tipoFiltro) return;

            // Agrupar
            const clave = `${sorteoNombre}_${tipoJ}_${numJ}`;
            if (!acumuladoVentas[clave]) {
                acumuladoVentas[clave] = {
                    loteria: sorteoNombre,
                    tipo: tipoJ,
                    numero: numJ,
                    totalVendido: 0
                };
            }
            acumuladoVentas[clave].totalVendido += montoJ;
        });

        const listaResultados = Object.values(acumuladoVentas);

        if (listaResultados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No hay jugadas registradas para esta fecha y filtros seleccionados.</td></tr>`;
            return;
        }

        // Ordenar por el número que más se ha vendido
        listaResultados.sort((a, b) => b.totalVendido - a.totalVendido);

        // Renderizar en la tabla
        tbody.innerHTML = '';
        listaResultados.forEach(item => {
            const topeMax = mapaTopes[`${item.loteria}_${item.tipo}_${item.numero}`] || 
                            mapaTopes[`TODAS_${item.tipo}_GENERAL`] || 
                            mapaTopes[`TODAS_todos_GENERAL`] || 
                            topeGlobalDefault;

            const porcentaje = Math.min(Math.round((item.totalVendido / topeMax) * 100), 100);

            let colorClase = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            let semaforoTexto = 'Disponible (Verde)';
            let barraColor = 'bg-emerald-500';

            if (porcentaje >= 90) {
                colorClase = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                semaforoTexto = 'Agotado (Rojo)';
                barraColor = 'bg-rose-500';
            } else if (porcentaje >= 50) {
                colorClase = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                semaforoTexto = 'Moderado (Amarillo)';
                barraColor = 'bg-amber-500';
            }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-750 transition border-b border-slate-700/50 font-mono";
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-300 uppercase">${item.loteria}</td>
                <td class="p-3 uppercase text-xs text-cyan-300 font-sans font-semibold">${item.tipo}</td>
                <td class="p-3 text-lg font-black text-white tracking-widest">${item.numero}</td>
                <td class="p-3 text-right font-bold text-cyan-400">$${item.totalVendido.toFixed(2)}</td>
                <td class="p-3 text-right text-slate-400">$${topeMax.toFixed(2)}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${colorClase}">
                        ${semaforoTexto}
                    </span>
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div class="${barraColor} h-full rounded-full transition-all duration-500" style="width: ${porcentaje}%"></div>
                        </div>
                        <span class="text-xs font-bold text-slate-300 w-10 text-right">${porcentaje}%</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error al procesar el historial de números:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al cargar los datos. Verifique la consola.</td></tr>`;
    }
};

// ==========================================
// AUTO-INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('filtro-fecha-numeros');
    if (inputFecha) {
        inputFecha.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    }
    
    // Dar un leve retraso de 1 segundo para asegurar que Supabase esté conectado 
    // antes de inyectar las loterías en el selector
    setTimeout(cargarLoteriasParaFiltroHistorial, 1000);
});