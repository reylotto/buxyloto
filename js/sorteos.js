// ==========================================================
// MÓDULO DE GESTIÓN DE LOTERÍAS Y SORTEOS (js/sorteos.js)
// ==========================================================

let timerRefrescoSorteos = null;

export function initSorteosModule() {
    console.log("🎲 Módulo de Sorteos Inicializado.");
    cargarSorteosSistema();
    activarEventosSorteo();

    // Refresco automático de la tabla cada 30 segundos para actualizar CERRADO/ACTIVO en vivo
    if (timerRefrescoSorteos) clearInterval(timerRefrescoSorteos);
    timerRefrescoSorteos = setInterval(() => {
        cargarSorteosSistema();
    }, 30000);
}
window.initSorteosModule = initSorteosModule;

function getSupabase() {
    return window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
}

// ----------------------------------------------------------
// 1. CÁLCULO DINÁMICO DEL ESTATUS (HORA PANAMÁ)
// ----------------------------------------------------------
export function calcularEstatusVisualSorteo(sorteo) {
    if (!sorteo) return { texto: 'CERRADO', clase: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };

    // 1. Interruptor Administrativo Maestro (Pausado / Inactivo)
    const estatusDB = String(sorteo.estatus || sorteo.estado || 'ACTIVO').toUpperCase().trim();
    if (['PAUSADO', 'INACTIVO', 'PAUSA', 'DESACTIVADO'].includes(estatusDB)) {
        return {
            texto: 'PAUSADO',
            clase: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        };
    }

    // 2. Evaluar Hora Actual en Panamá (Formato 24h)
    const ahoraPanama = new Date().toLocaleTimeString('en-GB', { 
        timeZone: 'America/Panama', 
        hour12: false 
    });

    const normHora = (hStr, def) => {
        if (!hStr || hStr === '00:00' || hStr === '00:00:00') return def;
        let s = String(hStr).trim();
        if (s.length === 5) s += ':00';
        return s.length === 8 ? s : def;
    };

    const horaApertura = normHora(sorteo.hora_apertura || sorteo.horario_apertura, '06:00:00');
    const horaCierre = normHora(sorteo.hora_cierre || sorteo.horario_cierre, '23:59:00');

    // Fuera de ventana horaria
    if (ahoraPanama < horaApertura || ahoraPanama >= horaCierre) {
        return {
            texto: 'CERRADO',
            clase: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        };
    }

    return {
        texto: 'ACTIVO',
        clase: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    };
}
window.calcularEstatusVisualSorteo = calcularEstatusVisualSorteo;

