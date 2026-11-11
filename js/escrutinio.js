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

        let queryHistorial = supabase
            .from('resultados')
            .select('*, sorteos (nombre, hora_cierre)')
            .eq('fecha', fechaFiltro)
            .order('created_at', { ascending: false });

        // 🔥 ESCUDO MULTI-TENANT ESTRICTO: HISTORIAL DE RESULTADOS
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && String(inquilinoId).trim() !== '') {
            queryHistorial = queryHistorial.eq('inquilino_id', inquilinoId);
        } else {
            queryHistorial = queryHistorial.is('inquilino_id', null);
        }

        const { data, error } = await queryHistorial;

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
                            <!-- 🔥 AHORA LE ENVIAMOS LA FECHA EXACTA DEL REGISTRO AL BOTÓN -->
                            <button onclick="window.editarResultadoSorteo('${r.sorteo_id}', '${res.fecha}', '${p1}', '${p2}', '${p3}')" class="bg-amber-600/20 text-amber-400 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded text-xs transition border border-amber-600/30" title="Editar"><i class="fa-solid fa-pen"></i> Editar</button>
                            <button onclick="window.eliminarResultadoSorteo('${r.sorteo_id}', '${res.fecha}')" class="bg-rose-600/20 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-1.5 rounded text-xs transition border border-rose-600/30" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
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


// 🔥 LA FUNCIÓN AHORA RECIBE LA FECHA HISTÓRICA
window.editarResultadoSorteo = async function(id, fechaSorteo, p1Actual, p2Actual, p3Actual) {
    const valP1 = (p1Actual === '--') ? '' : p1Actual;
    const valP2 = (p2Actual === '--') ? '' : p2Actual;
    const valP3 = (p3Actual === '--') ? '' : p3Actual;

    const nuevoP1 = prompt(`Editando Sorteo del ${fechaSorteo}\nNuevo 1er Premio:`, valP1);
    if (nuevoP1 === null) return;
    const nuevoP2 = prompt("Nuevo 2do Premio:", valP2);
    if (nuevoP2 === null) return;
    const nuevoP3 = prompt("Nuevo 3er Premio:", valP3);
    if (nuevoP3 === null) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const cleanP1 = nuevoP1.trim() || null;
        const cleanP2 = nuevoP2.trim() || null;
        const cleanP3 = nuevoP3.trim() || null;
        const sorteoIdNum = parseInt(id, 10);

        // 1. Actualizamos la tabla de resultados exactamente en la FECHA PASADA
        await supabase
            .from('resultados')
            .upsert({
                sorteo_id: sorteoIdNum,
                fecha: fechaSorteo, // <--- CANDADO 100% ACTIVO
                p1: cleanP1, p2: cleanP2, p3: cleanP3,
                primero: cleanP1, segundo: cleanP2, tercero: cleanP3,
                updated_at: new Date().toISOString()
            }, { onConflict: 'sorteo_id,fecha' });

        // 2. Evaluamos los tickets estrictamente para la fecha de ese sorteo
        try {
            await supabase.rpc('evaluar_tickets_sorteo', {
                p_sorteo_id: sorteoIdNum,
                p_fecha: fechaSorteo // <--- ELIMINAMOS "fechaHoy"
            });
        } catch (rpcErr) {
            console.warn("Aviso al reevaluar tickets:", rpcErr);
        }

        alert(`✅ Resultado actualizado y tickets reevaluados SOLO para la fecha: ${fechaSorteo}`);
        
        await window.cargarHistorialResultados();
        if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al editar resultado: " + (err.message || err));
    }
};

// 🔥 LA FUNCIÓN AHORA RECIBE LA FECHA HISTÓRICA A BORRAR
window.eliminarResultadoSorteo = async function(id, fechaSorteo) {
    if (!confirm(`¿Está seguro de eliminar el escrutinio del día ${fechaSorteo}? Sus tickets se resetearán a 'pendiente'.`)) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const sorteoIdNum = parseInt(id, 10);

        // Borrar el resultado exactamente de esa fecha
        await supabase
            .from('resultados')
            .delete()
            .eq('sorteo_id', sorteoIdNum)
            .eq('fecha', fechaSorteo); // <--- CANDADO
        
        // Reset tickets de ESA FECHA en específico (No los de hoy)
        const startOfDay = `${fechaSorteo}T00:00:00`;
        const endOfDay = `${fechaSorteo}T23:59:59`;
        
        await supabase
            .from('tickets')
            .update({ estatus: 'pendiente', estado: 'pendiente', premio: 0, monto_premio: 0 })
            .eq('sorteo_id', sorteoIdNum)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        alert(`✅ Escrutinio eliminado para la fecha ${fechaSorteo}.`);

        await window.cargarHistorialResultados();
        if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al borrar resultado: " + (err.message || err));
    }
};

// 💡 SCRAPER BLINDADO CONTRA FALSOS POSITIVOS (ANTI-90)
window.consultarScraperGlobal = async function(nombreSorteoBuscado) {
    if (!nombreSorteoBuscado) return null;
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://agencia-reylotto.com/resultados.php')}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        const elementosSorteo = Array.from(doc.querySelectorAll('tr, div.resultado, div.card, li, article'));
        
        for (const el of elementosSorteo) {
            // Se extrae el texto puro, ignorando nombres de clases HTML
            const textoBloque = (el.innerText || el.textContent || '').toUpperCase();
            
            if (textoBloque.includes(nombreSorteoBuscado.toUpperCase())) {
                // Extraer exactamente pares de 2 dígitos numéricos
                const coincidencias = [...textoBloque.matchAll(/(?<!\d)(\d{2})(?!\d)/g)].map(m => m[1]);
                
                // 🔥 FILTRO ESTRICTO: Si encuentra un "90" solitario, lo ignora asumiendo que es código CSS/HTML. 
                // Solo lo acepta si viene acompañado de otros premios (ej. 3 premios completos).
                const bolasReales = coincidencias.filter(num => num !== '90' || coincidencias.length >= 3);
                
                if (bolasReales.length >= 1) {
                    return {
                        p1: bolasReales[0] || null,
                        p2: bolasReales[1] || null,
                        p3: bolasReales[2] || null
                    };
                }
            }
        }
        return null; // No inyecta errores si falla
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

        let querySorteos = supabase
            .from('sorteos')
            .select('*')
            .order('created_at', { ascending: false });

        // 🔥 ESCUDO MULTI-TENANT ESTRICTO: DESPLEGABLES DE SORTEOS AISLADOS
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && inquilinoId.trim() !== '') {
            querySorteos = querySorteos.eq('inquilino_id', inquilinoId);
        } else {
            querySorteos = querySorteos.is('inquilino_id', null);
        }

        let { data, error } = await querySorteos;

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