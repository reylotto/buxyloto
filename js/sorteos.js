// ==========================================================
// MÓDULO DE GESTIÓN DE LOTERÍAS Y SORTEOS (js/sorteos.js)
// ==========================================================

let timerRefrescoSorteos = null;

export function initSorteosModule() {
    console.log("🎲 Módulo de Sorteos Inicializado.");
    cargarSorteosSistema();
    activarEventosSorteo();

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

    const estatusDB = String(sorteo.estatus || sorteo.estado || 'ACTIVO').toUpperCase().trim();
    if (['PAUSADO', 'INACTIVO', 'PAUSA', 'DESACTIVADO'].includes(estatusDB)) {
        return {
            texto: 'PAUSADO',
            clase: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        };
    }

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
// 2. CARGA Y RENDERIZADO DE LA TABLA EN EL ADMIN (CON 3 BOTONES)
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
        let querySorteos = supabase.from('sorteos').select('*').order('id', { ascending: true });
        
        const inquilinoId = localStorage.getItem('inquilino_id');
        const esInquilino = (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && String(inquilinoId).trim() !== '');

        if (esInquilino) {
            querySorteos = querySorteos.eq('inquilino_id', inquilinoId);
        } else {
            querySorteos = querySorteos.is('inquilino_id', null);
        }

        const { data: sorteosRaw, error } = await querySorteos;
        if (error) throw error;

        const sorteos = (sorteosRaw || []).filter(s => {
            if (esInquilino) {
                return String(s.inquilino_id) === String(inquilinoId);
            } else {
                return !s.inquilino_id || s.inquilino_id === null || s.inquilino_id === 'null';
            }
        });

        window._sorteosCache = sorteos;

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
            
            let diasJuego = 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';
            if (Array.isArray(s.dias) && s.dias.length > 0) diasJuego = s.dias.join(', ');
            else if (s.dias_juego) diasJuego = s.dias_juego;

            const multiplicador = s.multiplicador || 60;
            const nombreSeguro = String(s.nombre || '').replace(/'/g, "\\'");

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-bold text-white">${s.nombre}</td>
                    <td class="p-3 font-mono text-slate-300">${horaApertura}</td>
                    <td class="p-3 font-mono text-slate-300">${horaCierre}</td>
                    <td class="p-3 text-slate-400 text-[11px]">${diasJuego}</td>
                    <td class="p-3 text-slate-400 font-mono">x${multiplicador}</td>
                    <td class="p-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${estatusInfo.clase}">${estatusInfo.texto}</span>
                    </td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button type="button" onclick="window.abrirModalSorteo('${s.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2.5 py-1.5 rounded transition flex items-center gap-1" title="Editar Sorteo">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            <button type="button" onclick="window.cambiarEstatusSorteo('${s.id}', '${estatusRealDB}')" class="${esPausado ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300' : 'bg-amber-500/10 hover:bg-amber-500 text-amber-300'} hover:text-white px-2.5 py-1.5 rounded transition flex items-center gap-1" title="Pausar/Activar">
                                <i class="fa-solid ${esPausado ? 'fa-play' : 'fa-pause'}"></i> ${esPausado ? 'Activar' : 'Pausar'}
                            </button>
                            <button type="button" onclick="window.eliminarSorteoSistema('${s.id}', '${nombreSeguro}')" class="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white px-2.5 py-1.5 rounded transition flex items-center gap-1" title="Eliminar Sorteo">
                                <i class="fa-solid fa-trash-can"></i>
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
// 3. APERTURA, CIERRE BLINDADO Y ELIMINACIÓN DE SORTEO
// ----------------------------------------------------------
function obtenerModalSorteo() {
    return document.getElementById('modal-sorteo') || 
           document.getElementById('modal-loteria') ||
           document.getElementById('modal-crear-sorteo') ||
           document.getElementById('form-loteria')?.closest('.fixed') ||
           document.getElementById('form-sorteo')?.closest('.fixed');
}

export function cerrarModalSorteo() {
    const modal = obtenerModalSorteo();
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
    }

    const form = document.getElementById('form-sorteo') || 
                 document.getElementById('form-loteria') ||
                 document.getElementById('form-crear-sorteo');
    if (form) form.reset();

    const inputEditId = document.getElementById('edit-sorteo-id') || 
                        document.getElementById('loteria-edit-id') || 
                        document.getElementById('sorteo-id');
    if (inputEditId) inputEditId.value = '';
}
window.cerrarModalSorteo = cerrarModalSorteo;
window.closeLoteriaModal = cerrarModalSorteo;

export function abrirModalSorteo(id = null) {
    cerrarModalSorteo();

    const modal = obtenerModalSorteo();
    const titulo = document.getElementById('modal-loteria-title') || document.getElementById('modal-sorteo-title');
    if (titulo) titulo.textContent = id ? 'Editar Configuración de Sorteo' : 'Nuevo Sorteo';

    const inputEditId = document.getElementById('edit-sorteo-id') || 
                        document.getElementById('loteria-edit-id') || 
                        document.getElementById('sorteo-id');
    if (inputEditId) inputEditId.value = id || '';

    if (id) {
        const sorteo = (window._sorteosCache || []).find(s => String(s.id) === String(id));
        if (sorteo) {
            const elNom = document.getElementById('sorteo-nombre') || document.getElementById('loteria-name');
            const elAp = document.getElementById('sorteo-apertura') || document.getElementById('loteria-open-time');
            const elCi = document.getElementById('sorteo-cierre') || document.getElementById('loteria-close-time');
            const elMult = document.getElementById('loteria-multiplier');
            const elEstatus = document.getElementById('loteria-status');
            
            if (elNom) elNom.value = sorteo.nombre || '';
            if (elAp) elAp.value = (sorteo.hora_apertura === '00:00' ? '06:00' : sorteo.hora_apertura) || '06:00';
            if (elCi) elCi.value = sorteo.hora_cierre || '';
            if (elMult) elMult.value = sorteo.multiplicador || 60;
            if (elEstatus) elEstatus.value = String(sorteo.estatus || 'activo').toLowerCase();

            const cbs = document.querySelectorAll('input[name="loteria-days"]');
            cbs.forEach(cb => {
                cb.checked = (Array.isArray(sorteo.dias) && sorteo.dias.includes(cb.value)) || 
                             (sorteo.dias_juego && String(sorteo.dias_juego).includes(cb.value));
            });
        }
    } else {
        const cbs = document.querySelectorAll('input[name="loteria-days"]');
        cbs.forEach(cb => cb.checked = true);
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
    }
}
window.abrirModalSorteo = abrirModalSorteo;

export async function cambiarEstatusSorteo(id, estatusActual) {
    const esPausado = ['PAUSADO', 'INACTIVO'].includes(String(estatusActual).toUpperCase());
    const nuevoEstatus = esPausado ? 'activo' : 'inactivo';

    if (!confirm(`¿Confirma cambiar el estatus del sorteo a '${nuevoEstatus.toUpperCase()}'?`)) return;

    const supabase = getSupabase();
    if (supabase) {
        await supabase.from('sorteos').update({ estatus: nuevoEstatus }).eq('id', id);
        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    }
}
window.cambiarEstatusSorteo = cambiarEstatusSorteo;

export async function eliminarSorteoSistema(id, nombre = '') {
    if (!confirm(`¿Deseas eliminar definitivamente el sorteo "${nombre}"? Esta acción no se puede deshacer.`)) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { error } = await supabase.from('sorteos').delete().eq('id', id);
        if (error) throw error;

        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    } catch (err) {
        alert('❌ No se pudo eliminar el sorteo (puede tener tickets asociados): ' + err.message);
    }
}
window.eliminarSorteoSistema = eliminarSorteoSistema;
window.deleteLoteria = eliminarSorteoSistema;

