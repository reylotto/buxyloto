// ==========================================================
// MÓDULO ADMINISTRACIÓN DE USUARIOS, BANCAS Y LOTERÍAS (js/admin.js)
// ==========================================================

export function initAdminModule() {
    console.log("🚀 Módulo Admin Inicializado con Gestión Integral (Usuarios, Bancas y Loterías).");
    
    // Iniciar carga inmediata
    ejecutarCargaSeguraAdmin();

    // Blindaje contra recargas de otros módulos
    window.addEventListener('hashchange', ejecutarCargaSeguraAdmin);
    
    // Observadores permanentes para las tablas de administración
    observarContenedorTablas();
}

function ejecutarCargaSeguraAdmin() {
    limpiarEventosDuplicados();
    cargarUsuariosSistema();
    cargarBancasSistema();
    cargarSorteosSistema();
}

function observarContenedorTablas() {
    const contenedorBancas = document.getElementById('bancas-table-body') || document.getElementById('tabla-bancas-body');
    const contenedorUsuarios = document.getElementById('users-table-body') || document.getElementById('usuarios-table-body');
    const contenedorSorteos = document.getElementById('sorteos-table-body') || document.getElementById('tabla-sorteos-body') || document.getElementById('loterias-table-body');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                if (contenedorBancas && (contenedorBancas.innerHTML.trim() === '' || contenedorBancas.innerHTML.includes('Sin Nombre'))) {
                    cargarBancasSistema();
                }
                if (contenedorUsuarios && contenedorUsuarios.innerHTML.trim() === '') {
                    cargarUsuariosSistema();
                }
                if (contenedorSorteos && contenedorSorteos.innerHTML.trim() === '') {
                    cargarSorteosSistema();
                }
            }
        });
    });

    if (contenedorBancas && contenedorBancas.parentNode) {
        observer.observe(contenedorBancas.parentNode, { childList: true, subtree: true });
    }
    if (contenedorUsuarios && contenedorUsuarios.parentNode) {
        observer.observe(contenedorUsuarios.parentNode, { childList: true, subtree: true });
    }
    if (contenedorSorteos && contenedorSorteos.parentNode) {
        observer.observe(contenedorSorteos.parentNode, { childList: true, subtree: true });
    }
}

function limpiarEventosDuplicados() {
    const formUser = document.getElementById('form-crear-usuario') || document.getElementById('form-usuario');
    if (formUser) {
        const clone = formUser.cloneNode(true);
        formUser.parentNode.replaceChild(clone, formUser);
        clone.addEventListener('submit', window.guardarUsuarioSistema);
    }

    const formBanca = document.getElementById('form-banca');
    if (formBanca) {
        const clone = formBanca.cloneNode(true);
        formBanca.parentNode.replaceChild(clone, formBanca);
        clone.addEventListener('submit', window.guardarBancaSistema);
    }

    const formSorteo = document.getElementById('form-sorteo') || document.getElementById('form-crear-sorteo');
    if (formSorteo) {
        const clone = formSorteo.cloneNode(true);
        formSorteo.parentNode.replaceChild(clone, formSorteo);
        clone.addEventListener('submit', window.guardarSorteoSistema);
    }

    const btnUser = document.getElementById('btn-open-usuario-modal') || document.getElementById('btn-open-user-modal');
    if (btnUser) {
        const clone = btnUser.cloneNode(true);
        btnUser.parentNode.replaceChild(clone, btnUser);
        clone.addEventListener('click', (e) => { e.preventDefault(); window.abrirModalUsuario(); });
    }

    const btnBanca = document.getElementById('btn-open-banca-modal') || document.getElementById('btn-open-bank-modal');
    if (btnBanca) {
        const clone = btnBanca.cloneNode(true);
        btnBanca.parentNode.replaceChild(clone, btnBanca);
        clone.addEventListener('click', (e) => { e.preventDefault(); window.abrirModalBanca(); });
    }
}

