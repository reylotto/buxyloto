// ==========================================================
// MÓDULO EXCLUSIVO DE HISTORIAL Y ANULACIÓN DE TICKETS
// VERSIÓN BLINDADA (Botones Separados y Búsqueda Segura)
// ==========================================================

export async function cargarHistorialTicketsCentral() {
    const tbody = document.getElementById('tabla-historial-tickets') || 
                  document.getElementById('tickets-table-body') ||
                  document.getElementById('historial-tickets-body');

    if (!tbody) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) return;

        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando historial...</td></tr>`;

        const hoy = new Date();
        const fechaHoyStr = hoy.toISOString().split('T')[0];

        // 🚨 FILTRO ESTRICTO DE BASE DE DATOS
        const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        const rol = String(sesion.rol || '').toLowerCase();
        let query = supabase.from('tickets').select('*, sorteos(nombre)')
            .gte('created_at', `${fechaHoyStr}T00:00:00.000Z`)
            .lte('created_at', `${fechaHoyStr}T23:59:59.999Z`);
            // 🔥 FILTRO MAESTRO DE INQUILINOS (MULTI-TENANT)
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
            query = query.eq('inquilino_id', inquilinoId);
        }

        if (rol.includes('supervisor')) {
            const zonaSup = String(sesion.zona || '').trim().toLowerCase();
            const { data: bData } = await supabase.from('bancas').select('id, zona');
            const idsPermitidos = (bData || []).filter(b => String(b.zona || '').trim().toLowerCase() === zonaSup).map(b => String(b.id));
            query = query.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        } else if (!rol.includes('admin') && !rol.includes('supervisor')) {
            const nombreUsr = sesion.nombre || sesion.nombre_banca || sesion.username;
            const { data: bData } = await supabase.from('bancas').select('id').or(`nombre_banca.eq.${nombreUsr},vendedor_nombre.eq.${nombreUsr}`);
            const idsPermitidos = (bData || []).map(b => String(b.id));
            query = query.in('banca_id', idsPermitidos.length > 0 ? idsPermitidos : ['-1']);
        }

        const { data: tickets, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados hoy.</td></tr>';
            return;
        }

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs text-center';

            const codigoRef = t.codigo || t.codigo_ticket || t.folio || t.id;
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            const cantJugadas = t.detalles?.length || t.jugadas?.length ? `${t.detalles?.length || t.jugadas?.length} ap.` : (t.sorteos?.nombre || 'Varias');
            const bancaNom = t.banca_nombre || t.vendedor_nombre || 'Banca';
            const montoVenta = Number(t.total || t.monto_total || t.monto || 0).toFixed(2);
            const montoPremio = Number(t.premio || t.monto_premio || 0).toFixed(2);

            const estatus = String(t.estatus || t.estado || 'pendiente').toLowerCase();
            let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            let estatusText = 'PENDIENTE';

            if (estatus === 'premiado' || estatus === 'ganador') {
                badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                estatusText = `PREMIADO ($${montoPremio})`;
            } else if (estatus === 'no_premiado' || estatus === 'perdedor') {
                badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                estatusText = 'NO PREMIADO';
            } else if (estatus === 'cancelado' || estatus === 'anulado') {
                badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                estatusText = 'CANCELADO';
            }

            const esAnulable = (estatus === 'pendiente');

            // 🎯 BOTONES DEFINITIVOS CON FUNCIONES INDEPENDIENTES
            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-cyan-400">${codigoRef}</td>
                <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
                <td class="p-3 text-slate-300">${bancaNom}</td>
                <td class="p-3 text-slate-300">${cantJugadas}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">$${montoVenta}</td>
                <td class="p-3 font-mono font-bold text-white">$${montoPremio}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${estatusText}</span></td>
                <td class="p-3 flex justify-center items-center space-x-1.5">
                    <button onclick="window.buxyAccionTicket('${t.id}', 'ver')" title="Ver Opciones (WhatsApp, Descargar)" 
                            class="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold flex items-center">
                        <i class="fa-solid fa-eye mr-1"></i> Ver
                    </button>
                    <button onclick="window.buxyAccionTicket('${t.id}', 'imprimir')" title="Imprimir Directo en POS" 
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold flex items-center">
                        <i class="fa-solid fa-print mr-1"></i> Imprimir
                    </button>
                    ${esAnulable ? `
                    <button onclick="window.cancelarTicketDefinitivo('${codigoRef}')" title="Anular Ticket" 
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban"></i>
                    </button>` : '<span class="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded" title="No Anulable"><i class="fa-solid fa-lock"></i></span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("❌ Error al cargar historial:", err);
    }
}

// ==========================================================
// 🧠 CEREBRO DE ACCIONES Y ELIMINADOR DE VENTANA ANTIGUA
// ==========================================================
if (typeof window !== 'undefined') {

    // Destruir la ventana blanca vieja automáticamente si existe
    const cssNeutralizador = document.createElement('style');
    cssNeutralizador.innerHTML = `#modal-ticket-view { display: none !important; opacity: 0 !important; pointer-events: none !important; }`;
    document.head.appendChild(cssNeutralizador);

    window.buxyAccionTicket = async function(ticketInput, accion) {
        try {
            const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
            if (!supabase) throw new Error("Sin conexión a la Base de Datos.");

            let identificador = typeof ticketInput === 'object' ? (ticketInput.id || ticketInput.codigo_ticket) : String(ticketInput).trim();
            let query = supabase.from('tickets').select('*');
            
            if (/^\d+$/.test(identificador)) {
                query = query.eq('id', parseInt(identificador));
            } else {
                query = query.eq('codigo_ticket', identificador);
            }

            let { data: ticket } = await query.maybeSingle();
            
            // Respaldo por folio
            if (!ticket) {
                let { data: fallback } = await supabase.from('tickets').select('*').eq('folio', identificador).maybeSingle();
                ticket = fallback;
            }

            if (!ticket) throw new Error("Ticket no encontrado.");

            // Buscar jugadas y banca segura
            const { data: jugadas } = await supabase.from('jugadas').select('*').eq('ticket_id', ticket.id);
            let nombreBanca = ticket.banca_nombre || ticket.vendedor_nombre || 'Banca General';
            if (!ticket.banca_nombre && ticket.banca_id) {
                try {
                    const { data: bData } = await supabase.from('bancas').select('nombre').eq('id', ticket.banca_id).maybeSingle();
                    if (bData && bData.nombre) nombreBanca = bData.nombre;
                } catch(e) {}
            }

            const ticketData = {
                ...ticket,
                codigo_ticket: ticket.codigo_ticket || ticket.folio || ticket.codigo || 'BX-000000',
                monto_total: parseFloat(ticket.monto_total || ticket.total || ticket.monto || 0).toFixed(2),
                banca_nombre: nombreBanca,
                detalles: jugadas || [], jugadas: jugadas || []
            };

            // Ruteo de acciones
            if (accion === 'ver') {
                if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
                    window.mostrarOpcionesExportacionTicket(ticketData);
                } else { alert("Error: El gestor de ventanas no está cargado."); }
            } else if (accion === 'imprimir') {
                if (typeof window.imprimirTicketTermica === 'function') {
                    window.imprimirTicketTermica(ticketData);
                } else { alert("Error: El gestor de impresión no está cargado."); }
            }
        } catch (err) { 
            console.error(err);
            alert("❌ " + err.message); 
        }
    };

    window.cancelarTicketDefinitivo = async function(ticketRef) {
        if (!confirm(`¿Está seguro de que desea CANCELAR el ticket "${ticketRef}"?`)) return;
        try {
            const supabase = window.supabaseClient || window.supabase;
            const { data, error } = await supabase.rpc('cancelar_ticket_universal', { p_referencia: String(ticketRef) });
            if (error) throw error;
            if (data && data.success) {
                alert(`✅ ${data.message}`);
                cargarHistorialTicketsCentral();
            } else { alert(`⚠️ ${data?.message || 'Error al cancelar'}`); }
        } catch (err) { alert("❌ Error: " + err.message); }
    };

    // Apagar todos los enlaces viejos y obligarlos a usar la función nueva
    window.reimpresionUnificadaPOS = (id) => window.buxyAccionTicket(id, 'ver');
    window.verTicketDetalleDirecto = (id) => window.buxyAccionTicket(id, 'ver');
    window.verTicketDetalle = (id) => window.buxyAccionTicket(id, 'ver');
    window.showTicketModal = (id) => window.buxyAccionTicket(id, 'ver');
    window.anularTicket = window.cancelarTicketDefinitivo;
}