// ----------------------------------------------------------
// 4. EVENTOS E INTERCEPTACIÓN LIMPIA DE FORMULARIO Y BOTONES
// ----------------------------------------------------------
function vincularBotonesCierreModal() {
    const modal = obtenerModalSorteo();
    if (!modal) return;

    modal.querySelectorAll('button').forEach(btn => {
        const texto = (btn.textContent || '').trim().toLowerCase();
        const esBotonX = btn.querySelector('.fa-xmark, .fa-times') || texto === '×' || texto === 'x';
        const esCancelar = texto === 'cancelar' || texto === 'cerrar';

        if (esBotonX || esCancelar) {
            btn.type = 'button';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                cerrarModalSorteo();
            };
        }
    });
}

function activarEventosSorteo() {
    const btnNuevo = document.getElementById('btn-open-loteria-modal') || 
                     document.getElementById('btn-open-sorteo-modal');
                     
    if (btnNuevo) {
        btnNuevo.onclick = (e) => {
            e.preventDefault();
            abrirModalSorteo(null);
        };
    }
    vincularBotonesCierreModal();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        localStorage.removeItem('buxyloto_app_state');
        
        if (typeof window.cargarSorteosSistema === 'function') {
            window.renderLoteriasTable = window.cargarSorteosSistema;
            window.renderizarTablaLoterias = window.cargarSorteosSistema;
        }
        
        window.editLoteria = function(id) {
            window.abrirModalSorteo(id);
        };
        
        window.toggleLoteriaStatus = async function(id) {
            const supabase = getSupabase();
            const { data } = await supabase.from('sorteos').select('estatus').eq('id', id).single();
            if (data) {
                window.cambiarEstatusSorteo(id, data.estatus);
            }
        };

        window.guardarLoteriaSorteoSeguro = async function(e) {
            if (e) e.preventDefault();
            
            const inputEditId = document.getElementById('loteria-edit-id') || document.getElementById('edit-sorteo-id') || document.getElementById('sorteo-id');
            const editId = inputEditId ? inputEditId.value.trim() : '';
            const nombre = document.getElementById('loteria-name')?.value || document.getElementById('sorteo-nombre')?.value || '';
            const horaApertura = document.getElementById('loteria-open-time')?.value || document.getElementById('sorteo-apertura')?.value || '06:00';
            const horaCierre = document.getElementById('loteria-close-time')?.value || document.getElementById('sorteo-cierre')?.value || '';
            const multiplicador = document.getElementById('loteria-multiplier')?.value || 60;
            const estatus = document.getElementById('loteria-status')?.value || 'activo';
            
            const diasCheckboxes = document.querySelectorAll('input[name="loteria-days"]:checked');
            const dias = Array.from(diasCheckboxes).map(cb => cb.value);

            if (!nombre || !horaCierre) return alert('⚠️ Por favor ingrese el nombre del sorteo y hora de cierre.');

            try {
                const payload = {
                    nombre: nombre,
                    hora_apertura: horaApertura,
                    hora_cierre: horaCierre,
                    multiplicador: parseFloat(multiplicador),
                    estatus: estatus,
                    dias: dias 
                };

                const inquilinoId = localStorage.getItem('inquilino_id');
                if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && String(inquilinoId).trim() !== '') {
                    payload.inquilino_id = inquilinoId;
                }

                const supabase = getSupabase();
                let res;
                if (editId !== '' && editId !== 'null' && editId !== 'undefined') {
                    res = await supabase.from('sorteos').update(payload).eq('id', editId);
                } else {
                    res = await supabase.from('sorteos').insert([payload]).select();
                }

                if (res.error) throw res.error;

                alert('✅ ¡Sorteo guardado con éxito!');
                window.cerrarModalSorteo();
                await window.cargarSorteosSistema();
                
            } catch (err) {
                alert('❌ Error al guardar en Supabase: ' + err.message);
            }
        };

        const formLoteria = document.getElementById('form-loteria') || document.getElementById('form-sorteo');
        if (formLoteria) {
            const nuevoForm = formLoteria.cloneNode(true);
            formLoteria.parentNode.replaceChild(nuevoForm, formLoteria);
            nuevoForm.addEventListener('submit', window.guardarLoteriaSorteoSeguro);
        }

        // Reconectar botones de cierre y apertura después de clonar el formulario
        activarEventosSorteo();
        if (typeof window.cargarSorteosSistema === 'function') window.cargarSorteosSistema();

    }, 1500);
});