window.cerrarTodosLosModales = function() {
    document.querySelectorAll('.fixed').forEach(modal => {
        if(modal.id && modal.id.includes('modal')) modal.classList.add('hidden');
    });
};
window.cerrarModalUsuario = window.cerrarTodosLosModales;
window.cerrarModalBanca = window.cerrarTodosLosModales;
window.cerrarModalSorteo = window.cerrarTodosLosModales;

// ==========================================================
// GESTIÓN DE USUARIOS
// ==========================================================
window.abrirModalUsuario = function(id = null) {
    window.cerrarTodosLosModales();
    const modal = document.getElementById('modal-crear-usuario') || document.getElementById('modal-usuario');
    const form = document.getElementById('form-crear-usuario') || document.getElementById('form-usuario');
    const titulo = document.getElementById('modal-titulo') || document.getElementById('modal-titulo-usuario');
    const pwdContainer = document.getElementById('container-password');
    const pwdInput = document.getElementById('crear-password') || document.getElementById('usuario-password');

    if (form) form.reset();
    const inputEditId = document.getElementById('edit-usuario-id');
    if (inputEditId) inputEditId.value = id || '';

    if (id) {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-pen"></i> Editar Usuario`;
        if(pwdContainer) pwdContainer.style.display = 'none';
        if(pwdInput) pwdInput.required = false;

        const user = (window._usuariosCache || []).find(u => String(u.id) === String(id));
        if (user) {
            document.getElementById('crear-nombre').value = user.nombre || '';
            document.getElementById('crear-username').value = user.username || '';
            document.getElementById('crear-rol').value = user.rol || 'admin';
            document.getElementById('crear-estatus').value = user.estatus || 'activo';
        }
    } else {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-plus"></i> Registrar Nuevo Usuario`;
        if(pwdContainer) pwdContainer.style.display = 'block';
        if(pwdInput) pwdInput.required = true;
    }

    if (modal) modal.classList.remove('hidden');
};

window.guardarUsuarioSistema = async function(e) {
    if(e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    const id = document.getElementById('edit-usuario-id')?.value;
    const nombre = document.getElementById('crear-nombre')?.value.trim();
    const username = document.getElementById('crear-username')?.value.trim();
    const rol = document.getElementById('crear-rol')?.value;
    const estatus = document.getElementById('crear-estatus')?.value;
    const passwordInput = document.getElementById('crear-password');

    try {
        if (id) {
            const { error } = await supabase.from('usuarios').update({ nombre, username, rol, estatus }).eq('id', id);
            if (error) throw error;
            alert("✅ Usuario actualizado correctamente.");
        } else {
            const { error } = await supabase.from('usuarios').insert([{ nombre, username, password: passwordInput.value, rol, estatus }]);
            if (error) throw error;
            alert("✅ Usuario registrado exitosamente.");
        }
        window.cerrarTodosLosModales();
        await cargarUsuariosSistema();
    } catch (err) {
        alert("Error al guardar usuario: " + err.message);
    }
};

export async function cargarUsuariosSistema() {
    const tbody = document.getElementById('users-table-body') || document.getElementById('usuarios-table-body');
    if (!tbody) return;

    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    try {
        const { data: usuarios, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        window._usuariosCache = usuarios || [];

        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-xs">No hay usuarios registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = usuarios.map(user => {
            const estatusVal = String(user.estatus || 'activo').toLowerCase();
            const badge = estatusVal === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-semibold text-white">${user.nombre || 'Sin nombre'}</td>
                    <td class="p-3 text-cyan-400 font-mono">@${user.username || 'sin-usuario'}</td>
                    <td class="p-3 text-slate-300 font-bold uppercase">${user.rol || 'admin'}</td>
                    <td class="p-3 text-slate-400">${user.banca_asignada || 'Global'}</td>
                    <td class="p-3"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="window.abrirModalUsuario('${user.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2.5 py-1.5 rounded flex items-center gap-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="window.eliminarUsuarioSistema('${user.id}')" class="bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white px-2.5 py-1.5 rounded flex items-center gap-1" title="Eliminar"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar usuarios:", err);
    }
}

window.eliminarUsuarioSistema = async function(id) {
    if (!confirm("¿Eliminar este usuario definitivamente?")) return;
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        await supabase.from('usuarios').delete().eq('id', id);
        cargarUsuariosSistema();
    }
};