// ----------------------------------------------------------
// 2. CARGA Y RENDERIZADO DE LA TABLA EN EL ADMIN
// ----------------------------------------------------------
export async function cargarSorteosSistema() {
    const tbody = document.getElementById('sorteos-table-body') || 
                  document.getElementById('tabla-sorteos-body') || 
                  document.getElementById('loterias-table-body') ||
                  document.getElementById('sorteos-list-body');

    if (!tbody) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data: sorteos, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        window._sorteosCache = sorteos || [];

        if (!sorteos || sorteos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 text-xs">No hay sorteos configurados.</td></tr>`;
            return;
        }

        tbody.innerHTML = sorteos.map(s => {
            const estatusInfo = calcularEstatusVisualSorteo(s);
            const estatusRealDB = String(s.estatus || s.estado || 'ACTIVO').toUpperCase();
            const esPausado = ['PAUSADO', 'INACTIVO'].includes(estatusRealDB);

            const horaApertura = s.hora_apertura || s.horario_apertura || '06:00';
            const horaCierre = s.hora_cierre || s.horario_cierre || '--';
            const diasJuego = s.dias_juego || s.dias || 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-bold text-white">${s.nombre}</td>
                    <td class="p-3 font-mono text-slate-300">${horaApertura}</td>
                    <td class="p-3 font-mono text-slate-300">${horaCierre}</td>
                    <td class="p-3 text-slate-400 text-[11px]">${diasJuego}</td>
                    <td class="p-3 text-slate-400 font-mono">x60</td>
                    <td class="p-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${estatusInfo.clase}">
                            ${estatusInfo.texto}
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button type="button" onclick="window.abrirModalSorteo('${s.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2.5 py-1.5 rounded transition flex items-center gap-1" title="Editar Sorteo">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            <button type="button" onclick="window.cambiarEstatusSorteo('${s.id}', '${estatusRealDB}')" class="${esPausado ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300' : 'bg-amber-500/10 hover:bg-amber-500 text-amber-300'} hover:text-white px-2.5 py-1.5 rounded transition flex items-center gap-1" title="Pausar/Activar">
                                <i class="fa-solid ${esPausado ? 'fa-play' : 'fa-pause'}"></i> ${esPausado ? 'Activar' : 'Pausar'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("❌ Error al cargar sorteos:", err.message || err);
    }
}
window.cargarSorteosSistema = cargarSorteosSistema;

// ----------------------------------------------------------
// 3. APERTURA Y EDICIÓN VÍA MODAL
// ----------------------------------------------------------
export function abrirModalSorteo(id = null) {
    const modal = document.getElementById('modal-sorteo') || 
                  document.getElementById('modal-crear-sorteo') ||
                  document.querySelector('.modal-sorteo');

    const form = document.getElementById('form-sorteo') || 
                 document.getElementById('form-crear-sorteo');

    if (form) form.reset();

    const inputEditId = document.getElementById('edit-sorteo-id') || document.getElementById('sorteo-id');
    if (inputEditId) inputEditId.value = id || '';

    if (id) {
        const sorteo = (window._sorteosCache || []).find(s => String(s.id) === String(id));
        if (sorteo) {
            const elNom = document.getElementById('sorteo-nombre') || document.querySelector('input[name="sorteo-nombre"]');
            const elAp = document.getElementById('sorteo-apertura') || document.querySelector('input[name="sorteo-apertura"]');
            const elCi = document.getElementById('sorteo-cierre') || document.querySelector('input[name="sorteo-cierre"]');
            const elDias = document.getElementById('sorteo-dias') || document.querySelector('input[name="sorteo-dias"]');

            if (elNom) elNom.value = sorteo.nombre || '';
            if (elAp) elAp.value = (sorteo.hora_apertura === '00:00' ? '06:00' : sorteo.hora_apertura) || sorteo.horario_apertura || '06:00';
            if (elCi) elCi.value = sorteo.hora_cierre || sorteo.horario_cierre || '';
            if (elDias) elDias.value = sorteo.dias_juego || sorteo.dias || 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';
        }
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        alert("⚠️ No se encontró la ventana modal de edición de sorteos en el HTML.");
    }
}
window.abrirModalSorteo = abrirModalSorteo;

export function cerrarModalSorteo() {
    const modal = document.getElementById('modal-sorteo') || 
                  document.getElementById('modal-crear-sorteo') ||
                  document.querySelector('.modal-sorteo');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}
window.cerrarModalSorteo = cerrarModalSorteo;

// ----------------------------------------------------------
// 4. GUARDAR CAMBIOS Y CAMBIAR ESTATUS
// ----------------------------------------------------------
export async function guardarSorteoSistema(e) {
    if (e) e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const id = (document.getElementById('edit-sorteo-id') || document.getElementById('sorteo-id'))?.value;
    const nombre = (document.getElementById('sorteo-nombre') || document.querySelector('input[name="sorteo-nombre"]'))?.value.trim();
    const horaApertura = (document.getElementById('sorteo-apertura') || document.querySelector('input[name="sorteo-apertura"]'))?.value || '06:00';
    const horaCierre = (document.getElementById('sorteo-cierre') || document.querySelector('input[name="sorteo-cierre"]'))?.value;
    const diasJuego = (document.getElementById('sorteo-dias') || document.querySelector('input[name="sorteo-dias"]'))?.value || 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';

    if (!nombre || !horaCierre) {
        alert("⚠️ Ingrese el nombre del sorteo y su hora de cierre.");
        return;
    }

    // Payload limpio enviando únicamente las columnas existentes en Supabase
    const payload = {
        nombre: nombre,
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
        dias_juego: diasJuego
    };

    try {
        if (id) {
            const { error } = await supabase.from('sorteos').update(payload).eq('id', id);
            if (error) throw error;
            alert("✅ Sorteo actualizado con éxito.");
        } else {
            payload.estatus = 'ACTIVO';
            payload.estado = 'ACTIVO';
            const { error } = await supabase.from('sorteos').insert([payload]);
            if (error) throw error;
            alert("✅ Nuevo sorteo registrado con éxito.");
        }

        cerrarModalSorteo();
        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    } catch (err) {
        alert("❌ Error al guardar sorteo: " + (err.message || err));
    }
}
window.guardarSorteoSistema = guardarSorteoSistema;

export async function cambiarEstatusSorteo(id, estatusActual) {
    const esPausado = ['PAUSADO', 'INACTIVO'].includes(String(estatusActual).toUpperCase());
    const nuevoEstatus = esPausado ? 'ACTIVO' : 'PAUSADO';

    if (!confirm(`¿Confirma cambiar el estatus del sorteo a '${nuevoEstatus}'?`)) return;

    const supabase = getSupabase();
    if (supabase) {
        await supabase.from('sorteos').update({ estatus: nuevoEstatus, estado: nuevoEstatus }).eq('id', id);
        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    }
}
window.cambiarEstatusSorteo = cambiarEstatusSorteo;

// ----------------------------------------------------------
// 5. EVENTOS E INICIALIZACIÓN
// ----------------------------------------------------------
function activarEventosSorteo() {
    const form = document.getElementById('form-sorteo') || document.getElementById('form-crear-sorteo');
    if (form) {
        form.onsubmit = guardarSorteoSistema;
    }

    // Se agrega 'btn-open-loteria-modal' para que coincida con tu index.html
    const btnNuevo = document.getElementById('btn-open-loteria-modal') || 
                     document.getElementById('btn-open-sorteo-modal') || 
                     document.getElementById('btn-nuevo-sorteo');
                     
    if (btnNuevo) {
        btnNuevo.onclick = (e) => {
            e.preventDefault();
            abrirModalSorteo(null);
        };
    }
}