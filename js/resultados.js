// ==========================================================
// ARCHIVO: js/resultados.js
// Módulo de Escrutinio e Historial de Resultados por Fecha
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarFechas();
    inicializarFormularioResultados();
    cargarHistorialResultados();
});

/**
 * Establece la fecha de hoy por defecto en los selectores.
 */
function inicializarFechas() {
    const hoy = new Date().toISOString().split('T')[0];
    const inputFechaForm = document.getElementById('result-fecha');
    const inputFiltro = document.getElementById('filtro-fecha-historial');

    if (inputFechaForm && !inputFechaForm.value) inputFechaForm.value = hoy;
    if (inputFiltro && !inputFiltro.value) inputFiltro.value = hoy;
}

/**
 * Consulta y renderiza los resultados guardados según la fecha activa.
 */
async function cargarHistorialResultados() {
    inicializarFechas();
    const filtroFecha = document.getElementById('filtro-fecha-historial')?.value;
    const tbody = document.getElementById('tabla-historial-resultados');

    if (!tbody) return;

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) {
        console.error("Cliente Supabase no disponible.");
        return;
    }

    try {
        let query = supabase
            .from('resultados')
            .select('*, sorteos(nombre)')
            .order('created_at', { ascending: false });

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
            const nombreSorteo = res.sorteos?.nombre || res.sorteo_nombre || res.nombre || `Sorteo #${res.sorteo_id}`;
            const num1 = res.primero ?? res.p1 ?? res.num1 ?? '--';
            const num2 = res.segundo ?? res.p2 ?? res.num2 ?? '--';
            const num3 = res.tercero ?? res.p3 ?? res.num3 ?? '--';

            const jsonStr = JSON.stringify(res).replace(/"/g, '&quot;');

            return `
                <tr class="hover:bg-slate-700/30 transition border-b border-slate-700/50">
                    <td class="p-3 font-semibold text-white">${nombreSorteo}</td>
                    <td class="p-3 text-slate-400">${res.fecha || 'Sin fecha'}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num1}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num2}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num3}</td>
                    <td class="p-3 text-center">
                        <button type="button" onclick="cargarResultadoEnFormulario(${jsonStr})" 
                            class="text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg font-bold transition">
                            ✏️ Editar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar historial:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-rose-400">Error: ${err.message}</td></tr>`;
    }
}
window.cargarHistorialResultados = cargarHistorialResultados;

/**
 * Carga un registro previo en el formulario para modificarlo.
 */
function cargarResultadoEnFormulario(res) {
    if (!res) return;

    const fechaInput = document.getElementById('result-fecha');
    const selectSorteo = document.getElementById('results-loteria-select');
    const p1 = document.getElementById('result-p1');
    const p2 = document.getElementById('result-p2');
    const p3 = document.getElementById('result-p3');

    if (fechaInput) fechaInput.value = res.fecha;
    if (selectSorteo) selectSorteo.value = res.sorteo_id;
    if (p1) p1.value = res.primero ?? res.p1 ?? res.num1 ?? '';
    if (p2) p2.value = res.segundo ?? res.p2 ?? res.num2 ?? '';
    if (p3) p3.value = res.tercero ?? res.p3 ?? res.num3 ?? '';
}
window.cargarResultadoEnFormulario = cargarResultadoEnFormulario;

/**
 * Procesa el guardado del formulario y actualiza la tabla.
 */
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
            alert("Completa la fecha, el sorteo y al menos el 1er premio.");
            return;
        }

        const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (!supabase) return;

        try {
            const payload = {
                sorteo_id: parseInt(sorteo_id),
                fecha: fecha,
                primero: primero,
                segundo: segundo,
                tercero: tercero,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('resultados')
                .upsert(payload, { onConflict: 'sorteo_id,fecha' });

            if (error) throw error;

            alert(`✅ Resultado guardado para la fecha ${fecha}`);

            const filtroFecha = document.getElementById('filtro-fecha-historial');
            if (filtroFecha) filtroFecha.value = fecha;

            cargarHistorialResultados();

        } catch (err) {
            console.error("Error al guardar:", err);
            alert("Error al guardar en Supabase: " + err.message);
        }
    });
}