// ==========================================================
// GESTIÓN DE BANCAS Y VENDEDORES
// ==========================================================
window.abrirModalBanca = function(id = null) {
    window.cerrarTodosLosModales();
    const modal = document.getElementById('modal-banca');
    const form = document.getElementById('form-banca');
    const titulo = document.getElementById('modal-titulo-banca');
    const pwdContainer = document.getElementById('container-pwd-banca');
    const pwdInput = document.getElementById('banca-password');
    const inputOperador = document.getElementById('banca-operador');

    if (form) form.reset();
    const inputEditId = document.getElementById('edit-banca-id');
    if (inputEditId) inputEditId.value = id || '';

    if (id) {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-pen"></i> <span>Editar Configuración de Banca</span>`;
        if (pwdContainer) pwdContainer.style.display = 'none'; 
        if (pwdInput) pwdInput.required = false;
        if (inputOperador) inputOperador.required = false;

        const banca = (window._bancasCache || []).find(b => String(b.id) === String(id));
        if (banca) {
            document.getElementById('banca-nombre').value = banca.nombre_banca || banca.nombre || '';
            if (inputOperador) inputOperador.value = banca.vendedor_nombre || banca.operador || banca.vendedor || '';
            document.getElementById('banca-usuario').value = banca.username || banca.usuario || '';
            document.getElementById('banca-comision').value = banca.comision !== undefined ? banca.comision : 15;
            document.getElementById('banca-limite').value = banca.limite_credito !== undefined ? banca.limite_credito : 300;
            document.getElementById('banca-max-jugada').value = banca.monto_max_jugada !== undefined ? banca.monto_max_jugada : 100;
            document.getElementById('banca-estatus').value = banca.estatus || 'activo';
        }
    } else {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-store text-cyan-400"></i> <span>Registrar Nueva Banca / Vendedor POS</span>`;
        if (pwdContainer) pwdContainer.style.display = 'block';
        if (pwdInput) pwdInput.required = true;
        if (inputOperador) inputOperador.required = true;
    }

    if (modal) modal.classList.remove('hidden');
};

