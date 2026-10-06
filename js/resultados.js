// ==========================================================
// ARCHIVO: js/resultados.js
// Gestión de Resultados, Escrutinio e Historial con Eliminación
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarFechas();
    inicializarFormularioResultados();
    cargarHistorialResultados();
});

/**
 * Inicializa la fecha por defecto si los campos están vacíos.
 */
function inicializarFechas() {
    const hoy = new Date().toISOString().split('T')[0];
    const inputFechaForm = document.getElementById('result-fecha');
    const inputFiltro = document.getElementById('filtro-fecha-historial');

    if (inputFechaForm && !inputFechaForm.value) inputFechaForm.value = hoy;
    if (inputFiltro && !inputFiltro.value) inputFiltro.value = hoy;
}

/**
 * Carga el historial de resultados según la fecha seleccionada en el filtro.
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
                    <td colspan="6" class="text-center p-4 text-slate-500 font-medium">
                        No hay sorteos registrados ni escrutados para la fecha ${filtroFecha || 'seleccionada'}.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.map(res => {
            const nombreSorteo = res.sorteos?.nombre || res.sorteo_nombre || `Sorteo #${res.sorteo_id}`;
            const num1 = res.primero ?? res.p1 ?? res.num1 ?? '--';
            const num2 = res.segundo ?? res.p2 ?? res.num2 ?? '--';
            const num3 = res.tercero ?? res.p3 ?? res.num3 ?? '--';

            const jsonStr = JSON.stringify(res).replace(/"/g, '&quot;');

            return `
                <tr class="hover:bg-slate-700/30 transition border-b border-slate-700/50">
                    <td class="p-3 font-semibold text-white">${nombreSorteo}</td>
                    <td class="p-3 text-slate-400 font-mono">${res.fecha || 'Sin fecha'}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num1}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num2}</td>
                    <td class="p-3 text-amber-400 font-bold font-mono text-sm">${num3}</td>
                    <td class="p-3 text-center flex items-center justify-center gap-2">
                        <button type="button" onclick="cargarResultadoEnFormulario(${jsonStr})" 
                            class="text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg font-bold transition">
                            ✏️ Editar
                        </button>
                        <button type="button" onclick="eliminarResultado('${res.id}')" 
                            class="text-xs bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white px-2.5 py-1 rounded-lg font-bold transition">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar historial:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-rose-400">Error al consultar datos: ${err.message}</td></tr>`;
    }
}
window.cargarHistorialResultados = cargarHistorialResultados;

/**
 * Carga los datos de un sorteo registrado de vuelta al formulario.
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
 * Elimina un registro de resultado de Supabase.
 */
async function eliminarResultado(id) {
    if (!id || id === 'undefined') {
        alert("El ID del registro no es válido.");
        return;
    }

    if (!confirm("¿Está seguro de que desea eliminar este resultado de sorteo? Esto alterará el historial.")) {
        return;
    }

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('resultados')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("✅ Resultado eliminado correctamente.");
        cargarHistorialResultados();

    } catch (err) {
        console.error("Error al eliminar resultado:", err);
        alert("Error al eliminar de Supabase: " + err.message);
    }
}
window.eliminarResultado = eliminarResultado;

/**
 * Procesa el registro y actualización de sorteos ganadores.
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
                segundo: segundo || '',
                tercero: tercero || '',
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('resultados')
                .upsert(payload, { onConflict: 'sorteo_id,fecha' });

            if (error) throw error;

            alert(`✅ Resultado guardado e impreso para la fecha ${fecha}`);

            // Cambiar filtro a la fecha guardada para verificarla de inmediato
            const filtroFecha = document.getElementById('filtro-fecha-historial');
            if (filtroFecha) filtroFecha.value = fecha;

            cargarHistorialResultados();

        } catch (err) {
            console.error("Error al guardar:", err);
            alert("Error al guardar en Supabase: " + err.message);
        }
    });
}