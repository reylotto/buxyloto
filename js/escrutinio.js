// ==========================================================
// MÓDULO DE ESCRUTINIO Y GESTIÓN DE SORTEOS (escrutinio.js)
// ==========================================================

// Helper seguro para obtener el cliente de Supabase
function getSupabaseClient() {
    return window.supabaseClient || window.supabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

// Helper seguro para disparar la actualización del Resumen de Operaciones
async function notificarActualizacionResumen() {
    if (typeof window.actualizarResumenOperaciones === 'function') {
        try {
            await window.actualizarResumenOperaciones();
        } catch (err) {
            console.warn("Aviso al actualizar Resumen de Operaciones:", err.message || err);
        }
    }
}

// ==========================================================
// 1. FUNCIÓN PARA EDITAR RESULTADOS REGISTRADOS EN SORTEOS
// ==========================================================
window.editarResultadoSorteo = async function(id, p1Actual, p2Actual, p3Actual) {
    const valP1 = (p1Actual === '--') ? '' : p1Actual;
    const valP2 = (p2Actual === '--') ? '' : p2Actual;
    const valP3 = (p3Actual === '--') ? '' : p3Actual;

    const nuevoP1 = prompt("Nuevo 1er Premio (2 o 4 dígitos):", valP1);
    if (nuevoP1 === null) return;

    const nuevoP2 = prompt("Nuevo 2do Premio (2 o 4 dígitos):", valP2);
    if (nuevoP2 === null) return;

    const nuevoP3 = prompt("Nuevo 3er Premio (2 o 4 dígitos):", valP3);
    if (nuevoP3 === null) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");

        const cleanP1 = nuevoP1.trim();
        const cleanP2 = nuevoP2.trim();
        const cleanP3 = nuevoP3.trim();

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

        const { error } = await supabase
            .from('sorteos')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        alert("✅ Números ganadores actualizados correctamente. Recalculando tickets...");

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

// ==========================================================
// 2. FUNCIÓN PARA ELIMINAR / RESETEAR RESULTADOS DE UN SORTEO
// ==========================================================
window.eliminarResultadoSorteo = async function(id) {
    if (!confirm("¿Está seguro de eliminar este resultado? El sorteo volverá a quedar 'activo', se resetearán todos los tickets asociados a 'pendiente'.")) return;

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
            .eq('id', id);

        if (errSorteo) throw errSorteo;

        const payloadTickets = {
            estatus: 'pendiente',
            estado: 'pendiente',
            premio: 0,
            monto_premio: 0
        };

        await supabase
            .from('tickets')
            .update(payloadTickets)
            .eq('sorteo_id', sorteoIdNum);

        alert("✅ Resultado eliminado de Supabase. El sorteo vuelve a estar activo y los tickets se han reseteado.");

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

// ==========================================================
// 3. CARGAR DROPDOWNS DE SORTEOS EN EL PANEL
// ==========================================================
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

        if (error) {
            const retry = await supabase
                .from('sorteos')
                .select('*')
                .order('id', { ascending: false });

            data = retry.data;
            error = retry.error;
        }

        if (error || !data || data.length === 0) {
            selects.forEach(select => {
                select.innerHTML = '<option value="">No hay sorteos activos en Supabase</option>';
            });
            return;
        }

        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Seleccione Lotería / Sorteo --</option>';
            data.forEach(item => {
                const idVal = item.id;
                const nombreVal = item.nombre || item.name || item.descripcion || `Sorteo #${idVal}`;
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