window.guardarBancaSistema = async function(e) {
    if(e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    const id = document.getElementById('edit-banca-id')?.value;
    const nombreOperador = document.getElementById('banca-operador')?.value.trim() || '';
    
    const payload = {
        nombre_banca: document.getElementById('banca-nombre')?.value.trim(),
        vendedor_nombre: nombreOperador !== '' ? nombreOperador : 'Sin asignar',
        username: document.getElementById('banca-usuario')?.value.trim(),
        comision: parseFloat(document.getElementById('banca-comision')?.value) || 0,
        limite_credito: parseFloat(document.getElementById('banca-limite')?.value) || 0,
        monto_max_jugada: parseFloat(document.getElementById('banca-max-jugada')?.value) || 100,
        estatus: document.getElementById('banca-estatus')?.value
    };

    try {
        if (id) {
            const { error } = await supabase.from('bancas').update(payload).eq('id', id);
            if (error) throw error;
            alert("✅ Banca actualizada con éxito.");
        } else {
            payload.password = document.getElementById('banca-password')?.value;
            const { error } = await supabase.from('bancas').insert([payload]);
            if (error) throw error;
            alert("✅ Nueva banca registrada con éxito.");
        }
        window.cerrarTodosLosModales();
        await cargarBancasSistema();
    } catch(err) {
        alert("Error al guardar banca: " + err.message);
    }
};

export async function cargarBancasSistema() {
    const tbody = document.getElementById('bancas-table-body') || document.getElementById('tabla-bancas-body');
    if (!tbody) return;

    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    try {
        const { data: bancas, error } = await supabase.from('bancas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        window._bancasCache = bancas || [];

        if (!bancas || bancas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 text-xs">No hay bancas o vendedores registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = bancas.map(b => {
            const nombre = b.nombre_banca || b.nombre || 'Banca Principal';
            const operador = b.vendedor_nombre || b.operador || b.vendedor || 'Sin Asignar';
            const comision = (b.comision !== undefined && !isNaN(b.comision)) ? b.comision : 15;
            const limite = (b.limite_credito !== undefined && !isNaN(b.limite_credito)) ? b.limite_credito : 300;
            const maxJugada = (b.monto_max_jugada !== undefined && !isNaN(b.monto_max_jugada)) ? b.monto_max_jugada : 100;
            
            const estatusVal = String(b.estatus || 'activo').toLowerCase();
            const badge = estatusVal === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-semibold text-white">${nombre}</td>
                    <td class="p-3 text-cyan-400 font-medium">${operador}</td>
                    <td class="p-3 font-mono text-emerald-400 font-bold">${comision}%</td>
                    <td class="p-3 font-mono text-white font-semibold">$${Number(limite).toFixed(2)}</td>
                    <td class="p-3 text-slate-400 font-mono">Máx: $${maxJugada}</td>
                    <td class="p-3"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.cambiarPasswordBanca('${b.id}', '${nombre}')" class="bg-blue-500/10 hover:bg-blue-500 text-blue-300 hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Cambiar Contraseña"><i class="fa-solid fa-key"></i> Pass</button>
                            <button onclick="window.abrirModalBanca('${b.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2 py-1.5 rounded transition flex items-center gap-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="window.cambiarEstatusBanca('${b.id}', '${estatusVal}')" class="bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Bloquear"><i class="fa-solid fa-ban"></i> ${estatusVal === 'activo' ? 'Bloquear' : 'Activar'}</button>
                            <button onclick="window.eliminarBancaSistema('${b.id}')" class="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Eliminar"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar bancas:", err);
    }
}

window.cambiarPasswordBanca = async function(id, nombre) {
    const nueva = prompt(`Ingrese la nueva contraseña para ${nombre}:`);
    if (!nueva || nueva.trim() === '') return;
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        await supabase.from('bancas').update({ password: nueva.trim() }).eq('id', id);
        alert("✅ Contraseña actualizada.");
    }
};

window.cambiarEstatusBanca = async function(id, estatusActual) {
    const nuevo = estatusActual === 'activo' ? 'inactivo' : 'activo';
    if (!confirm(`¿Cambiar estatus a '${nuevo}'?`)) return;
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        await supabase.from('bancas').update({ estatus: nuevo }).eq('id', id);
        cargarBancasSistema();
    }
};

window.eliminarBancaSistema = async function(id) {
    if (!confirm("¿Desea eliminar esta banca del sistema de forma permanente?")) return;
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        await supabase.from('bancas').delete().eq('id', id);
        cargarBancasSistema();
    }
};

// ==========================================================
// GESTIÓN DE LOTERÍAS & SORTEOS (EVALUACIÓN DE ESTADO VIVO PANAMÁ)
// ==========================================================

function calcularEstatusVisualSorteo(sorteo) {
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
        if (!hStr) return def;
        let s = String(hStr).trim();
        if (s.length === 5) s += ':00';
        return s.length === 8 ? s : def;
    };

    const horaApertura = normHora(sorteo.horario_apertura || sorteo.hora_apertura, '06:00:00');
    const horaCierre = normHora(sorteo.horario_cierre || sorteo.hora_cierre, '23:59:00');

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

