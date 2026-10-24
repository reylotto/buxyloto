// --- MÓDULO DASHBOARD Y MÉTRICAS ACTUALIZADO (LIMPIO DE INTERFERENCIAS) ---

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
    // NOTA: Se eliminaron las llamadas viejas a bancas para evitar conflictos con admin.js
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

        if (inputs[2]) inputs[2].value = '';
        if (inputs[3]) inputs[3].value = '';

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
// 3. MÉTRICAS DEL DASHBOARD (EXCLUYENDO CANCELADOS Y FILTRADO SEGURO)
// ==========================================================
async function cargarMetricasSeguras() {
    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        // 1. SELECT CORREGIDO: Sin columnas inexistentes para evitar Error 400
        const { data: ticketsData, error } = await supabase
            .from('tickets')
            .select('monto, monto_total, total, premio, monto_premio, estatus, estado, banca_id, usuario_id');

        if (error) return;

        // 2. OBTENER BANCAS PARA FILTRAR POR ZONA LOCALMENTE
        if (!window._bancasCache || window._bancasCache.length === 0) {
            const { data: bData } = await supabase.from('bancas').select('*');
            window._bancasCache = bData || [];
        }
        const bancasCache = window._bancasCache || [];

        // 3. FILTRO DE SUPERVISOR (Cajeros ya están bloqueados por URL)
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        
        let listaTickets = ticketsData || [];

        // Filtro corregido para Historial y Resumen:
        if (rol.includes('supervisor')) {
            const bancasCache = window._bancasCache || [];
            const idsBancasZona = bancasCache.filter(b => b.zona === sesion.zona).map(b => String(b.id));
            // 👇 AQUÍ ESTÁ LA CORRECCIÓN: "tickets" ahora es "listaTickets" 👇
            listaTickets = listaTickets.filter(t => idsBancasZona.includes(String(t.banca_id || t.usuario_id)));
        }

        const listaTicketsValidos = listaTickets.filter(t => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        const totalVendido = listaTicketsValidos.reduce((acc, t) => acc + Number(t.monto_total || t.monto || t.total || 0), 0);
        const totalPremios = listaTicketsValidos.reduce((acc, t) => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            if (est === 'premiado' || est === 'ganador') return acc + Number(t.premio || t.monto_premio || 0);
            return acc;
        }, 0);

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

// ==========================================================
// CARGAR HISTORIAL DE TICKETS (FILTRADO SEGURO POR ZONA)
// ==========================================================
async function cargarHistorialTickets() {
    const tbody = document.getElementById('tickets-table-body') || document.getElementById('tabla-historial-tickets') || document.getElementById('historial-tickets-body');
    if (!tbody) return;

    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        const hoy = new Date();
        const fechaHoyStr = hoy.toISOString().split('T')[0];

        const { data: sorteosData } = await supabase.from('sorteos').select('*');
        const sorteosCache = sorteosData || [];

        // 1. DESCARGAMOS LOS TICKETS DE HOY
        const { data: ticketsData, error } = await supabase
            .from('tickets')
            .select('*')
            .gte('created_at', `${fechaHoyStr}T00:00:00.000Z`)
            .lte('created_at', `${fechaHoyStr}T23:59:59.999Z`)
            .order('id', { ascending: false });

        if (error) throw error;
        let tickets = ticketsData || [];

        // 🚨 FILTRO MATEMÁTICO ABSOLUTO DE SUPERVISOR
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();

        if (rol.includes('supervisor')) {
            const zonaSup = String(sesion.zona || '').trim().toLowerCase();
            
            // Forzamos la consulta a la base de datos (sin usar caché)
            const { data: bData } = await supabase.from('bancas').select('id, zona');
            const idsPermitidos = (bData || [])
                .filter(b => String(b.zona || '').trim().toLowerCase() === zonaSup)
                .map(b => String(b.id));

            tickets = tickets.filter(t => idsPermitidos.includes(String(t.banca_id || t.usuario_id)));
        }

        tbody.innerHTML = '';
        // ... (A partir de aquí continúa el código normal para dibujar la tabla `tickets.forEach(t => ...`)

        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados.</td></tr>';
            return;
        }

        const bancasCache = window._bancasCache || [];
        
        // 3. DIBUJAMOS LA TABLA
        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            const codigo = t.codigo || t.codigo_ticket || `BX-${t.id}`;
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            
            let nombreBanca = t.banca_nombre || t.vendedor_nombre || t.banca || t.vendedor || '';
            if (!nombreBanca && (t.banca_id || t.usuario_id)) {
                const bId = String(t.banca_id || t.usuario_id);
                const encontrada = bancasCache.find(b => String(b.id) === bId);
                if (encontrada) nombreBanca = encontrada.nombre_banca || encontrada.vendedor_nombre || encontrada.username;
            }
            if (!nombreBanca) nombreBanca = 'Banca General';

            const montoVenta = Number(t.monto_total || t.monto || t.total || 0).toFixed(2);
            const montoPremio = Number(t.premio || t.monto_premio || 0).toFixed(2);
            const estado = String(t.estatus || t.estado || 'pendiente').toLowerCase();

            let jugadasTexto = '1 ap.';
            if (Array.isArray(t.jugadas || t.detalles)) {
                jugadasTexto = `${(t.jugadas || t.detalles).length} ap.`;
            }

            let estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">PENDIENTE</span>`;
            if (estado === 'premiado' || estado === 'ganador') estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">PREMIADO</span>`;
            if (estado === 'cancelado' || estado === 'anulado') estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">CANCELADO</span>`;

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-cyan-400">${codigo}</td>
                <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
                <td class="p-3 text-slate-200 font-semibold">${nombreBanca}</td>
                <td class="p-3 text-slate-300 font-mono text-center">${jugadasTexto}</td>
                <td class="p-3 font-mono font-bold text-white text-right">$${montoVenta}</td>
                <td class="p-3 font-mono text-emerald-400 font-bold text-right">$${montoPremio}</td>
                <td class="p-3 text-center">${estadoBadge}</td>
                <td class="p-3 text-center">
                    <button class="bg-cyan-600/20 text-cyan-400 px-2 py-1 rounded text-xs"><i class="fa-solid fa-eye"></i></button>
                    <button class="admin-only bg-rose-600/20 text-rose-400 px-2 py-1 rounded text-xs ml-1"><i class="fa-solid fa-ban"></i></button>
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
// ANULACIÓN / ELIMINACIÓN DE TICKETS
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
        if (typeof window.cargarSorteosEscrutinio === 'function') {
            window.cargarSorteosEscrutinio();
        }
        if (typeof window.cargarHistorialResultados === 'function') {
            window.cargarHistorialResultados();
        }
    }
}

