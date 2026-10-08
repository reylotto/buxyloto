// ==========================================================
// MÓDULO ADMINISTRACIÓN DE USUARIOS, BANCAS Y ZONAS (js/admin.js)
// ==========================================================

export function initAdminModule() {
    console.log("🚀 Módulo Admin Inicializado.");
    ejecutarCargaSeguraAdmin();
    window.addEventListener('hashchange', ejecutarCargaSeguraAdmin);
}
window.initAdminModule = initAdminModule;

function ejecutarCargaSeguraAdmin() {
    cargarUsuariosSistema();
    cargarBancasSistema();
}

// Cierra cualquier modal abierto para evitar superposiciones (pantallas divididas)
window.cerrarTodosLosModales = function() {
    document.querySelectorAll('.fixed').forEach(modal => {
        if(modal.id && modal.id.includes('modal')) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.style.display = '';
        }
    });
};
window.cerrarModalUsuario = window.cerrarTodosLosModales;
window.cerrarModalBanca = window.cerrarTodosLosModales;
window.cerrarModal = window.cerrarTodosLosModales; 

// ==========================================================
// 1. GESTIÓN DE USUARIOS Y SUPERVISORES
// ==========================================================
window.abrirModalUsuario = function(id = null) {
    window.cerrarTodosLosModales();
    
    // Forzamos buscar estrictamente el modal de usuarios
    const modal = document.getElementById('modal-crear-usuario');
    const form = document.getElementById('form-crear-usuario');
    const titulo = document.getElementById('modal-titulo-usuario');
    const pwdContainer = document.getElementById('container-password');
    const pwdInput = document.getElementById('crear-password');

    if (form) form.reset();
    const editIdInput = document.getElementById('edit-usuario-id');
    if (editIdInput) editIdInput.value = id || '';

    if (id) {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-pen text-cyan-400"></i> Editar Usuario`;
        if(pwdContainer) pwdContainer.style.display = 'none';
        if(pwdInput) pwdInput.required = false;

        const user = (window._usuariosCache || []).find(u => String(u.id) === String(id));
        if (user) {
            if(document.getElementById('crear-nombre')) document.getElementById('crear-nombre').value = user.nombre || user.nombre_completo || '';
            if(document.getElementById('crear-username')) document.getElementById('crear-username').value = user.username || user.nombre_usuario || '';
            if(document.getElementById('crear-rol')) document.getElementById('crear-rol').value = user.rol || 'supervisor';
            if(document.getElementById('crear-estatus')) document.getElementById('crear-estatus').value = user.estatus || user.estado || 'activo';
            if(document.getElementById('crear-zona')) document.getElementById('crear-zona').value = user.zona || 'Zona General';
        }
    } else {
        if(titulo) titulo.innerHTML = `<i class="fa-solid fa-user-plus text-cyan-400"></i> Registrar Nuevo Usuario`;
        if(pwdContainer) pwdContainer.style.display = 'block';
        if(pwdInput) pwdInput.required = true;
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.guardarUsuarioSistema = async function(e) {
    if(e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const id = document.getElementById('edit-usuario-id')?.value;
    const payload = {
        nombre: document.getElementById('crear-nombre')?.value.trim(),
        username: document.getElementById('crear-username')?.value.trim(),
        rol: document.getElementById('crear-rol')?.value,
        estatus: document.getElementById('crear-estatus')?.value,
        zona: document.getElementById('crear-zona')?.value.trim() || 'Zona General'
    };

    try {
        if (id) {
            await supabase.from('usuarios').update(payload).eq('id', id);
            alert("✅ Usuario actualizado.");
        } else {
            payload.password = document.getElementById('crear-password')?.value;
            await supabase.from('usuarios').insert([payload]);
            alert("✅ Usuario registrado exitosamente.");
        }
        window.cerrarTodosLosModales();
        await cargarUsuariosSistema();
    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
};

export async function cargarUsuariosSistema() {
    const tbody = document.getElementById('usuarios-table-body') || document.querySelector('#section-usuarios tbody');
    if (!tbody) return;
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    try {
        const { data: usuarios, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        window._usuariosCache = usuarios || [];

        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-xs">No hay usuarios.</td></tr>`;
            return;
        }

        tbody.innerHTML = usuarios.map(user => {
            const nombre = user.nombre || user.nombre_completo || 'Sin nombre';
            const username = user.username || user.nombre_usuario || 'sin-usuario';
            const rol = user.rol || 'supervisor';
            const zona = user.zona || 'Zona General';
            const estatusVal = String(user.estatus || user.estado || 'activo').toLowerCase();
            const badge = estatusVal === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-semibold text-white">${nombre}</td>
                    <td class="p-3 text-cyan-400 font-mono">@${username}</td>
                    <td class="p-3 text-slate-300 font-bold uppercase">${rol}</td>
                    <td class="p-3 text-amber-400 font-semibold">${zona}</td>
                    <td class="p-3"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.abrirModalUsuario('${user.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2 py-1.5 rounded transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="window.eliminarUsuarioSistema('${user.id}')" class="bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white px-2 py-1.5 rounded transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Error usuarios:", err); }
}

window.eliminarUsuarioSistema = async function(id) {
    if (!confirm("¿Eliminar usuario definitivamente?")) return;
    const supabase = window.supabaseClient || window.supabase;
    if (supabase) {
        await supabase.from('usuarios').delete().eq('id', id);
        cargarUsuariosSistema();
    }
};

// ==========================================================
// 2. GESTIÓN DE BANCAS Y VENDEDORES (8 COLUMNAS EXACTAS)
// ==========================================================
window.abrirModalBanca = function(id = null) {
    window.cerrarTodosLosModales();
    
    // Forzamos buscar estrictamente el modal de bancas
    const modal = document.getElementById('modal-banca');
    const form = document.getElementById('form-banca');
    const titulo = document.getElementById('modal-titulo-banca');
    const pwdContainer = document.getElementById('container-pwd-banca');
    const pwdInput = document.getElementById('banca-password');
    const selectSupervisor = document.getElementById('banca-supervisor');

    if (form) form.reset();
    const editIdInput = document.getElementById('edit-banca-id');
    if (editIdInput) editIdInput.value = id || '';

    // Cargar supervisores en el select
    if (selectSupervisor) {
        selectSupervisor.innerHTML = '<option value="">-- Sin Supervisor (Admin Central) --</option>';
        const supervisores = (window._usuariosCache || []).filter(u => String(u.rol).toLowerCase() === 'supervisor');
        supervisores.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup.id;
            opt.dataset.zona = sup.zona || 'Zona General';
            opt.textContent = `🛡️ ${sup.nombre || sup.nombre_completo} (${sup.zona || 'Zona General'})`;
            selectSupervisor.appendChild(opt);
        });

        selectSupervisor.onchange = () => {
            const optSel = selectSupervisor.options[selectSupervisor.selectedIndex];
            if (document.getElementById('banca-zona') && optSel && optSel.dataset.zona) {
                document.getElementById('banca-zona').value = optSel.dataset.zona;
            }
        };
    }

    if (id) {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-pen text-emerald-400"></i> <span>Editar Banca / Vendedor</span>`;
        if (pwdContainer) pwdContainer.style.display = 'none'; 
        if (pwdInput) pwdInput.required = false;

        const banca = (window._bancasCache || []).find(b => String(b.id) === String(id));
        if (banca) {
            if(document.getElementById('banca-nombre')) document.getElementById('banca-nombre').value = banca.nombre_banca || banca.nombre || '';
            if(document.getElementById('banca-operador')) document.getElementById('banca-operador').value = banca.vendedor_nombre || banca.operador || '';
            if(document.getElementById('banca-usuario')) document.getElementById('banca-usuario').value = banca.username || '';
            if(document.getElementById('banca-comision')) document.getElementById('banca-comision').value = banca.comision !== undefined ? banca.comision : 15;
            if(document.getElementById('banca-limite')) document.getElementById('banca-limite').value = banca.limite_credito !== undefined ? banca.limite_credito : 300;
            if(document.getElementById('banca-estatus')) document.getElementById('banca-estatus').value = banca.estatus || 'activo';
            if(document.getElementById('banca-zona')) document.getElementById('banca-zona').value = banca.zona || 'Zona General';
            if(selectSupervisor && banca.supervisor_id) selectSupervisor.value = banca.supervisor_id;
        }
    } else {
        if (titulo) titulo.innerHTML = `<i class="fa-solid fa-store text-emerald-400"></i> <span>Registrar Nueva Banca</span>`;
        if (pwdContainer) pwdContainer.style.display = 'block';
        if (pwdInput) pwdInput.required = true;
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.guardarBancaSistema = async function(e) {
    if(e) e.preventDefault();
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const id = document.getElementById('edit-banca-id')?.value;
    const payload = {
        nombre_banca: document.getElementById('banca-nombre')?.value.trim(),
        vendedor_nombre: document.getElementById('banca-operador')?.value.trim() || 'Sin Asignar',
        username: document.getElementById('banca-usuario')?.value.trim(),
        comision: parseFloat(document.getElementById('banca-comision')?.value) || 0,
        limite_credito: parseFloat(document.getElementById('banca-limite')?.value) || 0,
        estatus: document.getElementById('banca-estatus')?.value || 'activo',
        supervisor_id: document.getElementById('banca-supervisor')?.value || null,
        zona: document.getElementById('banca-zona')?.value.trim() || 'Zona General'
    };

    try {
        if (id) {
            await supabase.from('bancas').update(payload).eq('id', id);
            alert("✅ Banca actualizada.");
        } else {
            payload.password = document.getElementById('banca-password')?.value;
            await supabase.from('bancas').insert([payload]);
            alert("✅ Banca registrada.");
        }
        window.cerrarTodosLosModales();
        await cargarBancasSistema();
    } catch(err) { alert("Error: " + err.message); }
};

export async function cargarBancasSistema() {
    const tbody = document.getElementById('bancas-table-body') || document.getElementById('tabla-bancas-body');
    if (!tbody) return;
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    try {
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase().trim();
        const esAdmin = rol === 'admin' || rol === 'administrador';
        const zonaUsuario = sesion.zona || 'Zona General';

        // Filtrado en tabla sin usar RPC para evitar resultados en blanco
        let query = supabase.from('bancas').select('*');
        if (!esAdmin && zonaUsuario) {
            query = query.eq('zona', zonaUsuario);
        }
        
        const resDirect = await query.order('created_at', { ascending: false });
        if (resDirect.error) throw resDirect.error;
        
        const bancas = resDirect.data || [];
        window._bancasCache = bancas || [];

        if (!bancas || bancas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 text-xs">No hay bancas registradas.</td></tr>`;
            return;
        }

        const usuariosCache = window._usuariosCache || [];

        // 8 COLUMNAS EXACTAS PARA NO CORRER EL DISEÑO
        tbody.innerHTML = bancas.map(b => {
            const nombre = b.nombre_banca || b.nombre || 'Banca';
            const operador = b.vendedor_nombre || b.operador || 'Sin Asignar';
            const zonaStr = b.zona || 'Zona General';
            const comisionReal = (b.comision !== undefined && b.comision !== null && !isNaN(b.comision)) ? b.comision : 0;
            const limite = (b.limite_credito !== undefined && !isNaN(b.limite_credito)) ? b.limite_credito : 300;

            let supervisorNombre = 'Admin Central';
            if (b.supervisor_id) {
                const supObj = usuariosCache.find(u => String(u.id) === String(b.supervisor_id));
                if (supObj) supervisorNombre = supObj.nombre || supObj.nombre_completo;
            }

            const estatusVal = String(b.estatus || b.estado || 'activo').toLowerCase();
            const badge = estatusVal === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40 text-xs">
                    <td class="p-3 font-semibold text-white">${nombre}</td>
                    <td class="p-3 text-cyan-400 font-medium">${operador}</td>
                    <td class="p-3 text-amber-400 font-medium">${zonaStr}</td>
                    <td class="p-3 text-slate-300"><i class="fa-solid fa-shield-halved text-slate-500 mr-1"></i> ${supervisorNombre}</td>
                    <td class="p-3 font-mono text-emerald-400 font-bold text-center">${comisionReal}%</td>
                    <td class="p-3 font-mono text-white font-semibold text-center">$${Number(limite).toFixed(2)}</td>
                    <td class="p-3 text-center"><span class="${badge} border px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">${estatusVal}</span></td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.abrirModalBanca('${b.id}')" class="bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 px-2 py-1.5 rounded transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="window.eliminarBancaSistema('${b.id}')" class="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-1.5 rounded transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Error bancas:", err); }
}

window.eliminarBancaSistema = async function(id) {
    if (!confirm("¿Desea eliminar esta banca del sistema de forma permanente?")) return;
    const supabase = window.supabaseClient || window.supabase;
    if (supabase) {
        await supabase.from('bancas').delete().eq('id', id);
        cargarBancasSistema();
    }
};