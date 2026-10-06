// ==========================================================
// MÓDULO: RESULTADOS Y ESCRUTINIO DE SORTEOS POR FECHA
// Archivo: js/resultados.js
// ==========================================================

/**
 * Inicializa el input de fecha con el día actual si está vacío.
 */
function inicializarFiltroFechaResultados() {
    const inputFecha = document.getElementById('filtroFechaResultados');
    if (inputFecha && !inputFecha.value) {
        const hoy = new Date();
        const year = hoy.getFullYear();
        const month = String(hoy.getMonth() + 1).padStart(2, '0');
        const day = String(hoy.getDate()).padStart(2, '0');
        inputFecha.value = `${year}-${month}-${day}`;
    }
}

/**
 * Carga la lista de sorteos y sus resultados según la fecha seleccionada.
 */
async function cargarResultadosPorFecha() {
    inicializarFiltroFechaResultados();

    const inputFecha = document.getElementById('filtroFechaResultados');
    const fechaSeleccionada = inputFecha ? inputFecha.value : new Date().toISOString().split('T')[0];

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) {
        console.error("Cliente de Supabase no inicializado.");
        return;
    }

    try {
        // 1. Consultar catálogo de sorteos
        const { data: sorteos, error: errSorteos } = await supabase
            .from('sorteos')
            .select('*')
            .order('id', { ascending: true });

        if (errSorteos) throw errSorteos;

        // 2. Consultar resultados específicos de la fecha seleccionada
        const { data: resultados, error: errResultados } = await supabase
            .from('resultados_sorteos')
            .select('*')
            .eq('fecha', fechaSeleccionada);

        if (errResultados) throw errResultados;

        // Crear mapa indexado por sorteo_id
        const resultadosMap = {};
        (resultados || []).forEach(r => {
            resultadosMap[r.sorteo_id] = r;
        });

        // 3. Renderizar la tabla con la información obtenida
        renderizarTablaEscrutinio(sorteos || [], resultadosMap, fechaSeleccionada);

    } catch (err) {
        console.error("Error al cargar resultados de la fecha:", err);
    }
}
window.cargarResultadosPorFecha = cargarResultadosPorFecha;

/**
 * Renderiza dinámicamente las filas de los sorteos y sus campos de entrada.
 */
function renderizarTablaEscrutinio(sorteos, resultadosMap, fecha) {
    const contenedor = document.getElementById('tabla-escrutinio-body') || document.getElementById('contenedorSorteosEscrutinio');
    if (!contenedor) return;

    if (sorteos.length === 0) {
        contenedor.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-6 text-slate-400">No hay sorteos registrados en el sistema.</td>
            </tr>`;
        return;
    }

    let html = '';
    sorteos.forEach(sorteo => {
        const res = resultadosMap[sorteo.id] || {};
        const num1 = res.primero ?? res.num1 ?? res.ganador_1 ?? '';
        const num2 = res.segundo ?? res.num2 ?? res.ganador_2 ?? '';
        const num3 = res.tercero ?? res.num3 ?? res.ganador_3 ?? '';
        const yaRegistrado = Boolean(res.id || num1 !== '');

        html += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition">
                <td class="py-3 px-4 font-bold text-white">${sorteo.nombre || sorteo.nombre_sorteo}</td>
                <td class="py-3 px-4 text-center">
                    <input type="text" id="num1-${sorteo.id}" maxlength="2" value="${num1}" placeholder="1er"
                        class="w-14 text-center bg-slate-900 border border-slate-700 text-amber-400 font-bold rounded-lg py-1 focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="py-3 px-4 text-center">
                    <input type="text" id="num2-${sorteo.id}" maxlength="2" value="${num2}" placeholder="2do"
                        class="w-14 text-center bg-slate-900 border border-slate-700 text-amber-400 font-bold rounded-lg py-1 focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="py-3 px-4 text-center">
                    <input type="text" id="num3-${sorteo.id}" maxlength="2" value="${num3}" placeholder="3er"
                        class="w-14 text-center bg-slate-900 border border-slate-700 text-amber-400 font-bold rounded-lg py-1 focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="py-3 px-4 text-right">
                    <button type="button" onclick="guardarResultadoSorteo(${sorteo.id})" 
                        class="${yaRegistrado ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                        ${yaRegistrado ? '✏️ Actualizar' : '💾 Guardar'}
                    </button>
                </td>
            </tr>
        `;
    });

    contenedor.innerHTML = html;
}

/**
 * Guarda o actualiza los números ganadores vinculando la fecha activa.
 */