export async function cargarSorteosSistema() {
    const tbody = document.getElementById('sorteos-table-body') || 
                  document.getElementById('tabla-sorteos-body') || 
                  document.getElementById('loterias-table-body') ||
                  document.getElementById('sorteos-list-body');
    if (!tbody) return;

    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
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

            const horaApertura = s.horario_apertura || s.hora_apertura || '06:00';
            const horaCierre = s.horario_cierre || s.hora_cierre || '--';
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
                            <button onclick="window.abrirModalSorteo('${s.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2 py-1.5 rounded flex items-center gap-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="window.cambiarEstatusSorteo('${s.id}', '${estatusRealDB}')" class="${esPausado ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300' : 'bg-amber-500/10 hover:bg-amber-500 text-amber-300'} hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Pausar/Activar">
                                <i class="fa-solid ${esPausado ? 'fa-play' : 'fa-pause'}"></i> ${esPausado ? 'Activar' : 'Pausar'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar sorteos en admin:", err);
    }
}
window.cargarSorteosSistema = cargarSorteosSistema;

window.abrirModalSorteo = function(id = null) {
    window.cerrarTodosLosModales();
    const modal = document.getElementById('modal-sorteo') || document.getElementById('modal-crear-sorteo');
    const form = document.getElementById('form-sorteo') || document.getElementById('form-crear-sorteo');

    if (form) form.reset();
    const editIdInput = document.getElementById('edit-sorteo-id');
    if (editIdInput) editIdInput.value = id || '';

    if (id) {
        const sorteo = (window._sorteosCache || []).find(s => String(s.id) === String(id));
        if (sorteo) {
            const nomInput = document.getElementById('sorteo-nombre');
            const apInput = document.getElementById('sorteo-apertura');
            const ciInput = document.getElementById('sorteo-cierre');
            const diasInput = document.getElementById('sorteo-dias');

            if (nomInput) nomInput.value = sorteo.nombre || '';
            if (apInput) apInput.value = sorteo.horario_apertura || sorteo.hora_apertura || '06:00';
            if (ciInput) ciInput.value = sorteo.horario_cierre || sorteo.hora_cierre || '';
            if (diasInput) diasInput.value = sorteo.dias_juego || sorteo.dias || '';
        }
    }

    if (modal) modal.classList.remove('hidden');
};

window.guardarSorteoSistema = async function(e) {
    if (e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    const id = document.getElementById('edit-sorteo-id')?.value;
    const nombre = document.getElementById('sorteo-nombre')?.value.trim();
    const horaApertura = document.getElementById('sorteo-apertura')?.value || '06:00';
    const horaCierre = document.getElementById('sorteo-cierre')?.value;
    const diasJuego = document.getElementById('sorteo-dias')?.value || 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';

    if (!nombre || !horaCierre) {
        alert("Por favor complete nombre y hora de cierre.");
        return;
    }

    const payload = {
        nombre: nombre,
        horario_apertura: horaApertura,
        hora_apertura: horaApertura,
        horario_cierre: horaCierre,
        hora_cierre: horaCierre,
        dias_juego: diasJuego
    };

    try {
        if (id) {
            const { error } = await supabase.from('sorteos').update(payload).eq('id', id);
            if (error) throw error;
            alert("✅ Sorteo actualizado correctamente.");
        } else {
            payload.estatus = 'ACTIVO';
            payload.estado = 'ACTIVO';
            const { error } = await supabase.from('sorteos').insert([payload]);
            if (error) throw error;
            alert("✅ Sorteo creado correctamente.");
        }
        window.cerrarTodosLosModales();
        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    } catch (err) {
        alert("Error al guardar sorteo: " + err.message);
    }
};

window.cambiarEstatusSorteo = async function(id, estatusActual) {
    const esPausado = ['PAUSADO', 'INACTIVO'].includes(String(estatusActual).toUpperCase());
    const nuevoEstatus = esPausado ? 'ACTIVO' : 'PAUSADO';

    if (!confirm(`¿Desea cambiar el estatus del sorteo a '${nuevoEstatus}'?`)) return;

    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        await supabase.from('sorteos').update({ estatus: nuevoEstatus, estado: nuevoEstatus }).eq('id', id);
        await cargarSorteosSistema();
        if (typeof window.cargarSorteosPOS === 'function') {
            await window.cargarSorteosPOS();
        }
    }
};