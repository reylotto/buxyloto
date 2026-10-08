// ==========================================================
// MÓDULO ADMINISTRACIÓN DE USUARIOS, BANCAS Y ZONAS (js/admin.js)
// ==========================================================

export function initAdminModule() {
    console.log("🚀 Módulo Admin Inicializado con Gestión de Zonas y Supervisores.");
    ejecutarCargaSeguraAdmin();
    window.addEventListener('hashchange', ejecutarCargaSeguraAdmin);
    observarContenedorTablas();
}
window.initAdminModule = initAdminModule;

function ejecutarCargaSeguraAdmin() {
    limpiarEventosDuplicados();
    cargarUsuariosSistema();
    cargarBancasSistema();
}

function observarContenedorTablas() {
    const contenedorBancas = document.getElementById('bancas-table-body') || document.getElementById('tabla-bancas-body');
    const contenedorUsuarios = document.getElementById('users-table-body') || document.getElementById('usuarios-table-body');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                if (contenedorBancas && (contenedorBancas.innerHTML.trim() === '' || contenedorBancas.innerHTML.includes('Sin Nombre'))) {
                    cargarBancasSistema();
                }
                if (contenedorUsuarios && contenedorUsuarios.innerHTML.trim() === '') {
                    cargarUsuariosSistema();
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
}

function limpiarEventosDuplicados() {
    const formUser = document.getElementById('form-crear-usuario') || document.getElementById('form-usuario');
    if (formUser) {
        const clone = formUser.cloneNode(true);
        formUser.parentNode.replaceChild(clone, formUser);
        clone.addEventListener('submit', window.guardarUsuarioSistema);
    }

    const formBanca = document.getElementById('form-banca') || document.getElementById('form-crear-banca');
    if (formBanca) {
        const clone = formBanca.cloneNode(true);
        formBanca.parentNode.replaceChild(clone, formBanca);
        clone.addEventListener('submit', window.guardarBancaSistema);
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

// -------------------------------------------------------------------
// 🔥 CORRECCIÓN: CIERRE Y APERTURA DE MODALES CON FLEXBOX PARA CENTRAR
// -------------------------------------------------------------------
window.cerrarTodosLosModales = function() {
    document.querySelectorAll('.fixed').forEach(modal => {
        if(modal.id && modal.id.includes('modal')) {
            modal.classList.add('hidden'); // Oculta
            modal.classList.remove('flex'); // Quita el flex para evitar bugs
            modal.style.display = ''; // Limpia estilos forzados
        }
    });
};
window.cerrarModalUsuario = window.cerrarTodosLosModales;
window.cerrarModalBanca = window.cerrarTodosLosModales;
window.cerrarModal = window.cerrarTodosLosModales; 

// ==========================================================
// 1. GESTIÓN DE USUARIOS Y SUPERVISORES DE ZONA
// ==========================================================
window.abrirModalUsuario = function(id = null) {
    window.cerrarTodosLosModales();
    const modal = document.getElementById('modal-crear-usuario') || document.getElementById('modal-usuario');
    const form = document.getElementById('form-crear-usuario') || document.getElementById('form-usuario');
    const titulo = document.getElementById('modal-titulo-usuario') || document.getElementById('modal-titulo');
    const pwdContainer = document.getElementById('container-password');
    const pwdInput = document.getElementById('crear-password') || document.getElementById('usuario-password');

    if (form) form.reset();
    const editIdInput = document.getElementById('edit-usuario-id');
    if (editIdInput) editIdInput.value = id || '';

    if (id) {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-pen text-cyan-400"></i> Editar Usuario`;
        if(pwdContainer) pwdContainer.style.display = 'none';
        if(pwdInput) pwdInput.required = false;

        const user = (window._usuariosCache || []).find(u => String(u.id) === String(id));
        if (user) {
            const setValorSeguro = (elementId, valor) => {
                const el = document.getElementById(elementId);
                if (el) el.value = valor;
            };

            setValorSeguro('crear-nombre', user.nombre || '');
            setValorSeguro('crear-username', user.username || '');
            setValorSeguro('crear-rol', user.rol || 'supervisor');
            setValorSeguro('crear-estatus', user.estatus || 'activo');
            setValorSeguro('crear-zona', user.zona || 'Zona General');
        }
    } else {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-plus text-cyan-400"></i> Registrar Usuario / Supervisor`;
        if(pwdContainer) pwdContainer.style.display = 'block';
        if(pwdInput) pwdInput.required = true;
    }

    if (modal) {
        modal.classList.remove('hidden'); // Hace visible
        modal.classList.add('flex'); // Activa Flexbox para centrar en pantalla
    }
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
    const zona = document.getElementById('crear-zona')?.value.trim() || 'Zona General';
    const passwordInput = document.getElementById('crear-password');

    const payload = { nombre, username, rol, estatus, zona };

    try {
        if (id) {
            const { error } = await supabase.from('usuarios').update(payload).eq('id', id);
            if (error) throw error;
            alert("✅ Usuario / Supervisor actualizado correctamente.");
        } else {
            payload.password = passwordInput?.value;
            const { error } = await supabase.from('usuarios').insert([payload]);
            if (error) throw error;
            alert("✅ Usuario registrado exitosamente.");
        }
        window.cerrarTodosLosModales();
        await cargarUsuariosSistema();
    } catch (err) {
        alert("Error al guardar usuario: " + err.message);
    }
};

window.cambiarPasswordUsuario = async function(id, nombre) {
    const nueva = prompt(`Ingrese la nueva contraseña para el usuario "${nombre}":`);
    if (!nueva || nueva.trim().length < 6) {
        return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
    }
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (supabase) {
        const { error } = await supabase.from('usuarios').update({ password: nueva.trim() }).eq('id', id);
        if (error) return alert("❌ Error al actualizar contraseña: " + error.message);
        alert("✅ Contraseña actualizada con éxito en Supabase.");
        await cargarUsuariosSistema();
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
                    <td class="p-3 text-slate-300 font-bold uppercase">${user.rol || 'supervisor'}</td>
                    <td class="p-3 text-amber-400 font-semibold">${user.zona || 'Zona General'}</td>
                    <td class="p-3"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.cambiarPasswordUsuario('${user.id}', '${user.nombre}')" class="bg-blue-500/10 hover:bg-blue-500 text-blue-300 hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Cambiar Contraseña">
                                <i class="fa-solid fa-key"></i> Pass
                            </button>
                            <button onclick="window.abrirModalUsuario('${user.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2 py-1.5 rounded transition flex items-center gap-1" title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            <button onclick="window.eliminarUsuarioSistema('${user.id}')" class="bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white px-2 py-1.5 rounded transition flex items-center gap-1" title="Eliminar">
                                <i class="fa-solid fa-trash-can"></i> Eliminar
                            </button>
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
// 2. GESTIÓN DE BANCAS Y VENDEDORES CON SUPERVISOR / ZONA
// ==========================================================
window.abrirModalBanca = function(id = null) {
    window.cerrarTodosLosModales();
    const modal = document.getElementById('modal-banca') || document.getElementById('modal-crear-banca');
    const form = document.getElementById('form-banca') || document.getElementById('form-crear-banca');
    const titulo = document.getElementById('modal-titulo-banca') || document.getElementById('modal-titulo');
    const pwdContainer = document.getElementById('container-pwd-banca') || document.getElementById('container-password-banca');
    const pwdInput = document.getElementById('banca-password') || document.getElementById('crear-password');
    const selectSupervisor = document.getElementById('banca-supervisor');

    if (form) form.reset();
    const editIdInput = document.getElementById('edit-banca-id');
    if (editIdInput) editIdInput.value = id || '';

    if (selectSupervisor) {
        selectSupervisor.innerHTML = '<option value="">-- Sin Supervisor (Admin Central) --</option>';
        const supervisores = (window._usuariosCache || []).filter(u => String(u.rol).toLowerCase() === 'supervisor');
        supervisores.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup.id;
            opt.dataset.zona = sup.zona || 'Zona General';
            opt.textContent = `🛡️ ${sup.nombre} (${sup.zona || 'Zona General'})`;
            selectSupervisor.appendChild(opt);
        });

        selectSupervisor.onchange = () => {
            const optSel = selectSupervisor.options[selectSupervisor.selectedIndex];
            const inputZona = document.getElementById('banca-zona');
            if (inputZona && optSel && optSel.dataset.zona) {
                inputZona.value = optSel.dataset.zona;
            }
        };
    }

    if (id) {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-pen text-emerald-400"></i> <span>Editar Banca / Vendedor</span>`;
        if (pwdContainer) pwdContainer.style.display = 'none'; 
        if (pwdInput) pwdInput.required = false;

        const banca = (window._bancasCache || []).find(b => String(b.id) === String(id));
        if (banca) {
            const setValorSeguro = (elementId, valor) => {
                const el = document.getElementById(elementId);
                if (el) el.value = valor;
            };

            setValorSeguro('banca-nombre', banca.nombre_banca || banca.nombre || '');
            setValorSeguro('banca-operador', banca.vendedor_nombre || banca.operador || '');
            setValorSeguro('banca-usuario', banca.username || banca.usuario || '');
            setValorSeguro('banca-comision', banca.comision !== undefined ? banca.comision : 15);
            setValorSeguro('banca-limite', banca.limite_credito !== undefined ? banca.limite_credito : 300);
            setValorSeguro('banca-max-jugada', banca.monto_max_jugada !== undefined ? banca.monto_max_jugada : 100);
            setValorSeguro('banca-estatus', banca.estatus || 'activo');
            setValorSeguro('banca-zona', banca.zona || 'Zona General');
            
            if (selectSupervisor && banca.supervisor_id) {
                selectSupervisor.value = banca.supervisor_id;
            }
        }
    } else {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-store text-emerald-400"></i> <span>Registrar Nueva Banca / Vendedor</span>`;
        if (pwdContainer) pwdContainer.style.display = 'block';
        if (pwdInput) pwdInput.required = true;
    }

    if (modal) {
        modal.classList.remove('hidden'); // Hace visible
        modal.classList.add('flex'); // Activa Flexbox para centrar en pantalla
    }
};

window.guardarBancaSistema = async function(e) {
    if(e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    if (!supabase) return;

    const id = document.getElementById('edit-banca-id')?.value;
    const selectSup = document.getElementById('banca-supervisor');
    const supervisorId = selectSup?.value || null;
    const zonaVal = document.getElementById('banca-zona')?.value.trim() || 'Zona General';

    const payload = {
        nombre_banca: document.getElementById('banca-nombre')?.value.trim(),
        vendedor_nombre: document.getElementById('banca-operador')?.value.trim() || 'Sin Asignar',
        username: document.getElementById('banca-usuario')?.value.trim(),
        comision: parseFloat(document.getElementById('banca-comision')?.value) || 0,
        limite_credito: parseFloat(document.getElementById('banca-limite')?.value) || 0,
        monto_max_jugada: parseFloat(document.getElementById('banca-max-jugada')?.value) || 100,
        estatus: document.getElementById('banca-estatus')?.value || 'activo',
        supervisor_id: supervisorId,
        zona: zonaVal
    };

    try {
        if (id) {
            const { error } = await supabase.from('bancas').update(payload).eq('id', id);
            if (error) throw error;
            alert("✅ Banca/Vendedor actualizada con éxito.");
        } else {
            payload.password = document.getElementById('banca-password')?.value || document.getElementById('crear-password')?.value;
            const { error } = await supabase.from('bancas').insert([payload]);
            if (error) throw error;
            alert("✅ Nueva banca/vendedor registrada con éxito.");
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
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 text-xs">No hay bancas o vendedores registrados.</td></tr>`;
            return;
        }

        const usuariosCache = window._usuariosCache || [];

        tbody.innerHTML = bancas.map(b => {
            const nombre = b.nombre_banca || b.nombre || 'Banca Principal';
            const operador = b.vendedor_nombre || b.operador || 'Sin Asignar';
            const comisionReal = (b.comision !== undefined && b.comision !== null && !isNaN(b.comision)) ? b.comision : 0;
            const limite = (b.limite_credito !== undefined && !isNaN(b.limite_credito)) ? b.limite_credito : 300;
            const zonaStr = b.zona || 'Zona General';

            let supervisorNombre = 'Admin Central';
            if (b.supervisor_id) {
                const supObj = usuariosCache.find(u => String(u.id) === String(b.supervisor_id));
                if (supObj) supervisorNombre = supObj.nombre;
            }

            const estatusVal = String(b.estatus || 'activo').toLowerCase();
            const badge = estatusVal === 'activo' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-semibold text-white">${nombre}</td>
                    <td class="p-3 text-cyan-400 font-medium">${operador}</td>
                    <td class="p-3 text-amber-400 font-medium">${zonaStr}</td>
                    <td class="p-3 text-slate-300">${supervisorNombre}</td>
                    <td class="p-3 font-mono text-emerald-400 font-bold text-center">${comisionReal}%</td>
                    <td class="p-3 font-mono text-white font-semibold text-center">$${Number(limite).toFixed(2)}</td>
                    <td class="p-3 text-center"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
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