async function guardarResultadoSorteo(sorteoId) {
    const inputFecha = document.getElementById('filtroFechaResultados');
    const fechaSeleccionada = inputFecha ? inputFecha.value : new Date().toISOString().split('T')[0];

    const num1 = (document.getElementById(`num1-${sorteoId}`)?.value || '').trim();
    const num2 = (document.getElementById(`num2-${sorteoId}`)?.value || '').trim();
    const num3 = (document.getElementById(`num3-${sorteoId}`)?.value || '').trim();

    if (!num1) {
        alert("Debes ingresar al menos el primer número ganador.");
        return;
    }

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('resultados_sorteos')
            .upsert({
                sorteo_id: sorteoId,
                fecha: fechaSeleccionada,
                primero: num1,
                segundo: num2,
                tercero: num3,
                updated_at: new Date().toISOString()
            }, { onConflict: 'sorteo_id,fecha' });

        if (error) throw error;

        alert(`✅ Resultado guardado correctamente para la fecha ${fechaSeleccionada}.`);
        cargarResultadosPorFecha();

    } catch (err) {
        console.error("Error al guardar resultado:", err);
        alert("Error al guardar: " + err.message);
    }
}
window.guardarResultadoSorteo = guardarResultadoSorteo;

// Autocarga automática al detectar la vista de resultados
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('filtroFechaResultados')) {
        cargarResultadosPorFecha();
    }
});
// ==========================================================
// ARCHIVO: js/resultados.js
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarFechas();
    inicializarFormularioResultados();
    cargarHistorialResultados();
});

// Asignar fecha de hoy a ambos campos por defecto
function inicializarFechas() {
    const hoy = new Date().toISOString().split('T')[0];
    const inputFechaForm = document.getElementById('result-fecha');
    const inputFiltro = document.getElementById('filtro-fecha-historial');

    if (inputFechaForm && !inputFechaForm.value) inputFechaForm.value = hoy;
    if (inputFiltro && !inputFiltro.value) inputFiltro.value = hoy;
}

// Cargar el historial filtrado por fecha
async function cargarHistorialResultados() {
    inicializarFechas();
    const filtroFecha = document.getElementById('filtro-fecha-historial')?.value;
    const tbody = document.getElementById('tabla-historial-resultados');

    if (!tbody) return;

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;

    try {
        let query = supabase.from('resultados_sorteos').select('*, sorteos(nombre)').order('created_at', { ascending: false });

        if (filtroFecha) {
            query = query.eq('fecha', filtroFecha);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-4 text-slate-500">
                        No hay números registrados para la fecha ${filtroFecha || 'seleccionada'}.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.map(res => {
            const nombreSorteo = res.sorteos?.nombre || res.sorteo_nombre || 'Sorteo';
            const jsonStr = JSON.stringify(res).replace(/"/g, '&quot;');

            return `
                <tr class="hover:bg-slate-700/30 transition">
                    <td class="p-3 font-semibold text-white">${nombreSorteo}</td>
                    <td class="p-3 text-slate-400">${res.fecha}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${res.primero || res.p1 || '--'}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${res.segundo || res.p2 || '--'}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${res.tercero || res.p3 || '--'}</td>
                    <td class="p-3 text-center">
                        <button type="button" onclick="cargarResultadoEnFormulario(${jsonStr})" 
                            class="text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg font-bold transition">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar historial:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-rose-400">Error al cargar datos</td></tr>`;
    }
}
window.cargarHistorialResultados = cargarHistorialResultados;

// Cargar un resultado existente en el formulario para editarlo
function cargarResultadoEnFormulario(res) {
    if (!res) return;

    const fechaInput = document.getElementById('result-fecha');
    const selectSorteo = document.getElementById('results-loteria-select');
    const p1 = document.getElementById('result-p1');
    const p2 = document.getElementById('result-p2');
    const p3 = document.getElementById('result-p3');

    if (fechaInput) fechaInput.value = res.fecha;
    if (selectSorteo) selectSorteo.value = res.sorteo_id;
    if (p1) p1.value = res.primero || res.p1 || '';
    if (p2) p2.value = res.segundo || res.p2 || '';
    if (p3) p3.value = res.tercero || res.p3 || '';
}
window.cargarResultadoEnFormulario = cargarResultadoEnFormulario;

// Escuchar el envio del formulario
function inicializarFormularioResultados() {
    const form = document.getElementById('form-register-results');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fecha = document.getElementById('result-fecha')?.value;
        const sorteo_id = document.getElementById('results-loteria-select')?.value;
        const primero = document.getElementById('result-p1')?.value.trim();
        const segundo = document.getElementById('result-p2')?.value.trim();
        const tercero = document.getElementById('result-p3')?.value.trim();

        if (!fecha || !sorteo_id || !primero) {
            alert("Completa la fecha, el sorteo y el 1er premio.");
            return;
        }

        const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (!supabase) return;

        try {
            const { error } = await supabase.from('resultados_sorteos').upsert({
                sorteo_id: parseInt(sorteo_id),
                fecha: fecha,
                primero: primero,
                segundo: segundo,
                tercero: tercero,
                updated_at: new Date().toISOString()
            }, { onConflict: 'sorteo_id,fecha' });

            if (error) throw error;

            alert(`✅ Resultado guardado para la fecha ${fecha}`);
            
            // Sincronizar el filtro de la tabla con la fecha recién guardada
            const filtroFecha = document.getElementById('filtro-fecha-historial');
            if (filtroFecha) filtroFecha.value = fecha;
            
            cargarHistorialResultados();

        } catch (err) {
            console.error("Error al guardar:", err);
            alert("Error al guardar: " + err.message);
        }
    });
}