// ==========================================================
// RESUMEN DE OPERACIONES Y COMISIÓN DINÁMICA DE LA BANCA
// ==========================================================
if (typeof window.actualizarTexto !== 'function') {
    window.actualizarTexto = function(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };
}
const actualizarTexto = window.actualizarTexto;

async function cargarResumenOperacionesHoy() {
    try {
        const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (!supabase) return;

        const hoy = new Date();
        const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

        // 🔥 1. FILTRO INYECTADO PARA LOS TICKETS
        let queryTickets = supabase.from('tickets').select('*').gte('created_at', startOfDay).lte('created_at', endOfDay);
        
        // 🔥 ESCUDO MULTI-TENANT: MÉTRICAS DEL DASHBOARD
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
            queryTickets = queryTickets.eq('inquilino_id', inquilinoId);
        }

        const { data: ticketsHoy, error } = await queryTickets;

        if (errTickets) return;

        // --- 🚨 INICIO DE FILTRO DE SEGURIDAD POR ROL 🚨 ---
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        const zonaUsuario = sesion.zona;
        const nombreUsuario = sesion.nombre || sesion.nombre_banca || sesion.username;

        let ticketsRaw = ticketsHoy || [];

        // 👇 AQUÍ ESTÁ EL "FILTRO FANTASMA" REPARADO CON IDS 👇
        if (rol.includes('supervisor')) {
            const bancasCache = window._bancasCache || [];
            const idsBancasZona = bancasCache.filter(b => b.zona === zonaUsuario).map(b => String(b.id));
            ticketsRaw = ticketsRaw.filter(t => idsBancasZona.includes(String(t.banca_id || t.usuario_id)));
        } else if (!rol.includes('admin')) {
            ticketsRaw = ticketsRaw.filter(t => 
                t.creador === nombreUsuario || 
                t.banca === nombreUsuario || 
                t.vendedor_nombre === nombreUsuario || 
                t.banca_nombre === nombreUsuario
            );
        }
        // --- FIN DE FILTRO DE SEGURIDAD ---

        const tickets = ticketsRaw.filter(t => {
            const est = String(t.estatus || t.status || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        // ----------------------------------------------------------------------
        // 🚨 SOLUCIÓN: DESCARGAR LAS BANCAS ANTES DE HACER LA MATEMÁTICA
        // ----------------------------------------------------------------------
        if (typeof window.cargarBancasSistema === 'function' && (!window._bancasCache || window._bancasCache.length === 0)) {
            try { await window.cargarBancasSistema(); } catch (e) { console.warn("Aviso pre-cargando bancas:", e); }
        }
        
        let bancasCache = window._bancasCache || [];
        if (bancasCache.length === 0) {
            // 🔥 2. FILTRO INYECTADO PARA LAS BANCAS
            let queryBancas = supabase.from('bancas').select('*');
            if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
                queryBancas = queryBancas.eq('inquilino_id', inquilinoId);
            }
            const { data: bancasDirectas } = await queryBancas;
            
            bancasCache = bancasDirectas || [];
            window._bancasCache = bancasCache; 
        }
        // ----------------------------------------------------------------------

        const totalTickets = tickets.length;
        let ventaTotal = 0;
        let comisionesTotal = 0;
        let premiosTotal = 0;
        let totalGanadores = 0;

        tickets.forEach(t => {
            const monto = parseFloat(t.total || t.monto || t.monto_total || 0);
            
           // --------------------------------------------------------
            // LECTURA DINÁMICA ESTRICTA (LA BANCA MANDA)
            // --------------------------------------------------------
            let pctComision = 0; // Iniciamos en 0
            
            const bancaIdStr = String(t.banca_id || t.usuario_id || '');
            const bancaAsociada = bancasCache.find(b => String(b.id) === bancaIdStr);
            
            if (bancaAsociada && bancaAsociada.comision !== undefined && bancaAsociada.comision !== null) {
                // PRIORIDAD 1: Siempre usar el porcentaje actual de la Banca (ignora el del ticket)
                pctComision = parseFloat(bancaAsociada.comision);
            } else if (t.comision_porcentaje !== undefined && t.comision_porcentaje !== null) {
                // PRIORIDAD 2: Solo si la banca fue borrada, confía en el ticket
                pctComision = parseFloat(t.comision_porcentaje);
            } else {
                 // PRIORIDAD 3: Rescate extremo
                 pctComision = 10; 
            }

            // FORZAR MATEMÁTICA ESTRICTA: Ignorar montos viejos de Supabase
            const comision = parseFloat(monto * (pctComision / 100));
            
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

        // (El resto del código hacia abajo sigue igual, calculando la ganancia neta y actualizando el DOM)

        const gananciaNeta = ventaTotal - comisionesTotal - premiosTotal;
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

        renderizarGraficosCompletos(tickets);

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
// RENDERING DE GRÁFICOS Y MINICUADROS (ACTUALIZADO)
// ==========================================================
function renderizarGraficosCompletos(tickets = []) {
    if (typeof Chart === 'undefined') return;
    renderizarGraficoVendedores(tickets);
    renderizarGraficoSorteosBarras(tickets);
    renderizarMinicuadrosNumeros(tickets);
}
window.renderizarGraficosCompletos = renderizarGraficosCompletos;

function renderizarGraficoVendedores(tickets = []) {
    // Soporte ampliado de IDs para que no se pierda la gráfica original
    const canvas = document.getElementById('chart-ventas-vendedor') || document.getElementById('chartVentasBanca') || document.getElementById('chart-sales-by-banca');
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
        if (!nombre || nombre === '0' || nombre === 0 || String(nombre).trim() === '') nombre = 'Banca General';
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
                tooltip: { callbacks: { label: (ctx) => `Venta Total: $${Number(ctx.raw).toFixed(2)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });
}
window.renderizarGraficoVendedores = renderizarGraficoVendedores;

function renderizarGraficoSorteosBarras(tickets = []) {
    const canvas = document.getElementById('chart-sorteos-barras');
    if (!canvas) return;

    const sorteosMap = {};

    // Usando tu misma lógica de extracción de datos, pero adaptada para dos barras
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
            sorteosMap[nombreSorteo] = { venta: 0, premios: 0 };
        }

        sorteosMap[nombreSorteo].venta += montoVenta;
        sorteosMap[nombreSorteo].premios += montoPremio;
    });

    const labels = Object.keys(sorteosMap);
    const dataVentas = labels.map(l => sorteosMap[l].venta);
    const dataPremios = labels.map(l => sorteosMap[l].premios);

    if (window.chartSorteosInstance) {
        window.chartSorteosInstance.destroy();
        window.chartSorteosInstance = null;
    }

    const ctx = canvas.getContext('2d');
    window.chartSorteosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sin Datos'],
            datasets: [
                {
                    label: 'VENTA',
                    data: dataVentas.length ? dataVentas : [0],
                    backgroundColor: 'rgba(16, 185, 129, 0.8)', // Verde
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'PREMIOS',
                    data: dataPremios.length ? dataPremios : [0],
                    backgroundColor: 'rgba(244, 63, 94, 0.8)', // Rojo
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'top', 
                    align: 'end',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10, family: 'monospace' } } 
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` $${Number(ctx.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                y: { ticks: { color: '#94a3b8', font: {size: 10} }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
                x: { ticks: { color: '#cbd5e1', font: { size: 9, weight: 'bold' } }, grid: { display: false } }
            }
        }
    });
}
window.renderizarGraficoSorteosBarras = renderizarGraficoSorteosBarras;

function renderizarMinicuadrosNumeros(tickets = []) {
    const bodyNumeros = document.getElementById('dash-top-numeros');
    const bodyLimites = document.getElementById('dash-top-limites');
    if (!bodyNumeros || !bodyLimites) return;

    const conteoGlobal = {};

    tickets.forEach(t => {
        let jugadas = t.jugadas || t.detalles || [];
        if (typeof jugadas === 'string') {
            try { jugadas = JSON.parse(jugadas); } catch (e) { jugadas = []; }
        }
        
        jugadas.forEach(j => {
            if (String(t.estatus || t.estado).toLowerCase() === 'cancelado') return;
            let num = String(j.numero || '').trim();
            const tipo = String(j.tipo || 'chance').toLowerCase();
            const sorteo = String(t.sorteo_nombre || t.sorteo || t.nombre_sorteo || 'Sorteo').toUpperCase().substring(0, 5); 
            const monto = parseFloat(j.monto || j.monto_jugado || j.valor || 0);

            if (tipo === 'pale' && num.length === 4) num = [num.substring(0, 2), num.substring(2, 4)].sort().join('');
            if (!num) return;

            const claveNum = num; 
            const claveLim = `${sorteo}_${num}`;

            if (!conteoGlobal[claveNum]) conteoGlobal[claveNum] = { numero: num, monto: 0, cant: 0 };
            conteoGlobal[claveNum].monto += monto;
            conteoGlobal[claveNum].cant += 1;

            if (!conteoGlobal[claveLim]) conteoGlobal[claveLim] = { sorteo: sorteo, numero: num, monto: 0 };
            conteoGlobal[claveLim].monto += monto;
        });
    });

    const topNumeros = Object.values(conteoGlobal)
        .filter(x => x.cant > 0)
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5);

    bodyNumeros.innerHTML = topNumeros.length ? topNumeros.map(n => `
        <tr>
            <td class="py-1.5 text-slate-400 w-8">${n.cant}</td>
            <td class="py-1.5 font-bold text-white tracking-widest">${n.numero}</td>
            <td class="py-1.5 text-right font-semibold text-cyan-400">$${n.monto.toFixed(2)}</td>
        </tr>
    `).join('') : '<tr><td colspan="3" class="text-center text-slate-500 py-3">Sin datos hoy</td></tr>';

    const topeDashboard = 20.00;
    const topLimites = Object.values(conteoGlobal)
        .filter(x => x.sorteo)
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5);
    
    bodyLimites.innerHTML = topLimites.length ? topLimites.map(n => {
        const pct = Math.min(Math.round((n.monto / topeDashboard) * 100), 100);
        let colorText = 'text-emerald-400';
        if (pct >= 90) colorText = 'text-rose-400';
        else if (pct >= 50) colorText = 'text-amber-400';

        return `
        <tr>
            <td class="py-1.5 text-slate-300">${n.sorteo}</td>
            <td class="py-1.5 font-bold text-white tracking-widest">${n.numero}</td>
            <td class="py-1.5 text-right font-black ${colorText}">${pct}%</td>
        </tr>
        `;
    }).join('') : '<tr><td colspan="3" class="text-center text-slate-500 py-3">Sin datos hoy</td></tr>';
}
window.renderizarMinicuadrosNumeros = renderizarMinicuadrosNumeros;

// ==========================================================
// EVALUACIÓN DINÁMICA DE ESTATUS 
// ==========================================================
export function evaluarEstatusDinamicoSorteo(sorteo) {
    if (!sorteo) return { texto: 'CERRADO', esActivo: false, claseBadge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' };

    const estatusDB = String(sorteo.estatus || sorteo.estado || 'ACTIVO').toUpperCase().trim();
    if (['PAUSADO', 'INACTIVO', 'PAUSA', 'DESACTIVADO'].includes(estatusDB)) {
        return { texto: 'PAUSADO', esActivo: false, claseBadge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    }

    const ahoraPanama = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false });
    const normHora = (hStr, def) => {
        if (!hStr || hStr === '00:00' || hStr === '00:00:00') return def;
        let s = String(hStr).trim();
        if (s.length === 5) s += ':00';
        return s.length === 8 ? s : def;
    };

    const horaApertura = normHora(sorteo.hora_apertura || sorteo.horario_apertura, '06:00:00');
    const horaCierre = normHora(sorteo.hora_cierre || sorteo.horario_cierre || sorteo.hora, '23:59:00');

    if (ahoraPanama < horaApertura || ahoraPanama >= horaCierre) {
        return { texto: 'CERRADO', esActivo: false, claseBadge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' };
    }

    return { texto: 'ACTIVO', esActivo: true, claseBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
}
window.evaluarEstatusDinamicoSorteo = evaluarEstatusDinamicoSorteo;

async function cargarGridSorteosEnVivo() {
    try {
        const supabase = window.getSupabaseClient();
        const grid = document.getElementById('dashboard-draws-grid');
        if (!supabase || !grid) return;

        const { data: sorteos, error } = await supabase.from('sorteos').select('*').order('id', { ascending: true });

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
                    timerElem.className = estatusInfo.texto === 'PAUSADO' ? "font-mono font-bold text-amber-400" : "font-mono font-bold text-rose-400";
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
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
            if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resultados' }, () => {
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
            if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadas' }, () => {
            cargarResumenOperacionesHoy();
            cargarMetricasSeguras();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteos' }, () => {
            cargarResumenOperacionesHoy();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime conectado exitosamente.');
            }
        });
}

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

    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            if (typeof cargarResumenOperacionesHoy === 'function') cargarResumenOperacionesHoy();
            if (typeof cargarMetricasSeguras === 'function') cargarMetricasSeguras();
        });
    }

    const botonesCerrarSesion = document.querySelectorAll('#btn-logout, .btn-logout, [data-action="logout"], #btn-cerrar-sesion');
    botonesCerrarSesion.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof cerrarSesionAdmin === 'function') cerrarSesionAdmin();
        });
    });

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

    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil-admin') || document.getElementById('btn-save-admin');
    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof guardarPerfilAdmin === 'function') guardarPerfilAdmin();
        });
    }

    if (typeof suscribirEventosTiempoReal === 'function') {
        suscribirEventosTiempoReal();
    }
});
// ==========================================================
// CONTROL DEFINITIVO DE LA ALERTA DE SORTEO INMINENTE
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Buscar el botón Entendido de la alerta superior
    const btnEntendido = document.querySelector('#section-dashboard button, .admin-only button, button') ;
    
    // Si el usuario ya le dio clic anteriormente en esta sesión, ocultarla de inmediato
    const alertaSilenciada = sessionStorage.getItem('buxy_alerta_silenciada');
    if (alertaSilenciada) {
        const contenedorAlerta = document.querySelector('.bg-red-500\\/10, [class*="bg-red"], [class*="border-red"]');
        if (contenedorAlerta) contenedorAlerta.style.display = 'none';
    }

    // Escuchar el clic en el botón Entendido para silenciarla y pausar cualquier sonido
    document.addEventListener('click', (e) => {
        if (e.target && (e.target.textContent.includes('Entendido') || e.target.closest('button')?.textContent.includes('Entendido'))) {
            sessionStorage.setItem('buxy_alerta_silenciada', 'true');
            
            // Buscar y ocultar el banner rojo de alerta de forma suave
            const banner = e.target.closest('div[class*="bg-"]');
            if (banner) {
                banner.style.transition = 'opacity 0.3s ease';
                banner.style.opacity = '0';
                setTimeout(() => banner.style.display = 'none', 300);
            }
        }
    });
});

// ==========================================================
// ACCIÓN: ESCANEAR / VALIDAR TICKET DESDE EL DASHBOARD
// ==========================================================
window.validarTicketGlobal = async function() {
    const folio = prompt("🔍 VALIDACIÓN DE TICKET\n\nIngrese el código o folio del ticket:");
    if (!folio || folio.trim() === '') return;
    
    if (typeof window.buxyAccionTicket === 'function') {
        window.buxyAccionTicket(folio.trim(), 'ver');
    } else if (typeof window.verTicketHistorial === 'function') {
        window.verTicketHistorial(folio.trim());
    } else {
        alert("El visualizador de tickets se está cargando. Por favor, intente desde el menú Historial.");
    }
};
window.initPerfilAdmin = initPerfilAdmin;
window.guardarPerfilAdmin = guardarPerfilAdmin;