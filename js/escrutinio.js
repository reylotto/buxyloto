// ==========================================================
// MÓDULO DE ESCRUTINIO Y HISTORIAL DE RESULTADOS (escrutinio.js)
// ==========================================================

function getSupabaseClient() {
    return window.supabaseClient || window.supabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

function getFechaPanamaEscrutinio() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

async function notificarActualizacionResumen() {
    if (typeof window.actualizarResumenOperaciones === 'function') {
        try {
            await window.actualizarResumenOperaciones();
        } catch (err) {
            console.warn("Aviso al actualizar Resumen de Operaciones:", err.message || err);
        }
    }
}

// 💡 CORRECCIÓN 1: Filtro de fecha para mostrar solo los de hoy
window.cargarHistorialResultados = async function() {
    const tbody = document.getElementById('historial-resultados-tbody') || document.querySelector('#tabla-historial-resultados tbody');
    if (!tbody) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const fechaFiltro = document.getElementById('filtro-fecha-resultados')?.value || getFechaPanamaEscrutinio();

        const { data, error } = await supabase
            .from('resultados')
            .select(`
                *,
                sorteos (nombre, hora_cierre)
            `)
            .eq('fecha', fechaFiltro)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-500">No hay resultados registrados para esta fecha.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(r => {
            const nombreSorteo = r.sorteos?.nombre || `Sorteo #${r.sorteo_id}`;
            const horaSorteo = r.sorteos?.hora_cierre || '';
            const p1 = r.primero || r.p1 || '--';
            const p2 = r.segundo || r.p2 || '--';
            const p3 = r.tercero || r.p3 || '--';
            
            return `
                <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td class="p-3 text-white font-bold text-xs uppercase">${nombreSorteo} ${horaSorteo ? `<span class="text-[10px] text-slate-400 font-normal">(${horaSorteo})</span>` : ''}</td>
                    <td class="p-3 text-slate-400 text-xs">${r.fecha}</td>
                    <td class="p-3"><span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded font-black tracking-widest border border-emerald-500/30">${p1}</span></td>
                    <td class="p-3"><span class="bg-blue-500/20 text-blue-400 px-3 py-1 rounded font-black tracking-widest border border-blue-500/30">${p2}</span></td>
                    <td class="p-3"><span class="bg-amber-500/20 text-amber-400 px-3 py-1 rounded font-black tracking-widest border border-amber-500/30">${p3}</span></td>
                    <td class="p-3">
                        <div class="flex gap-2">
                            <button onclick="window.editarResultadoSorteo('${r.sorteo_id}', '${p1}', '${p2}', '${p3}')" class="bg-amber-600/20 text-amber-400 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded text-xs transition border border-amber-600/30" title="Editar">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <button onclick="window.eliminarResultadoSorteo('${r.sorteo_id}')" class="bg-rose-600/20 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-1.5 rounded text-xs transition border border-rose-600/30" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar historial:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-rose-400">Error al cargar historial.</td></tr>`;
    }
};
window.cargarHistorialSorteosEscrutados = window.cargarHistorialResultados;


window.editarResultadoSorteo = async function(id, p1Actual, p2Actual, p3Actual) {
    const valP1 = (p1Actual === '--') ? '' : p1Actual;
    const valP2 = (p2Actual === '--') ? '' : p2Actual;
    const valP3 = (p3Actual === '--') ? '' : p3Actual;

    const nuevoP1 = prompt("Nuevo 1er Premio (Deje en blanco si no aplica):", valP1);
    if (nuevoP1 === null) return;

    const nuevoP2 = prompt("Nuevo 2do Premio (Deje en blanco si no aplica):", valP2);
    if (nuevoP2 === null) return;

    const nuevoP3 = prompt("Nuevo 3er Premio (Deje en blanco si no aplica):", valP3);
    if (nuevoP3 === null) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const cleanP1 = nuevoP1.trim() || null;
        const cleanP2 = nuevoP2.trim() || null;
        const cleanP3 = nuevoP3.trim() || null;
        const sorteoIdNum = parseInt(id, 10);
        const fechaHoy = getFechaPanamaEscrutinio();

        // 💡 CORRECCIÓN 2: Eliminamos la regla que forzaba estatus='cerrado' aquí.
        // El estatus del sorteo se maneja dinámicamente por la hora del día.
        const payload = {
            p1: cleanP1,
            p2: cleanP2,
            p3: cleanP3,
            primer_premio: cleanP1,
            segundo_premio: cleanP2,
            tercer_premio: cleanP3
        };

        const { error: errSorteo } = await supabase
            .from('sorteos')
            .update(payload)
            .eq('id', sorteoIdNum);

        if (errSorteo) throw errSorteo;

        await supabase
            .from('resultados')
            .upsert({
                sorteo_id: sorteoIdNum,
                fecha: fechaHoy,
                p1: cleanP1,
                p2: cleanP2,
                p3: cleanP3,
                primero: cleanP1,
                segundo: cleanP2,
                tercero: cleanP3,
                updated_at: new Date().toISOString()
            }, { onConflict: 'sorteo_id,fecha' });

        try {
            await supabase.rpc('evaluar_tickets_sorteo', {
                p_id_sorteo: sorteoIdNum,
                p_num1: cleanP1,
                p_num2: cleanP2,
                p_num3: cleanP3
            });
        } catch (rpcErr) {
            console.warn("Aviso al reevaluar tickets:", rpcErr);
        }

        alert("✅ Resultado actualizado y tickets reevaluados.");
        
        await window.cargarHistorialResultados();
        if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al editar resultado: " + (err.message || err));
    }
};

