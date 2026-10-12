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
// 3. MÉTRICAS DEL DASHBOARD (EXCLUYENDO CANCELADOS)
// ==========================================================
async function cargarMetricasSeguras() {
    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('monto, monto_total, total, premio, monto_premio, estatus, estado');

        if (error) {
            console.warn("Aviso en métricas al consultar tickets:", error.message);
            return;
        }

        const listaTickets = tickets || [];

        const listaTicketsValidos = listaTickets.filter(t => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        const totalVendido = listaTicketsValidos.reduce((acc, t) => {
            const montoVal = Number(t.monto_total || t.monto || t.total || 0);
            return acc + montoVal;
        }, 0);

        const totalPremios = listaTicketsValidos.reduce((acc, t) => {
            const est = String(t.estatus || t.estado || '').toLowerCase();
            if (est === 'premiado' || est === 'ganador') {
                return acc + Number(t.premio || t.monto_premio || 0);
            }
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
// CARGAR HISTORIAL DE TICKETS (CON BLOQUEO ESTRICTO DE SORTEOS MÚLTIPLES)
// ==========================================================
async function cargarHistorialTickets() {
    const tbody = document.getElementById('tickets-table-body') || 
                  document.getElementById('tabla-historial-tickets') ||
                  document.getElementById('historial-tickets-body');

    if (!tbody) return;

    try {
        const supabase = window.getSupabaseClient();
        if (!supabase) return;

        // Filtros obligatorios para el día de hoy
        const hoy = new Date();
        const fechaHoyStr = hoy.toISOString().split('T')[0];

        const { data: sorteosData } = await supabase.from('sorteos').select('*');
        const sorteosCache = sorteosData || [];

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .gte('created_at', `${fechaHoyStr}T00:00:00.000Z`)
            .lte('created_at', `${fechaHoyStr}T23:59:59.999Z`)
            .order('id', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados hoy.</td></tr>';
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

            let estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">PENDIENTE</span>`;
            let textoPremio = `<span class="text-slate-500 font-mono">$0.00</span>`;
            let puedeAnular = false;
            let motivoBloqueo = 'Cerrado';

            if (estado === 'premiado' || estado === 'ganador') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">PREMIADO</span>`;
                textoPremio = `<span class="text-emerald-400 font-mono font-bold text-sm">$${montoPremio}</span>`;
                motivoBloqueo = 'Escrutado';
            } else if (estado === 'no_premiado' || estado === 'perdedor') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-400">NO PREMIADO</span>`;
                textoPremio = `<span class="text-slate-500 font-mono">$0.00</span>`;
                motivoBloqueo = 'Escrutado';
            } else if (estado === 'cancelado' || estado === 'anulado') {
                estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">CANCELADO</span>`;
                motivoBloqueo = 'Anulado';
            } else if (estado === 'pendiente' || estado === 'activo' || estado === 'en_juego') {
                puedeAnular = true;

                // RECOPILAR TODOS LOS IDs DE SORTEOS INVOLUCRADOS EN EL TICKET (SOPORTE MÚLTIPLE)
                let sorteosIdsDelTicket = [];
                if (t.sorteo_id) sorteosIdsDelTicket.push(String(t.sorteo_id));

                if (Array.isArray(lista)) {
                    lista.forEach(j => {
                        if (j.sorteo_id && !sorteosIdsDelTicket.includes(String(j.sorteo_id))) {
                            sorteosIdsDelTicket.push(String(j.sorteo_id));
                        }
                    });
                } else if (typeof lista === 'string') {
                    try {
                        const parsed = JSON.parse(lista);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(j => {
                                if (j.sorteo_id && !sorteosIdsDelTicket.includes(String(j.sorteo_id))) {
                                    sorteosIdsDelTicket.push(String(j.sorteo_id));
                                }
                            });
                        }
                    } catch(e) {}
                }

                // VALIDAR SI CUALQUIERA DE LOS SORTEOS DEL TICKET YA CERRÓ
                for (const sId of sorteosIdsDelTicket) {
                    const sorteoAsociado = sorteosCache.find(s => String(s.id) === sId);
                    if (sorteoAsociado) {
                        const estatusSorteo = String(sorteoAsociado.estatus || sorteoAsociado.estado || 'activo').toLowerCase();
                        if (['cerrado', 'finalizado', 'escrutado', 'realizado'].includes(estatusSorteo)) {
                            puedeAnular = false;
                            motivoBloqueo = 'Sorteo Cerrado';
                            break;
                        }

                        const horaCierreStr = sorteoAsociado.hora_cierre || sorteoAsociado.horario_cierre;
                        if (horaCierreStr) {
                            const [h, m] = horaCierreStr.split(':');
                            const fechaCierre = new Date();
                            fechaCierre.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                            if (ahora >= fechaCierre) {
                                puedeAnular = false;
                                motivoBloqueo = 'Sorteo Cerrado';
                                break;
                            }
                        }
                    }
                }

                if (!puedeAnular) {
                    estadoBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">EN JUEGO (CERRADO)</span>`;
                }
            }

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

        const { data: ticketsHoy, error: errTickets } = await supabase
            .from('tickets')
            .select('*')
            .gte('created_at', inicioDia.toISOString())
            .lte('created_at', finDia.toISOString());

        if (errTickets) return;

        const ticketsRaw = ticketsHoy || [];
        const tickets = ticketsRaw.filter(t => {
            const est = String(t.estatus || t.status || t.estado || '').toLowerCase();
            return est !== 'cancelado' && est !== 'anulado';
        });

        // 🚨 SOLUCIÓN DEFINITIVA: Descarga directa de Supabase sin depender de la caché
        const { data: bancasData } = await supabase.from('bancas').select('*');
        const listaBancas = bancasData || [];

        const totalTickets = tickets.length;
        let ventaTotal = 0;
        let comisionesTotal = 0;
        let premiosTotal = 0;
        let totalGanadores = 0;

        tickets.forEach(t => {
            const monto = parseFloat(t.total || t.monto || t.monto_total || 0);
            
            // --------------------------------------------------------
            // BÚSQUEDA INTELIGENTE A PRUEBA DE BALAS (Por ID y Nombre)
            // --------------------------------------------------------
            let pctComision = 10; // Rescate extremo
            
            // Sacamos cualquier dato que tenga el ticket (ID o Nombres)
            const tBancaId = String(t.banca_id || t.usuario_id || '').trim();
            const tBancaNombre = String(t.banca_nombre || t.vendedor_nombre || t.banca || t.vendedor || '').toLowerCase().trim();

            const bancaAsociada = listaBancas.find(b => {
                const bId = String(b.id).trim();
                const bAuthId = String(b.auth_id || b.usuario_id || '').trim();
                const bNombre = String(b.nombre_banca || b.nombre || '').toLowerCase().trim();
                const bVendedor = String(b.vendedor_nombre || b.operador || '').toLowerCase().trim();
                
                // Si el ID coincide, ¡es esta!
                if (tBancaId !== '' && (tBancaId === bId || tBancaId === bAuthId)) return true;
                // Si el NOMBRE coincide, ¡es esta! (Aquí cazamos a Enzo Alessandro y Jey)
                if (tBancaNombre !== '' && (tBancaNombre === bNombre || tBancaNombre === bVendedor)) return true;
                
                return false;
            });

            // Asignamos la comisión real de la banca que encontramos
            if (bancaAsociada && bancaAsociada.comision !== undefined && bancaAsociada.comision !== null) {
                pctComision = parseFloat(bancaAsociada.comision); // ¡LA BANCA MANDA!
            } else if (t.comision_porcentaje !== undefined && t.comision_porcentaje !== null) {
                pctComision = parseFloat(t.comision_porcentaje);
            }

            // MATEMÁTICA EN VIVO E INQUEBRANTABLE (Ignora errores viejos de Supabase)
            const comision = parseFloat(monto * (pctComision / 100));
            // --------------------------------------------------------
            
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

        if (typeof window.renderizarGraficosCompletos === 'function') window.renderizarGraficosCompletos(tickets);

        if (typeof window.cargarGridSorteosEnVivo === 'function') {
            await window.cargarGridSorteosEnVivo();
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
    if (typeof Chart === 'undefined') return;
    renderizarGraficoVendedores(tickets);
    renderizarGraficoSorteos(tickets);
}
window.renderizarGraficosCompletos = renderizarGraficosCompletos;

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
                backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'],
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
window.initPerfilAdmin = initPerfilAdmin;
window.guardarPerfilAdmin = guardarPerfilAdmin;