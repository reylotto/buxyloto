// --- MÓDULO DASHBOARD Y MÉTRICAS ACTUALIZADO (PERFIL ADMIN & REALTIME CONECTADO) ---

// Respaldo por si getSupabaseClient o getSupabaseClientDashboard no están definidos globalmente
if (typeof window.getSupabaseClient !== 'function') {
    window.getSupabaseClient = function() {
        if (window.supabase) return window.supabase;
        if (window.supabaseClient) return window.supabaseClient;
        console.error("Cliente de Supabase no encontrado en window.");
        return null;
    };
}

if (typeof window.getSupabaseClientDashboard !== 'function') {
    window.getSupabaseClientDashboard = window.getSupabaseClient;
}

export function initDashboardModule() {
    console.log("Módulo Dashboard inicializado.");
    initSystemClock();
    cargarMetricasSeguras();
    initBancasModal();
    initBancasSearch();
    cargarBancas();
    cargarHistorialTickets();
    initPerfilAdmin();
    cargarResumenOperacionesHoy();
}
window.initDashboardModule = initDashboardModule;

// 1. Reloj del sistema
function initSystemClock() {
    const clockEl = document.getElementById('system-clock');
    if (!clockEl) return;
    
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    }, 1000);
}

function initPerfilAdmin() {
    // 1. Cargar datos del perfil si existe la sesión
    if (typeof cargarDatosPerfilAdmin === 'function') {
        cargarDatosPerfilAdmin();
    }

    // 2. Vincular el botón de guardar perfil
    const btnGuardar = document.getElementById('btn-guardar-perfil-admin') || document.getElementById('btn-save-admin') || document.querySelector('#modal-perfil-admin .btn-primary');
    
    if (btnGuardar) {
        // Remover listeners viejos clonando el elemento
        const btnLimpio = btnGuardar.cloneNode(true);
        if (btnGuardar.parentNode) {
            btnGuardar.parentNode.replaceChild(btnLimpio, btnGuardar);
        }

        btnLimpio.addEventListener('click', (e) => {
            e.preventDefault();
            guardarPerfilAdmin();
        });
    }
}

// ==========================================================
// 2. GESTIÓN DE PERFIL Y CONTRASENA ADMINISTRADOR CENTRAL
// ==========================================================
async function guardarPerfilAdmin() {
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase || !supabase.auth) {
        return alert("Error: No hay conexión con la autenticación de Supabase.");
    }

    // 1. Localizar el modal de perfil
    const modal = document.getElementById('modal-perfil-admin') || document.querySelector('.modal:not(.hidden)');
    
    // 2. Capturar todas las cajas de texto dentro del modal
    const inputs = modal ? Array.from(modal.querySelectorAll('input')) : [];
    
    if (inputs.length === 0) {
        return alert("Error: No se encontraron los campos del formulario en el modal.");
    }

    const nuevoNombre = inputs[0] ? inputs[0].value.trim() : '';
    const nuevoUsuario = inputs[1] ? inputs[1].value.trim() : '';
    const nuevaPassword = inputs[2] ? inputs[2].value.trim() : '';
    const confirmarPassword = inputs[3] ? inputs[3].value.trim() : '';

    const btnGuardar = document.getElementById('btn-guardar-perfil-admin') || 
                       document.getElementById('btn-save-admin') || 
                       (modal ? modal.querySelector('.btn-primary, button[type="submit"]') : null);

    // Validación de contraseñas
    if (nuevaPassword) {
        if (nuevaPassword.length < 6) {
            return alert("La contraseña debe tener al menos 6 caracteres.");
        }
        if (confirmarPassword && nuevaPassword !== confirmarPassword) {
            return alert("Las contraseñas no coinciden. Por favor verifique.");
        }
    }

    if (!nuevoNombre && !nuevoUsuario && !nuevaPassword) {
        return alert("Por favor, ingrese el nombre de usuario o la nueva contraseña a cambiar.");
    }

    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...';
    }

    try {
        const updatePayload = { data: {} };

        if (nuevaPassword) {
            updatePayload.password = nuevaPassword;
        }

        if (nuevoNombre) {
            updatePayload.data.full_name = nuevoNombre;
        }

        if (nuevoUsuario) {
            updatePayload.data.username = nuevoUsuario;
            if (nuevoUsuario.includes('@')) {
                updatePayload.email = nuevoUsuario;
            }
        }

        // 1. Actualizar credenciales y metadatos en Supabase Auth
        const { data, error } = await supabase.auth.updateUser(updatePayload);

        if (error) throw error;

        // 2. Sincronizar en la tabla pública de usuarios en Supabase si existe
        if (data && data.user) {
            const updateDB = {};
            if (nuevoNombre) updateDB.nombre = nuevoNombre;
            if (nuevoUsuario) updateDB.username = nuevoUsuario;

            await supabase
                .from('usuarios')
                .update(updateDB)
                .eq('id', data.user.id);
        }

        // 3. Actualizar el nombre en la barra superior derecha al instante
        const adminNameLabel = document.getElementById('admin-profile-display-name') || 
                               document.getElementById('admin-name') || 
                               document.querySelector('.user-profile span');
        if (adminNameLabel && (nuevoNombre || nuevoUsuario)) {
            adminNameLabel.textContent = nuevoNombre || nuevoUsuario;
        }

        alert("¡Perfil de Administrador Central actualizado con éxito en Supabase!");

        // Limpiar campos de contraseña
        if (inputs[2]) inputs[2].value = '';
        if (inputs[3]) inputs[3].value = '';

        // Cerrar modal
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }

    } catch (err) {
        console.error("Error al actualizar perfil admin en Supabase:", err);
        alert("Error al actualizar en Supabase: " + (err.message || JSON.stringify(err)));
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = 'Actualizar Mis Datos';
        }
    }
}

