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

async function cargarHistorialSorteosEscrutados() {
    if (typeof window.cargarHistorialResultados === 'function') {
        await window.cargarHistorialResultados();
    }
}
window.cargarHistorialSorteosEscrutados = cargarHistorialSorteosEscrutados;

window.editarResultadoSorteo = async function(id, p1Actual, p2Actual, p3Actual) {
    const valP1 = (p1Actual === '--') ? '' : p1Actual;
    const valP2 = (p2Actual === '--') ? '' : p2Actual;
    const valP3 = (p3Actual === '--') ? '' : p3Actual;

    const nuevoP1 = prompt("Nuevo 1er Premio:", valP1);
    if (nuevoP1 === null) return;

    const nuevoP2 = prompt("Nuevo 2do Premio:", valP2);
    if (nuevoP2 === null) return;

    const nuevoP3 = prompt("Nuevo 3er Premio:", valP3);
    if (nuevoP3 === null) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const cleanP1 = nuevoP1.trim();
        const cleanP2 = nuevoP2.trim();
        const cleanP3 = nuevoP3.trim();
        const sorteoIdNum = parseInt(id, 10);
        const fechaHoy = getFechaPanamaEscrutinio();

        const payload = {
            p1: cleanP1,
            p2: cleanP2,
            p3: cleanP3,
            primer_premio: cleanP1,
            segundo_premio: cleanP2,
            tercer_premio: cleanP3,
            estatus: 'cerrado',
            estado: 'cerrado'
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

        alert("✅ Resultado del sorteo actualizado y tickets reevaluados.");

        if (typeof window.cargarHistorialResultados === 'function') {
            await window.cargarHistorialResultados();
        }
        if (typeof window.cargarHistorialTickets === 'function') {
            await window.cargarHistorialTickets();
        }
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al editar resultado: " + (err.message || err));
    }
};

window.eliminarResultadoSorteo = async function(id) {
    if (!confirm("¿Está seguro de eliminar este resultado? El sorteo volverá a quedar 'activo' y sus tickets se resetearán a 'pendiente'.")) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const sorteoIdNum = parseInt(id, 10);

        await supabase
            .from('resultados')
            .delete()
            .eq('sorteo_id', sorteoIdNum);

        const payloadSorteo = {
            p1: null,
            p2: null,
            p3: null,
            primer_premio: null,
            segundo_premio: null,
            tercer_premio: null,
            estatus: 'activo',
            estado: 'activo'
        };

        const { error: errSorteo } = await supabase
            .from('sorteos')
            .update(payloadSorteo)
            .eq('id', sorteoIdNum);

        if (errSorteo) throw errSorteo;

        await supabase
            .from('tickets')
            .update({ estatus: 'pendiente', estado: 'pendiente', premio: 0, monto_premio: 0 })
            .eq('sorteo_id', sorteoIdNum);

        alert("✅ Sorteo reseteado a activo.");

        if (typeof window.cargarHistorialResultados === 'function') {
            await window.cargarHistorialResultados();
        }
        if (typeof window.cargarHistorialTickets === 'function') {
            await window.cargarHistorialTickets();
        }
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al borrar resultado: " + (err.message || err));
    }
};

async function cargarSorteosEscrutinio() {
    const selects = [
        document.getElementById('results-loteria-select'),
        document.getElementById('select-sorteo-escrutinio'),
        document.getElementById('escrutinio-loteria'),
        document.getElementById('escrutinio-sorteo-select')
    ].filter(Boolean);

    if (selects.length === 0) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        let { data, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            selects.forEach(select => {
                select.innerHTML = '<option value="">No hay sorteos disponibles</option>';
            });
            return;
        }

        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Seleccione Lotería / Sorteo --</option>';
            data.forEach(item => {
                const idVal = item.id;
                const nombreVal = item.nombre || item.name || `Sorteo #${idVal}`;
                const horaVal = item.hora || item.openTime || '';

                const option = document.createElement('option');
                option.value = idVal;
                option.textContent = horaVal ? `${nombreVal} (${horaVal})` : nombreVal;
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
    }, 300);
});