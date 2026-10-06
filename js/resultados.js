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
 * Obtiene la instancia de Supabase de manera centralizada.
 */
function getSupabaseInstance() {
    return window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
}

/**
 * Permite seleccionar cualquier fecha (pasada o presente) sin bloquear el input.
 */
function inicializarFechas() {
    const hoy = new Date().toISOString().split('T')[0];
    const inputFechaForm = document.getElementById('result-fecha');
    const inputFiltro = document.getElementById('filtro-fecha-historial');

    if (inputFechaForm && !inputFechaForm.value) inputFechaForm.value = hoy;
    if (inputFiltro && !inputFiltro.value) inputFiltro.value = hoy;
}

/**
 * Consulta y muestra los resultados registrados filtrados por la fecha seleccionada.
 */
async function cargarHistorialResultados() {
    const filtroFecha = document.getElementById('filtro-fecha-historial')?.value;
    const tbody = document.getElementById('tabla-historial-resultados');

    if (!tbody) return;

    const supabase = getSupabaseInstance();
    if (!supabase) return;

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
                        No hay sorteos escrutados para la fecha ${filtroFecha || 'seleccionada'}.
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-rose-400">Error: ${err.message}</td></tr>`;
    }
}
window.cargarHistorialResultados = cargarHistorialResultados;

/**
 * Sube los datos del historial al formulario para modificar sorteos anteriores.
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
        const { error } = await supabase
            .from('resultados')
            .delete()
            .eq('id', id);

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
 * Registra o edita los premios de un sorteo para cualquier fecha seleccionada.
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
            alert("Seleccione la fecha, el sorteo y complete al menos el 1er premio.");
            return;
        }

        const supabase = getSupabaseInstance();
        if (!supabase) return;

        try {
            // Se envían ambos formatos de columnas (p1/p2/p3 y primero/segundo/tercero)
            // para compatibilidad total con la tabla de Supabase.
            const payload = {
                sorteo_id: parseInt(sorteo_id),
                fecha: fecha,
                p1: primero,
                p2: segundo || '',
                p3: tercero || '',
                primero: primero,
                segundo: segundo || '',
                tercero: tercero || '',
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('resultados')
                .upsert(payload, { onConflict: 'sorteo_id,fecha' });

            if (error) throw error;

            alert(`✅ Resultado guardado y escrutado correctamente para la fecha ${fecha}`);

            // Sincronizar la fecha en el filtro del historial para mostrar el registro guardado/editado
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
 * Sincroniza automáticamente los resultados consultando la web mediante proxy.
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
        const supabase = getSupabaseInstance();
        let sorteos = [];

        // 1. Obtener lista de sorteos desde Supabase
        if (supabase) {
            const { data, error } = await supabase.from('sorteos').select('id, nombre');
            if (error) throw error;
            sorteos = data || [];
        } else if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/sorteos?select=id,nombre`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            sorteos = await resp.json();
        }

        if (!sorteos.length) throw new Error('No se pudieron cargar los sorteos desde la base de datos.');

        // 2. Traer HTML evitando bloqueos CORS mediante proxy
        const corsProxy = 'https://corsproxy.io/?';
        
        const [htmlPrincipal, htmlAnguilla] = await Promise.all([
            fetchTextWithProxy(`${corsProxy}https://enloteria.com/`),
            fetchTextWithProxy(`${corsProxy}https://enloteria.com/resultados-anguilla`)
        ]);

        const resultadosHallados = [];
        if (htmlPrincipal) resultadosHallados.push(...extraerPremios(htmlPrincipal, sorteos));
        if (htmlAnguilla) resultadosHallados.push(...extraerPremios(htmlAnguilla, sorteos));

        if (resultadosHallados.length === 0) {
            const msg = 'No se encontraron nuevos números publicados en este momento.';
            if (status) {
                status.style.color = '#eab308';
                status.innerText = msg;
            } else {
                alert(msg);
            }
            return;
        }

        // 3. Insertar/Actualizar en Supabase
        const hoy = document.getElementById('result-fecha')?.value || new Date().toISOString().split('T')[0];
        let guardados = 0;

        for (const resData of resultadosHallados) {
            const payload = {
                sorteo_id: resData.sorteo_id,
                fecha: hoy,
                primero: resData.primero,
                segundo: resData.segundo || '',
                tercero: resData.tercero || '',
                p1: resData.primero,
                p2: resData.segundo || '',
                p3: resData.tercero || '',
                updated_at: new Date().toISOString()
            };

            if (supabase) {
                const { error } = await supabase.from('resultados').upsert(payload, { onConflict: 'sorteo_id,fecha' });
                if (!error) guardados++;
            } else if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
                const resp = await fetch(`${SUPABASE_URL}/rest/v1/resultados`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify([payload])
                });
                if (resp.ok) guardados++;
            }
        }

        const msgExito = `¡Éxito! ${guardados} sorteos sincronizados y tickets escrutados automáticamente.`;
        if (status) {
            status.style.color = '#16a34a';
            status.innerText = msgExito;
        } else {
            alert(msgExito);
        }

        // Recargar la tabla de historial con los datos sincronizados
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

// Mapeo dual para compatibilidad de nombres en el HTML
window.sincronizarResultadosAutomaticos = sincronizarResultadosAutomaticos;
window.obtenerResultadosAutomaticos = sincronizarResultadosAutomaticos;

/**
 * Pide el contenido mediante Fetch tolerando fallos de red/proxy.
 */
async function fetchTextWithProxy(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        return null;
    }
}

/**
 * Parsea el HTML para extraer los primeros, segundos y terceros premios.
 */
function extraerPremios(html, listaSorteos) {
    const hallados = [];
    for (const sorteo of listaSorteos) {
        if (!sorteo.nombre) continue;
        const nombreNorm = sorteo.nombre.toLowerCase();

        if (html.toLowerCase().includes(nombreNorm)) {
            const regexBloque = new RegExp(`${nombreNorm}[\\s\\S]{1,300}?(\\d{2})[\\s\\-]{1,5}(\\d{2})[\\s\\-]{1,5}(\\d{2})`, 'i');
            const match = html.match(regexBloque);
            if (match) {
                hallados.push({
                    sorteo_id: sorteo.id,
                    primero: match[1],
                    segundo: match[2],
                    tercero: match[3]
                });
            }
        }
    }
    return hallados;
}