// Cierre de sesión seguro y redirección
async function cerrarSesionAdmin() {
    if (!confirm("¿Estás seguro de que deseas cerrar sesión?")) return;

    try {
        const supabase = window.getSupabaseClient();
        if (supabase && supabase.auth) {
            await supabase.auth.signOut();
        }
    } catch (err) {
        console.error("Error al cerrar sesión en Supabase:", err);
    } finally {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
    }
}
window.cerrarSesionAdmin = cerrarSesionAdmin;

// ==========================================================
// 3. MÉTRICAS DEL DASHBOARD (EXCLUYENDO CANCELADOS)
// ==========================================================
async function cargarMetricasSeguras() {
    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        // Consultar directamente la tabla 'tickets'
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('monto, monto_total, total, premio, monto_premio, estatus, estado');

        if (error) {
            console.warn("Aviso en métricas al consultar tickets:", error.message);
            return;
        }

        const listaTickets = tickets || [];

        // EXCLUIR TICKETS CANCELADOS O ANULADOS
        const listaTicketsValidos = listaTickets.filter(t => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        // Calcular total vendido solo con tickets válidos
        const totalVendido = listaTicketsValidos.reduce((acc, t) => {
            const montoVal = Number(t.monto_total || t.monto || t.total || 0);
            return acc + montoVal;
        }, 0);

        // Calcular total de premios a pagar con tickets válidos
        const totalPremios = listaTicketsValidos.reduce((acc, t) => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            if (est === 'premiado' || est === 'ganador') {
                return acc + Number(t.premio || t.monto_premio || 0);
            }
            return acc;
        }, 0);

        // Actualizar elementos en el DOM si existen
        const elemTotal = document.getElementById('metric-total-ventas') || document.getElementById('total-ventas');
        if (elemTotal) elemTotal.textContent = `$${totalVendido.toFixed(2)}`;

        const elemPremios = document.getElementById('metric-total-premios') || document.getElementById('total-premios');
        if (elemPremios) elemPremios.textContent = `$${totalPremios.toFixed(2)}`;

        const elemCant = document.getElementById('metric-cant-tickets') || document.getElementById('cant-tickets');
        if (elemCant) elemCant.textContent = listaTicketsValidos.length;

    } catch (err) {
        console.warn("Aviso en métricas:", err.message);
    }
}
window.cargarMetricasSeguras = cargarMetricasSeguras;

// Helper para obtener el modal activo
function getBancaModal() {
    return document.getElementById('modal-crear-banca') || document.getElementById('modal-crear-usuario');
}

// Helper para obtener el formulario activo
function getBancaForm() {
    return document.getElementById('form-crear-banca') || document.getElementById('form-crear-usuario');
}

// Control del Modal de Bancas
function initBancasModal() {
    const modal = getBancaModal();
    const btnOpen = document.getElementById('btn-open-banca-modal');
    const form = getBancaForm();

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            prepararModalParaCrear();
            const targetModal = getBancaModal();
            if (targetModal) targetModal.classList.remove('hidden');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModal();
        });
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const rol = document.getElementById('crear-rol')?.value || 'banca';
            if (rol === 'banca' || rol === 'vendedor') {
                await guardarBanca();
            } else if (typeof window.guardarUsuarioSistema === 'function') {
                await window.guardarUsuarioSistema();
            }
        };
    }
}

export function cerrarModal() {
    const modalUsuario = document.getElementById('modal-crear-usuario');
    const modalBanca = document.getElementById('modal-crear-banca');
    if (modalUsuario) modalUsuario.classList.add('hidden');
    if (modalBanca) modalBanca.classList.add('hidden');
    prepararModalParaCrear();
}
window.cerrarModal = cerrarModal;

