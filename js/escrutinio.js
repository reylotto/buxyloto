// ==========================================================
// MÓDULO DE ESCRUTINIO Y HISTORIAL DE RESULTADOS (escrutinio.js)
// ==========================================================

function getSupabaseClient() {
    return window.supabaseClient || window.supabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
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

// ==========================================================
// 1. CARGAR HISTORIAL DE NÚMEROS GANADORES EN SORTEOS
// ==========================================================
async function cargarHistorialSorteosEscrutados() {
    const tbody = document.getElementById('tabla-historial-resultados') || 
                  document.getElementById('resultados-table-body') ||
                  document.getElementById('results-table-body');
    if (!tbody) return;

    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        let { data: sorteos, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            const retry = await supabase
                .from('sorteos')
                .select('*')
                .order('id', { ascending: false });
            
            if (retry.error) throw retry.error;
            sorteos = retry.data;
        }

        tbody.innerHTML = '';

        const evaluados = (sorteos || []).filter(s => {
            const tieneP1 = s.p1 && String(s.p1).trim() !== '' && String(s.p1).trim() !== '--';
            const tienePremio = s.primer_premio && String(s.primer_premio).trim() !== '' && String(s.primer_premio).trim() !== '--';
            const est = String(s.estatus || s.estado || '').toLowerCase();
            return tieneP1 || tienePremio || est === 'cerrado' || est === 'finalizado';
        });

        if (evaluados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-slate-400">No hay resultados registrados aún.</td></tr>';
            return;
        }

        evaluados.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            const p1 = s.p1 || s.primer_premio || '--';
            const p2 = s.p2 || s.segundo_premio || '--';
            const p3 = s.p3 || s.tercer_premio || '--';
            const fechaVal = s.created_at || s.fecha || s.created_time;
            const fecha = fechaVal ? new Date(fechaVal).toLocaleDateString() : '--';

            tr.innerHTML = `
                <td class="p-3 font-semibold text-white">${s.nombre || `Sorteo #${s.id}`}</td>
                <td class="p-3 text-slate-300">${fecha}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">1º: ${p1}</td>
                <td class="p-3 font-mono font-bold text-cyan-400">2º: ${p2}</td>
                <td class="p-3 font-mono font-bold text-amber-400">3º: ${p3}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="editarResultadoSorteo('${s.id}', '${p1}', '${p2}', '${p3}')" 
                                class="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white px-2 py-1 rounded transition text-xs font-semibold flex items-center gap-1">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                        <button onclick="eliminarResultadoSorteo('${s.id}')" 
                                class="bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white px-2 py-1 rounded transition text-xs font-semibold flex items-center gap-1">
                            <i class="fa-solid fa-trash-can"></i> Borrar
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error al cargar historial de sorteos escrutados:", err.message || err);
    }
}
window.cargarHistorialSorteosEscrutados = cargarHistorialSorteosEscrutados;

// ==========================================================
// 2. EDITAR RESULTADO DE SORTEO
// ==========================================================
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

        alert("✅ Resultado del sorteo actualizado.");

        if (typeof window.cargarHistorialResultados === 'function') {
            await window.cargarHistorialResultados();
        }
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al editar resultado: " + (err.message || err));
    }
};

// ==========================================================
// 3. ELIMINAR / RESETEAR SORTEO
// ==========================================================
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
            .eq('id', id);

        if (errSorteo) throw errSorteo;

        await supabase
            .from('tickets')
            .update({ estatus: 'pendiente', estado: 'pendiente', premio: 0, monto_premio: 0 })
            .eq('sorteo_id', sorteoIdNum);

        alert("✅ Sorteo reseteado a activo.");

        if (typeof window.cargarHistorialResultados === 'function') {
            await window.cargarHistorialResultados();
        }
        await notificarActualizacionResumen();

    } catch (err) {
        alert("❌ Error al borrar resultado: " + (err.message || err));
    }
};

// ==========================================================
// 4. CARGAR SELECTS DE SORTEOS
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