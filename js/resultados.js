// ==========================================================
// ARCHIVO: js/resultados.js
// Registro, Escrutinio, Historial y Sincronización de Resultados
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarFechas();
    inicializarFormularioResultados();
    cargarHistorialResultados();
});

/**
 * Retorna la fecha local oficial de Panamá en formato YYYY-MM-DD.
 */
function getFechaLocalPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

/**
 * Obtiene la instancia de Supabase de manera centralizada.
 */
function getSupabaseInstance() {
    return window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
}

/**
 * Inicializa los selectores de fecha con la hora exacta de Panamá.
 */
function inicializarFechas() {
    const hoyPanama = getFechaLocalPanama();
    const inputFechaForm = document.getElementById('result-fecha');
    const inputFiltro = document.getElementById('filtro-fecha-historial');

    if (inputFechaForm && !inputFechaForm.value) inputFechaForm.value = hoyPanama;
    if (inputFiltro && !inputFiltro.value) inputFiltro.value = hoyPanama;
}

/**
 * Consulta y muestra los resultados registrados filtrados por la fecha seleccionada.
 */
async function cargarHistorialResultados() {
    const filtroFecha = document.getElementById('filtro-fecha-historial')?.value || getFechaLocalPanama();
    const tbody = document.getElementById('tabla-historial-resultados');

    if (!tbody) return;

    const supabase = getSupabaseInstance();
    if (!supabase) return;

    try {
        let query = supabase
            .from('resultados')
            .select('*, sorteos(nombre)')
            .eq('fecha', filtroFecha)
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-4 text-slate-500 font-medium">
                        No hay sorteos escrutados para la fecha ${filtroFecha}.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.map(res => {
            const nombreSorteo = res.sorteos?.nombre || res.sorteo_nombre || `Sorteo #${res.sorteo_id}`;
            const num1 = res.primero ?? res.p1 ?? '--';
            const num2 = res.segundo ?? res.p2 ?? '--';
            const num3 = res.tercero ?? res.p3 ?? '--';

            const jsonStr = JSON.stringify(res).replace(/"/g, '&quot;');

            return `
                <tr class="hover:bg-slate-700/30 transition border-b border-slate-700/50">
                    <td class="p-3 font-semibold text-white">${nombreSorteo}</td>
                    <td class="p-3 text-slate-400 font-mono">${res.fecha}</td>
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-rose-400">Error: ${err.message}</td></tr>`;
    }
}
window.cargarHistorialResultados = cargarHistorialResultados;

/**
 * Carga un resultado guardado en el formulario para editarlo.
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
    if (p1) p1.value = res.primero ?? res.p1 ?? '';
    if (p2) p2.value = res.segundo ?? res.p2 ?? '';
    if (p3) p3.value = res.tercero ?? res.p3 ?? '';
}
window.cargarResultadoEnFormulario = cargarResultadoEnFormulario;

/**
 * Elimina un sorteo escrutado de Supabase.
 */
async function eliminarResultado(id) {
    if (!id || id === 'undefined') {
        alert("ID de registro no válido.");
        return;
    }

    if (!confirm("¿Desea eliminar este resultado escrutado?")) return;

    const supabase = getSupabaseInstance();
    if (!supabase) return;

    try {
        const { error } = await supabase.from('resultados').delete().eq('id', id);
        if (error) throw error;

        alert("✅ Resultado eliminado correctamente.");
        cargarHistorialResultados();
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Error al eliminar de Supabase: " + err.message);
    }
}
window.eliminarResultado = eliminarResultado;

/**
 * Registra o edita manualmente los premios de un sorteo.
 */
function inicializarFormularioResultados() {
    const form = document.getElementById('form-register-results');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fecha = document.getElementById('result-fecha')?.value || getFechaLocalPanama();
        const sorteo_id = document.getElementById('results-loteria-select')?.value;
        const primero = document.getElementById('result-p1')?.value.trim();
        const segundo = document.getElementById('result-p2')?.value.trim() || '';
        const tercero = document.getElementById('result-p3')?.value.trim() || '';

        if (!fecha || !sorteo_id || !primero) {
            alert("Seleccione la fecha, el sorteo y complete al menos el 1er premio.");
            return;
        }

        const supabase = getSupabaseInstance();
        if (!supabase) return;

        try {
            const payload = {
                sorteo_id: parseInt(sorteo_id),
                fecha: fecha,
                p1: primero,
                p2: segundo,
                p3: tercero,
                primero: primero,
                segundo: segundo,
                tercero: tercero,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('resultados')
                .upsert(payload, { onConflict: 'sorteo_id,fecha' });

            if (error) throw error;

            alert(`✅ Resultado guardado y escrutado correctamente para la fecha ${fecha}`);

            const filtroFecha = document.getElementById('filtro-fecha-historial');
            if (filtroFecha) filtroFecha.value = fecha;

            cargarHistorialResultados();
        } catch (err) {
            console.error("Error al guardar:", err);
            alert("Error al guardar en Supabase: " + err.message);
        }
    });
}

/**
 * Sincroniza automáticamente los resultados llamando a la Serverless Function de Vercel.
 */
async function sincronizarResultadosAutomaticos() {
    const btn = document.getElementById('btn-auto-sync');
    const status = document.getElementById('sync-status-msg');
    
    if (btn) btn.disabled = true;
    if (status) {
        status.style.color = '#0284c7';
        status.innerText = 'Consultando resultados en vivo...';
    }

    try {
        const response = await fetch('/api/sync-results');
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error en la respuesta del servidor.');
        }

        const msgExito = `¡Éxito! ${data.message}`;
        if (status) { 
            status.style.color = '#16a34a'; 
            status.innerText = msgExito; 
        } else {
            alert(msgExito);
        }

        cargarHistorialResultados();

    } catch (err) {
        console.error('Error en sincronización automática:', err);
        const msgErr = `Error: ${err.message || 'Fallo de conexión'}`;
        if (status) { 
            status.style.color = '#dc2626'; 
            status.innerText = msgErr; 
        } else {
            alert(msgErr);
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.sincronizarResultadosAutomaticos = sincronizarResultadosAutomaticos;
window.obtenerResultadosAutomaticos = sincronizarResultadosAutomaticos;