function prepararModalParaCrear() {
    const form = getBancaForm();
    if (form) form.reset();

    const editIdInput = document.getElementById('edit-banca-id') || document.getElementById('edit-usuario-id');
    if (editIdInput) editIdInput.value = '';

    const pwdInput = document.getElementById('crear-password') || document.getElementById('bnk-password') || document.getElementById('banca-password');
    const pwdContainer = document.getElementById('container-password') || document.getElementById('container-password-banca') || pwdInput?.parentElement;
    if (pwdContainer) pwdContainer.style.display = 'block';
    if (pwdInput) pwdInput.required = true;

    const modalTitle = document.getElementById('modal-titulo');
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-user-plus text-emerald-400"></i> <span>Registrar Nueva Banca / Vendedor</span>`;

    const btnGuardar = document.getElementById('btn-guardar-usuario') || document.getElementById('btn-guardar-banca');
    if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar en Supabase`;
    }
}

// 4. FUNCIÓN EDITAR BANCA
window.editarBanca = window.configurarBanca = function(id) {
    const modal = getBancaModal();
    if (!modal) return alert("Error: No se encontró el modal en la página.");

    const banca = (window._bancasCache || []).find(b => String(b.id) === String(id));
    if (!banca) return alert("No se pudieron cargar los datos de esta banca.");

    const editBancaId = document.getElementById('edit-banca-id');
    const editUserId = document.getElementById('edit-usuario-id');
    if (editBancaId) editBancaId.value = banca.id;
    if (editUserId) editUserId.value = banca.id;

    const elNombreBanca = document.getElementById('crear-banca') || document.getElementById('bnk-nombre') || document.getElementById('banca-nombre');
    if (elNombreBanca) elNombreBanca.value = banca.nombre_banca || banca.nombre || '';

    const elVendedor = document.getElementById('crear-nombre') || document.getElementById('bnk-vendedor') || document.getElementById('banca-encargado');
    if (elVendedor) elVendedor.value = banca.vendedor_nombre || banca.vendedor || ''; 

    const elUsername = document.getElementById('crear-username') || document.getElementById('bnk-username') || document.getElementById('banca-username');
    if (elUsername) elUsername.value = banca.username || '';

    const elComision = document.getElementById('crear-comision') || document.getElementById('bnk-comision') || document.getElementById('banca-comision');
    if (elComision) elComision.value = banca.comision || 0;

    const elLimite = document.getElementById('crear-limite') || document.getElementById('bnk-limite') || document.getElementById('banca-limite');
    if (elLimite) elLimite.value = banca.limite_credito || 0;

    const elRol = document.getElementById('crear-rol');
    if (elRol) elRol.value = banca.rol || 'banca';

    const elEstatus = document.getElementById('crear-estatus');
    if (elEstatus) elEstatus.value = banca.estatus || 'activo';

    const pwdInput = document.getElementById('crear-password') || document.getElementById('bnk-password') || document.getElementById('banca-password');
    const pwdContainer = document.getElementById('container-password') || document.getElementById('container-password-banca') || pwdInput?.parentElement;
    if (pwdContainer) pwdContainer.style.display = 'none';
    if (pwdInput) {
        pwdInput.required = false;
        pwdInput.value = '';
    }

    const modalTitle = document.getElementById('modal-titulo');
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square text-emerald-400"></i> <span>Editar Banca: ${banca.nombre_banca || banca.nombre}</span>`;

    const btnGuardar = document.getElementById('btn-guardar-usuario') || document.getElementById('btn-guardar-banca');
    if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Actualizar Banca`;
    }

    modal.classList.remove('hidden');
};

// 5. Guardar Banca en Supabase
export async function guardarBanca() {
    const supabase = window.getSupabaseClient();
    if (!supabase) return alert("Error: No hay conexión con Supabase.");

    const rol = document.getElementById('crear-rol')?.value || 'banca';
    if (rol === 'admin' || rol === 'supervisor' || rol === 'caja') {
        if (typeof window.guardarUsuarioSistema === 'function') {
            return await window.guardarUsuarioSistema();
        }
        return;
    }

    let bancaId = (document.getElementById('edit-banca-id') || document.getElementById('edit-usuario-id'))?.value;
    if (bancaId === 'undefined' || bancaId === 'null' || !bancaId) {
        bancaId = ''; 
    }

    const nombreBanca = (
        document.getElementById('crear-banca')?.value || 
        document.getElementById('bnk-nombre')?.value || 
        document.getElementById('banca-nombre')?.value || 
        ''
    ).trim();

    const vendedorNombre = (
        document.getElementById('crear-nombre')?.value || 
        document.getElementById('bnk-vendedor')?.value || 
        document.getElementById('banca-encargado')?.value || 
        ''
    ).trim();

    const username = (
        document.getElementById('crear-username')?.value || 
        document.getElementById('bnk-username')?.value || 
        document.getElementById('banca-username')?.value || 
        ''
    ).trim();

    const password = (
        document.getElementById('crear-password')?.value || 
        document.getElementById('bnk-password')?.value || 
        document.getElementById('banca-password')?.value || 
        ''
    );

    const comision = parseFloat(
        document.getElementById('crear-comision')?.value || 
        document.getElementById('bnk-comision')?.value || 
        0
    ) || 0;

    const limiteCredito = parseFloat(
        document.getElementById('crear-limite')?.value || 
        document.getElementById('bnk-limite')?.value || 
        0
    ) || 0;

    const estatus = document.getElementById('crear-estatus')?.value || 'activo';

    if (!nombreBanca) return alert("Por favor, ingresa el Nombre Comercial de la Banca.");
    if (!vendedorNombre) return alert("Por favor, ingresa el Nombre del Encargado / Vendedor.");
    if (!username) return alert("Por favor, ingresa un Usuario de Acceso (Username).");

    const btnGuardar = document.getElementById('btn-guardar-usuario') || document.getElementById('btn-guardar-banca');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
        if (bancaId && bancaId !== '') {
            const updateData = {
                nombre_banca: nombreBanca,
                vendedor_nombre: vendedorNombre,
                username: username,
                comision: comision,
                limite_credito: limiteCredito,
                rol: rol,
                estatus: estatus
            };

            const { error: updateError } = await supabase
                .from('bancas')
                .update(updateData)
                .eq('id', bancaId);

            if (updateError) throw updateError;
            alert("¡Banca actualizada correctamente en Supabase!");
        } else {
            if (!password || password.length < 6) {
                alert("La contraseña debe tener al menos 6 caracteres.");
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;
                }
                return;
            }

            const { error: dbError } = await supabase.from('bancas').insert([{
                nombre_banca: nombreBanca,
                vendedor_nombre: vendedorNombre,
                username: username,
                password: password, 
                rol: rol,
                comision: comision,
                limite_credito: limiteCredito,
                estatus: estatus
            }]);

            if (dbError) throw dbError;
            alert("¡Banca registrada exitosamente en Supabase!");
        }

        cerrarModal();
        await cargarBancas();

    } catch (err) {
        console.error("Error al guardar en Supabase:", err);
        alert("Error al guardar en Supabase: " + (err.message || JSON.stringify(err)));
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;
        }
    }
}
window.guardarBanca = guardarBanca;

// 6. Cargar Tabla de Bancas
export async function cargarBancas(filtroTexto = '') {
    const tbody = document.getElementById('bancas-table-body');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="p-6 text-center text-slate-400">
                <i class="fa-solid fa-spinner fa-spin mr-2 text-emerald-400"></i> Conectando con Supabase...
            </td>
        </tr>
    `;

    const supabase = window.getSupabaseClient();
    if (!supabase) return;

    try {
        const { data: bancas, error } = await supabase
            .from('bancas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        window._bancasCache = bancas || [];
        if (typeof AppState !== 'undefined') {
            AppState.bancas = bancas || [];
        }

        let bancasFiltradas = bancas || [];
        if (filtroTexto.trim() !== '') {
            const q = filtroTexto.toLowerCase();
            bancasFiltradas = bancasFiltradas.filter(b => 
                (b.nombre_banca && b.nombre_banca.toLowerCase().includes(q)) ||
                (b.vendedor_nombre && b.vendedor_nombre.toLowerCase().includes(q)) ||
                (b.username && b.username.toLowerCase().includes(q))
            );
        }

        if (bancasFiltradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-6 text-center text-slate-400">
                        No hay bancas registradas en Supabase.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = bancasFiltradas.map(banca => {
            let estatusBadge = banca.estatus === 'activo'
                ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">Activo</span>`
                : `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">Inactivo</span>`;

            const comision = Number(banca.comision || 0).toFixed(2);
            const limiteCredito = Number(banca.limite_credito || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            const safeBanca = (banca.nombre_banca || '').replace(/'/g, "\\'");

            return `
                <tr class="hover:bg-slate-800/60 transition border-b border-slate-700/40">
                    <td class="p-3 font-semibold text-white">${banca.nombre_banca || 'Sin nombre'}</td>
                    <td class="p-3 text-slate-300">
                        <div class="font-medium">${banca.vendedor_nombre || 'N/A'}</div>
                        <div class="text-[11px] text-cyan-400 font-mono">@${banca.username || 'sin-usuario'}</div>
                    </td>
                    <td class="p-3 font-mono text-emerald-400 font-bold">${comision}%</td>
                    <td class="p-3 font-mono text-slate-200">${limiteCredito}</td>
                    <td class="p-3 text-slate-400 text-xs">${banca.rol || 'banca'}</td>
                    <td class="p-3">${estatusBadge}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="editarBanca('${banca.id}')" class="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-lg transition" title="Editar Banca">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="cambiarPasswordBanca('${banca.id}', '${safeBanca}')" class="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded-lg transition" title="Cambiar Contraseña">
                                <i class="fa-solid fa-key"></i>
                            </button>
                            <button onclick="eliminarBanca('${banca.id}')" class="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition" title="Eliminar Banca">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar bancas:", err);
    }
}

// 7. Buscador y Helpers
function initBancasSearch() {
    const searchInput = document.getElementById('input-buscar-banca');
    if (searchInput) searchInput.addEventListener('input', (e) => cargarBancas(e.target.value));
}

window.cambiarPasswordBanca = async function(bancaId, nombreBanca) {
    if (!bancaId) return alert("ID de banca inválido.");
    const nuevaClave = prompt(`Nueva contraseña para la banca "${nombreBanca}":`);
    if (!nuevaClave || nuevaClave.length < 6) return alert("Cancelado. Mínimo 6 caracteres.");
    try {
        const { error } = await window.getSupabaseClient().from('bancas').update({ password: nuevaClave }).eq('id', bancaId);
        if (error) throw error;
        alert("¡Contraseña actualizada con éxito!");
    } catch (err) {
        alert("Error: " + err.message);
    }
};

window.eliminarBanca = async function(id) {
    if (!confirm("¿Estás seguro de eliminar esta banca por completo?")) return;
    try {
        const { error } = await window.getSupabaseClient().from('bancas').delete().eq('id', id);
        if (error) throw error;
        alert("Banca eliminada exitosamente.");
        await cargarBancas();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
};

// ==========================================================
// CARGAR HISTORIAL DE TICKETS CON RESTRICCIÓN STRICTA DE ANULACIÓN
// ==========================================================
async function cargarHistorialTickets() {
    const tbody = document.getElementById('tickets-table-body') || 
                  document.getElementById('tabla-historial-tickets') ||
                  document.getElementById('historial-tickets-body');

    if (!tbody) return;

    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        // 1. Obtener la lista de sorteos para consultar estado y hora de cierre
        const { data: sorteosData } = await supabase
            .from('sorteos')
            .select('*');
        const sorteosCache = sorteosData || [];

        // 2. Consultar los tickets ordenados del más reciente al más antiguo
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados aún.</td></tr>';
            return;
        }

        const bancasCache = window._bancasCache || [];
        const ahora = new Date();

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            const codigo = t.codigo || t.codigo_ticket || `BX-${t.id}`;
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            
            let nombreBanca = t.banca_nombre || t.vendedor_nombre || t.banca || t.vendedor || '';
            if (!nombreBanca && (t.banca_id || t.usuario_id)) {
                const bId = String(t.banca_id || t.usuario_id);
                const encontrada = bancasCache.find(b => String(b.id) === bId);
                if (encontrada) {
                    nombreBanca = encontrada.nombre_banca || encontrada.vendedor_nombre || encontrada.username;
                }
            }
            if (!nombreBanca) nombreBanca = 'Banca General';

            const montoVenta = Number(t.monto_total || t.monto || t.total || 0).toFixed(2);
            const montoPremio = Number(t.premio || t.monto_premio || 0).toFixed(2);
            const estado = String(t.estatus || t.estado || 'pendiente').toLowerCase();

            let jugadasTexto = '-';
            const lista = t.detalles || t.jugadas;
            if (Array.isArray(lista)) {
                jugadasTexto = lista.map(j => `#${j.numero || j.number || ''} ($${j.monto || j.amount || 0})`).join(', ');
            } else if (typeof lista === 'string') {
                try {
                    const parsed = JSON.parse(lista);
                    if (Array.isArray(parsed)) {
                        jugadasTexto = parsed.map(j => `#${j.numero || j.number || ''} ($${j.monto || j.amount || 0})`).join(', ');
                    }
                } catch(e) {}
            }

            // --- REGLAS DE ESTATUS Y BOTÓN DE ANULACIÓN ---
            let estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">PENDIENTE</span>`;
            let textoPremio = `<span class="text-slate-500 font-mono">$0.00</span>`;
            let puedeAnular = false;
            let motivoBloqueo = 'Cerrado';

            // 1. Evaluar si el ticket está en un estado finalizado (PREMIADO, NO PREMIADO, CANCELADO, PAGADO)
            if (estado === 'premiado' || estado === 'ganador') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">PREMIADO</span>`;
                textoPremio = `<span class="text-emerald-400 font-mono font-bold text-sm">$${montoPremio}</span>`;
                motivoBloqueo = 'Escrutado';
            } else if (estado === 'no_premiado' || estado === 'perdedor') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-400">NO PREMIADO</span>`;
                motivoBloqueo = 'Escrutado';
            } else if (estado === 'cancelado' || estado === 'anulado') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">CANCELADO</span>`;
                motivoBloqueo = 'Anulado';
            } else if (estado === 'pendiente' || estado === 'activo' || estado === 'en_juego') {
                // 2. Si el ticket sigue pendiente/activo, validar el estado del sorteo correspondiente
                let sorteoCerrado = false;
                const sorteoAsociado = sorteosCache.find(s => String(s.id) === String(t.sorteo_id));

                if (sorteoAsociado) {
                    const estatusSorteo = String(sorteoAsociado.estatus || sorteoAsociado.estado || 'activo').toLowerCase();
                    if (['cerrado', 'finalizado', 'escrutado', 'realizado'].includes(estatusSorteo)) {
                        sorteoCerrado = true;
                    }

                    const horaCierreStr = sorteoAsociado.hora_cierre || sorteoAsociado.horario_cierre;
                    if (horaCierreStr) {
                        const [h, m] = horaCierreStr.split(':');
                        const fechaCierre = new Date();
                        fechaCierre.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                        if (ahora >= fechaCierre) {
                            sorteoCerrado = true;
                        }
                    }
                }

                if (sorteoCerrado) {
                    estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">EN JUEGO (SORTEO CERRADO)</span>`;
                    puedeAnular = false;
                    motivoBloqueo = 'Sorteo Cerrado';
                } else {
                    puedeAnular = true;
                }
            }

            // Generar HTML del botón o indicador de bloqueo
            const botonAnulacionHTML = puedeAnular 
                ? `<button onclick="eliminarTicketHistorial('${t.id}')" title="Anular Ticket"
                           class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs flex items-center gap-1">
                       <i class="fa-solid fa-ban"></i> Anular
                   </button>` 
                : `<span class="text-slate-500 text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700" title="No se puede cancelar">${motivoBloqueo}</span>`;

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-cyan-400">${codigo}</td>
                <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
                <td class="p-3 text-slate-200 font-semibold">${nombreBanca}</td>
                <td class="p-3 text-slate-300 font-mono">${jugadasTexto}</td>
                <td class="p-3 font-mono font-bold text-white">$${montoVenta}</td>
                <td class="p-3 font-mono">${textoPremio}</td>
                <td class="p-3">${estadoBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="verTicketDetalle('${t.id}')" title="Ver Ticket"
                                class="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2 py-1 rounded transition-colors text-xs flex items-center gap-1">
                            <i class="fa-solid fa-eye"></i> Ver
                        </button>
                        ${botonAnulacionHTML}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error al cargar historial de tickets:", err.message);
    }
}

window.cargarHistorialTickets = cargarHistorialTickets;
window.cargarVentas = cargarHistorialTickets;

// ==========================================================
// ANULACIÓN / ELIMINACIÓN DE TICKETS EN DASHBOARD (CORREGIDA)
// ==========================================================
window.eliminarTicketHistorial = async function(ticketId) {
    if (!ticketId) return;
    if (!confirm('¿Está seguro de que desea anular/cancelar este ticket?')) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) throw new Error("Cliente de Supabase no disponible.");

        const { data, error } = await supabase.rpc('cancelar_ticket_universal', { 
            p_referencia: String(ticketId).trim() 
        });

        if (error) throw error;

        if (data && data.success) {
            alert('✅ ' + data.message);

            if (typeof cargarHistorialTickets === 'function') await cargarHistorialTickets();
            if (typeof cargarMetricasSeguras === 'function') await cargarMetricasSeguras();
            if (typeof cargarResumenOperacionesHoy === 'function') await cargarResumenOperacionesHoy();
        } else {
            alert('⚠️ ' + (data?.message || 'No se completó la anulación.'));
        }
    } catch (err) {
        console.error("Error en eliminarTicketHistorial:", err);
        alert('❌ Error al anular el ticket: ' + err.message);
    }
};

// Navegación de secciones
function cambiarSeccion(seccionId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    
    const seccionTarget = document.getElementById(seccionId);
    if (seccionTarget) {
        seccionTarget.classList.remove('hidden');
    }

    if (seccionId === 'section-results') {
        console.log("🔄 Cargando sección Resultados & Escrutinio...");
        if (typeof window.cargarSorteosEscrutinio === 'function') {
            window.cargarSorteosEscrutinio();
        }
        if (typeof window.cargarHistorialResultados === 'function') {
            window.cargarHistorialResultados();
        }
    }
}

// ==========================================================
// RESUMEN DE OPERACIONES Y MÉTRICAS HOY CON GRÁFICOS
// ==========================================================

// 1. Declaración global/auxiliar segura para actualizar texto en el DOM
if (typeof window.actualizarTexto !== 'function') {
    window.actualizarTexto = function(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };
}
const actualizarTexto = window.actualizarTexto;

// 2. Función Principal: Cargar Resumen de Operaciones
async function cargarResumenOperacionesHoy() {
    try {
        const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (!supabase) return;

        // Rango de fecha de hoy (00:00:00 - 23:59:59)
        const hoy = new Date();
        const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

        // Consultar tickets de hoy
        const { data: ticketsHoy, error: errTickets } = await supabase
            .from('tickets')
            .select('*')
            .gte('created_at', inicioDia.toISOString())
            .lte('created_at', finDia.toISOString());

        if (errTickets) {
            console.error("Error consultando tickets de hoy:", errTickets.message);
            return;
        }

        const ticketsRaw = ticketsHoy || [];

        // Excluir tickets cancelados o anulados
        const tickets = ticketsRaw.filter(t => {
            const est = String(t.estatus || t.status || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        const totalTickets = tickets.length;

        // Cálculos Financieros
        let ventaTotal = 0;
        let comisionesTotal = 0;
        let premiosTotal = 0;
        let totalGanadores = 0;

        tickets.forEach(t => {
            const monto = parseFloat(t.total || t.monto || t.monto_total || 0);
            
            let pctComision = 10;
            if (t.comision_porcentaje) pctComision = parseFloat(t.comision_porcentaje);

            const comision = t.comision_monto 
                ? parseFloat(t.comision_monto) 
                : parseFloat(t.comision || (monto * (pctComision / 100)));
            
            ventaTotal += monto;
            comisionesTotal += comision;

            let premioVal = parseFloat(t.premio || t.monto_premio || t.total_premio || t.monto_ganado || 0);

            const detallesJugadas = t.jugadas || t.detalles || t.apuestas || [];
            if (Array.isArray(detallesJugadas)) {
                detallesJugadas.forEach(j => {
                    const premioJugada = parseFloat(j.premio || j.monto_premio || j.monto_ganado || 0);
                    if (premioJugada > 0 && premioVal === 0) {
                        premioVal += premioJugada;
                    }
                });
            }

            const est = String(t.estatus || t.status || t.estado || '').toLowerCase();
            const esGanador = est === 'premiado' || est === 'ganador' || est === 'pagado' || est.includes('pale') || premioVal > 0;

            if (esGanador && premioVal > 0) {
                premiosTotal += premioVal;
                totalGanadores++;
            }
        });

        const gananciaNeta = ventaTotal - comisionesTotal - premiosTotal;

        // Inyectar datos en el DOM (Compatibilidad con múltiples IDs de plantillas)
        const totalVentasFmt = `$${ventaTotal.toFixed(2)}`;
        const totalComisionesFmt = `$${comisionesTotal.toFixed(2)}`;
        const totalPremiosFmt = `$${premiosTotal.toFixed(2)}`;

        const idsVentas = ['ventasTotales', 'kpi-total-sales', 'montoVentasHoy', 'totalVentasHoy', 'resumen-ventas', 'total_ventas'];
        idsVentas.forEach(id => actualizarTexto(id, totalVentasFmt));

        actualizarTexto('kpi-tickets-count', totalTickets);
        actualizarTexto('totalTicketsHoy', totalTickets.toString());
        actualizarTexto('cantTicketsHoy', totalTickets.toString());

        actualizarTexto('kpi-total-commissions', totalComisionesFmt);
        actualizarTexto('totalComisionHoy', totalComisionesFmt);

        actualizarTexto('kpi-total-prizes', totalPremiosFmt);
        actualizarTexto('totalPremiosHoy', totalPremiosFmt);
        actualizarTexto('kpi-winners-count', totalGanadores);

        const elemGanancia = document.getElementById('kpi-net-profit') || document.getElementById('gananciaNetaHoy') || document.getElementById('gananciaNeta');
        if (elemGanancia) {
            elemGanancia.textContent = `$${gananciaNeta.toFixed(2)}`;
            elemGanancia.className = `text-2xl font-black mt-2 ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
        }

        console.log(`✅ Resumen y ventas actualizadas automáticamente: ${totalVentasFmt} en ${totalTickets} tickets.`);

        // Cargar caché de bancas si está disponible y no se ha cargado aún
        if (typeof window.cargarBancas === 'function' && (!window._bancasCache || window._bancasCache.length === 0)) {
            try { await window.cargarBancas(); } catch (e) { console.warn("Aviso pre-cargando bancas:", e); }
        }

        // Llamada segura a renderizar gráficos
        renderizarGraficosCompletos(tickets);

        // Cargar grilla de sorteos en vivo si existe la función
        if (typeof window.cargarGridSorteosEnVivo === 'function') {
            await window.cargarGridSorteosEnVivo();
        } else if (typeof cargarGridSorteosEnVivo === 'function') {
            await cargarGridSorteosEnVivo();
        }

    } catch (err) {
        console.error("Error al cargar resumen de operaciones:", err);
    }
}
window.cargarResumenOperacionesHoy = cargarResumenOperacionesHoy;

// ==========================================================
// RENDERING DE GRÁFICOS (VENTAS POR BANCA Y BALANCE POR SORTEO)
// ==========================================================
function renderizarGraficosCompletos(tickets = []) {
    if (typeof Chart === 'undefined') {
        console.warn("⚠️ Chart.js no está cargado en la página.");
        return;
    }

    renderizarGraficoVendedores(tickets);
    renderizarGraficoSorteos(tickets);
}
window.renderizarGraficosCompletos = renderizarGraficosCompletos;

// 1. Gráfico de Ventas por Banca / Vendedor
function renderizarGraficoVendedores(tickets = []) {
    const canvas = document.getElementById('chart-ventas-vendedor') || document.getElementById('chartVentasBanca');
    if (!canvas) return;

    const bancasMap = {};
    const bancasCache = window._bancasCache || [];

    tickets.forEach(t => {
        let nombre = t.banca_nombre || t.vendedor_nombre || t.banca || t.vendedor || '';

        if (!nombre && (t.banca_id !== undefined && t.banca_id !== null || t.usuario_id !== undefined && t.usuario_id !== null)) {
            const bId = String(t.banca_id ?? t.usuario_id);
            const encontrada = bancasCache.find(b => String(b.id) === bId);
            if (encontrada) {
                nombre = encontrada.nombre_banca || encontrada.vendedor_nombre || encontrada.nombre || encontrada.username || '';
            }
        }

        if (!nombre || nombre === '0' || nombre === 0 || String(nombre).trim() === '') {
            nombre = 'Banca General';
        }

        const monto = parseFloat(t.total || t.monto || t.monto_total || t.monto_venta || 0);
        bancasMap[nombre] = (bancasMap[nombre] || 0) + monto;
    });

    const labels = Object.keys(bancasMap);
    const data = Object.values(bancasMap);

    if (window.chartVendedoresInstance) {
        window.chartVendedoresInstance.destroy();
        window.chartVendedoresInstance = null;
    }

    const ctx = canvas.getContext('2d');
    window.chartVendedoresInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sin Datos'],
            datasets: [{
                label: 'Ventas ($)',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Venta Total: $${Number(ctx.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' }, 
                    grid: { color: 'rgba(51, 65, 85, 0.3)' } 
                },
                x: { 
                    ticks: { color: '#94a3b8' }, 
                    grid: { display: false } 
                }
            }
        }
    });
}
window.renderizarGraficoVendedores = renderizarGraficoVendedores;

// 2. Gráfico de Distribución y Ganancia/Pérdida por Sorteo
function renderizarGraficoSorteos(tickets = []) {
    const canvas = document.getElementById('chart-distribucion-sorteo') || document.getElementById('chartDistribucionSorteo');
    if (!canvas) return;

    const sorteosMap = {};

    tickets.forEach(t => {
        const nombreSorteo = t.sorteo_nombre || t.sorteo || t.nombre_sorteo || 'Sorteo General';
        const montoVenta = parseFloat(t.total || t.monto || t.monto_total || 0);
        
        let montoPremio = parseFloat(t.premio || t.monto_premio || t.total_premio || 0);
        const est = String(t.estatus || t.estado || '').toLowerCase();
        
        if (est === 'premiado' || est === 'ganador' || est === 'pagado') {
            if (montoPremio === 0 && Array.isArray(t.jugadas || t.detalles)) {
                (t.jugadas || t.detalles).forEach(j => {
                    montoPremio += parseFloat(j.premio || j.monto_premio || 0);
                });
            }
        } else {
            montoPremio = 0;
        }

        if (!sorteosMap[nombreSorteo]) {
            sorteosMap[nombreSorteo] = { venta: 0, premios: 0, balance: 0 };
        }

        sorteosMap[nombreSorteo].venta += montoVenta;
        sorteosMap[nombreSorteo].premios += montoPremio;
        sorteosMap[nombreSorteo].balance = sorteosMap[nombreSorteo].venta - sorteosMap[nombreSorteo].premios;
    });

    const labels = Object.keys(sorteosMap);
    const dataVentas = labels.map(l => sorteosMap[l].venta);

    if (window.chartSorteosInstance) {
        window.chartSorteosInstance.destroy();
        window.chartSorteosInstance = null;
    }

    const ctx = canvas.getContext('2d');
    window.chartSorteosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sin Datos'],
            datasets: [{
                data: dataVentas.length ? dataVentas : [1],
                backgroundColor: [
                    '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'
                ],
                borderWidth: 2,
                borderColor: '#0f172a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.label || '';
                            const info = sorteosMap[label];
                            if (!info) return `${label}: $${ctx.raw}`;
                            const estadoStr = info.balance >= 0 ? 'GANANCIA' : 'PÉRDIDA';
                            return [
                                `${label}`,
                                `• Venta Total: $${info.venta.toFixed(2)}`,
                                `• Premios Pagados: $${info.premios.toFixed(2)}`,
                                `• Balance (${estadoStr}): $${info.balance.toFixed(2)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}
window.renderizarGraficoSorteos = renderizarGraficoSorteos;

// ==========================================================
// EVALUACIÓN DINÁMICA DE ESTATUS (HORA DE PANAMÁ)
// ==========================================================
export function evaluarEstatusDinamicoSorteo(sorteo) {
    if (!sorteo) return { texto: 'CERRADO', esActivo: false, claseBadge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' };

    const estatusDB = String(sorteo.estatus || sorteo.estado || 'ACTIVO').toUpperCase().trim();
    if (['PAUSADO', 'INACTIVO', 'PAUSA', 'DESACTIVADO'].includes(estatusDB)) {
        return { 
            texto: 'PAUSADO', 
            esActivo: false, 
            claseBadge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
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
    const horaCierre = normHora(sorteo.hora_cierre || sorteo.horario_cierre || sorteo.hora, '23:59:00');

    if (ahoraPanama < horaApertura || ahoraPanama >= horaCierre) {
        return { 
            texto: 'CERRADO', 
            esActivo: false, 
            claseBadge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
        };
    }

    return { 
        texto: 'ACTIVO', 
        esActivo: true, 
        claseBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
    };
}
window.evaluarEstatusDinamicoSorteo = evaluarEstatusDinamicoSorteo;

// Grilla dinámica de sorteos en vivo
async function cargarGridSorteosEnVivo() {
    try {
        const supabase = window.getSupabaseClient();
        const grid = document.getElementById('dashboard-draws-grid');
        if (!supabase || !grid) return;

        const { data: sorteos, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('id', { ascending: true });

        if (error || !sorteos || sorteos.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-4 text-xs">No hay sorteos registrados hoy.</div>`;
            return;
        }

        grid.innerHTML = '';

        sorteos.forEach(sorteo => {
            const nombre = sorteo.nombre || sorteo.descripcion || `Sorteo #${sorteo.id}`;
            const hora = sorteo.hora_cierre || sorteo.horario_cierre || sorteo.hora || '23:59';
            const estatusInfo = evaluarEstatusDinamicoSorteo(sorteo);

            const card = document.createElement('div');
            card.className = "bg-slate-900/60 border border-slate-700/60 p-3.5 rounded-xl flex flex-col justify-between space-y-3";

            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-white text-xs truncate">${nombre}</span>
                    <span id="badge-sorteo-${sorteo.id}" class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${estatusInfo.claseBadge}">${estatusInfo.texto}</span>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-400">
                    <span>Cierre: <strong class="text-slate-200">${hora}</strong></span>
                    <span id="timer-sorteo-${sorteo.id}" class="font-mono font-bold text-amber-400">00:00:00</span>
                </div>
            `;
            grid.appendChild(card);
        });

        window._sorteosSilenciados = window._sorteosSilenciados || new Set();

        if (window.intervaloCuentaRegresivaGrid) clearInterval(window.intervaloCuentaRegresivaGrid);

        window.intervaloCuentaRegresivaGrid = setInterval(() => {
            const ahora = new Date();
            let alertaActiva = false;
            window._sorteosEnAlertaActual = []; 

            sorteos.forEach(sorteo => {
                const timerElem = document.getElementById(`timer-sorteo-${sorteo.id}`);
                const badgeElem = document.getElementById(`badge-sorteo-${sorteo.id}`);

                const estatusInfo = evaluarEstatusDinamicoSorteo(sorteo);

                if (badgeElem) {
                    badgeElem.textContent = estatusInfo.texto;
                    badgeElem.className = `text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${estatusInfo.claseBadge}`;
                }

                if (!timerElem) return;

                if (!estatusInfo.esActivo) {
                    timerElem.textContent = estatusInfo.texto;
                    timerElem.className = estatusInfo.texto === 'PAUSADO' 
                        ? "font-mono font-bold text-amber-400" 
                        : "font-mono font-bold text-rose-400";
                    return;
                }

                const horaStr = sorteo.hora_cierre || sorteo.horario_cierre || sorteo.hora || '23:59:00';
                const [h, m, s] = horaStr.split(':');
                const fechaCierre = new Date();
                fechaCierre.setHours(parseInt(h || '23', 10), parseInt(m || '59', 10), parseInt(s || '0', 10), 0);

                const diff = fechaCierre - ahora;

                if (diff <= 0) {
                    timerElem.textContent = "00:00:00";
                    timerElem.className = "font-mono font-bold text-rose-500";
                } else {
                    const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
                    const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                    const segs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');

                    timerElem.textContent = `${hrs}:${mins}:${segs}`;
                    timerElem.className = "font-mono font-bold text-amber-400";

                    if (diff < 900000) { 
                        if (!window._sorteosSilenciados.has(sorteo.id)) {
                            alertaActiva = true;
                            window._sorteosEnAlertaActual.push(sorteo.id); 
                        }
                    }
                }
            });

            const globalAlert = document.getElementById('global-closing-alert');
            if (globalAlert) {
                if (alertaActiva) {
                    globalAlert.classList.remove('hidden');
                } else {
                    globalAlert.classList.add('hidden');
                }
            }
        }, 1000);

    } catch (e) {
        console.warn("Error construyendo grilla de sorteos:", e);
    }
}

window.dismissClosingAlert = function() {
    if (window._sorteosEnAlertaActual && window._sorteosEnAlertaActual.length > 0) {
        window._sorteosEnAlertaActual.forEach(id => {
            window._sorteosSilenciados.add(id);
        });
    }
    
    const el = document.getElementById('global-closing-alert');
    if (el) el.classList.add('hidden');
};

// ==========================================================
// SUSCRIPCIÓN TIEMPO REAL (REALTIME)
// ==========================================================
async function suscribirEventosTiempoReal() {
    const supabase = window.getSupabaseClient();
    if (!supabase || typeof supabase.channel !== 'function') return;

    if (window.realtimeChannel) {
        await supabase.removeChannel(window.realtimeChannel);
    }

    window.realtimeChannel = supabase
        .channel('schema-db-changes-global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
            console.log('⚡ Actualizando automáticamente por cambio en tickets...');
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
            if (typeof window.cargarHistorialTickets === 'function') {
                window.cargarHistorialTickets();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resultados' }, () => {
            console.log('⚡ Actualizando automáticamente por nuevo resultado ingresado...');
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
            if (typeof window.cargarHistorialTickets === 'function') {
                window.cargarHistorialTickets();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadas' }, () => {
            console.log('⚡ Actualizando automáticamente por cambio en jugadas...');
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteos' }, () => {
            console.log('⚡ Actualizando automáticamente por cambio en sorteos...');
            cargarResumenOperacionesHoy();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime conectado exitosamente en todas las tablas.');
            }
        });
}

// Exposición global
window.cargarResumenOperacionesHoy = cargarResumenOperacionesHoy;
window.actualizarResumenOperaciones = cargarResumenOperacionesHoy;
window.actualizarResumenDashboard = function() {
    cargarMetricasSeguras();
    cargarResumenOperacionesHoy();
};
window.cargarGridSorteosEnVivo = cargarGridSorteosEnVivo;
window.suscribirEventosTiempoReal = suscribirEventosTiempoReal;

// ==========================================================
// INICIALIZACIÓN DE EVENTOS AL CARGAR LA PÁGINA
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    initDashboardModule();

    // Botón manual de refresco
    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            if (typeof cargarResumenOperacionesHoy === 'function') cargarResumenOperacionesHoy();
            if (typeof cargarMetricasSeguras === 'function') cargarMetricasSeguras();
        });
    }

    // Botones de cerrar sesión vinculados a la función de la app
    const botonesCerrarSesion = document.querySelectorAll('#btn-logout, .btn-logout, [data-action="logout"], #btn-cerrar-sesion');
    botonesCerrarSesion.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof cerrarSesionAdmin === 'function') cerrarSesionAdmin();
        });
    });

    // Navegación por pestañas
    const navLinks = document.querySelectorAll('[data-section], nav button, .nav-link, a[href*="section"]');
    navLinks.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = btn.getAttribute('data-section');
            if (target && typeof cambiarSeccion === 'function') cambiarSeccion(target);

            setTimeout(() => {
                if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
                if (typeof window.cargarMetricasSeguras === 'function') window.cargarMetricasSeguras();
                if (typeof window.cargarResumenOperacionesHoy === 'function') window.cargarResumenOperacionesHoy();
            }, 100);
        });
    });

    // Vinculación del botón Guardar Perfil de Administrador Central
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil-admin') || document.getElementById('btn-save-admin');
    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof guardarPerfilAdmin === 'function') guardarPerfilAdmin();
        });
    }

    // Suscribir a tiempo real
    if (typeof suscribirEventosTiempoReal === 'function') {
        suscribirEventosTiempoReal();
    }
});
window.initPerfilAdmin = initPerfilAdmin;
window.guardarPerfilAdmin = guardarPerfilAdmin;