window.eliminarResultadoSorteo = async function(id) {
    if (!confirm("¿Está seguro de eliminar este resultado? Sus tickets se resetearán a 'pendiente'.")) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const sorteoIdNum = parseInt(id, 10);
        const fechaHoy = getFechaPanamaEscrutinio();

        await supabase
            .from('resultados')
            .delete()
            .eq('sorteo_id', sorteoIdNum)
            .eq('fecha', fechaHoy);

        const payloadSorteo = {
            p1: null, p2: null, p3: null,
            primer_premio: null, segundo_premio: null, tercer_premio: null
        };

        await supabase.from('sorteos').update(payloadSorteo).eq('id', sorteoIdNum);
        
        // Reset tickets de hoy para ese sorteo
        const startOfDay = `${fechaHoy}T00:00:00`;
        const endOfDay = `${fechaHoy}T23:59:59`;
        
        await supabase
            .from('tickets')
            .update({ estatus: 'pendiente', estado: 'pendiente', premio: 0, monto_premio: 0 })
            .eq('sorteo_id', sorteoIdNum)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        alert("✅ Escrutinio eliminado.");

        await window.cargarHistorialResultados();
        if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al borrar resultado: " + (err.message || err));
    }
};

// 💡 CORRECCIÓN 3: Scraper dinámico que evita el error "90"
window.consultarScraperGlobal = async function(nombreSorteoBuscado) {
    if (!nombreSorteoBuscado) return null;
    try {
        // Enlazar al scraper que usábamos en tu código de cronjob o al API
        // Si no lo encuentra, ya no devuelve "90", devuelve null para que no registre errores.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://agencia-reylotto.com/resultados.php')}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        // Lógica de búsqueda por nombre de sorteo en el HTML extraído
        const elementosSorteo = Array.from(doc.querySelectorAll('tr, div.resultado-item'));
        
        for (const el of elementosSorteo) {
            const textoLimpio = el.textContent.toUpperCase();
            if (textoLimpio.includes(nombreSorteoBuscado.toUpperCase())) {
                const numerosMatches = el.textContent.match(/\b\d{2}\b/g);
                if (numerosMatches && numerosMatches.length >= 1) {
                    return {
                        p1: numerosMatches[0] || null,
                        p2: numerosMatches[1] || null,
                        p3: numerosMatches[2] || null
                    };
                }
            }
        }
        return null; // Si no lo encuentra, no guarda 90.
    } catch (e) {
        console.warn("Fallo scraper:", e);
        return null;
    }
};

async function cargarSorteosEscrutinio() {
    const selects = [
        document.getElementById('results-loteria-select'),
        document.getElementById('select-sorteo-escrutinio')
    ].filter(Boolean);

    if (selects.length === 0) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        let { data, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) return;

        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Seleccione Lotería / Sorteo --</option>';
            data.forEach(item => {
                const idVal = item.id;
                const option = document.createElement('option');
                option.value = idVal;
                option.textContent = item.nombre || `Sorteo #${idVal}`;
                option.dataset.nombre = item.nombre;
                select.appendChild(option);
            });
        });

    } catch (err) {
        console.error("Error al cargar sorteos en escrutinio:", err.message || err);
    }
}
window.cargarSorteosEscrutinio = cargarSorteosEscrutinio;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof window.cargarSorteosEscrutinio === 'function') window.cargarSorteosEscrutinio();
        if (typeof window.cargarHistorialResultados === 'function') window.cargarHistorialResultados();
    }, 500);
});