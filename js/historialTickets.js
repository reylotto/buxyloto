// ==========================================================
// MÓDULO EXCLUSIVO DE HISTORIAL Y ANULACIÓN DE TICKETS
// Integrado con Motor Unificado de Impresión a 2 Columnas
// ==========================================================

export async function cargarHistorialTicketsCentral() {
    const tbody = document.getElementById('tabla-historial-tickets') || 
                  document.getElementById('tickets-table-body') ||
                  document.getElementById('historial-tickets-body') ||
                  document.querySelector('#section-tickets tbody');

    if (!tbody) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center p-4 text-slate-400">
                    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando historial de tickets...
                </td>
            </tr>
        `;

        const hoy = new Date();
        const fechaHoyStr = hoy.toISOString().split('T')[0];

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, sorteos(nombre), bancas(nombre)')
            .gte('created_at', `${fechaHoyStr}T00:00:00.000Z`)
            .lte('created_at', `${fechaHoyStr}T23:59:59.999Z`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados.</td></tr>';
            return;
        }

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs text-center';

            const codigoRef = t.codigo || t.codigo_ticket || t.folio || t.id;
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            
            // Usamos tu estilo original: "6 ap." o el nombre del sorteo
            const cantJugadas = t.detalles?.length || t.jugadas?.length ? `${t.detalles?.length || t.jugadas?.length} ap.` : (t.sorteos?.nombre || 'Varias');
            const bancaNom = t.bancas?.nombre || t.banca_nombre || t.vendedor_nombre || 'Banca General';
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

            // 🚨 BOTÓN ACTUALIZADO PARA EVITAR EL MODAL VIEJO
            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-cyan-400">${codigoRef}</td>
                <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
                <td class="p-3 text-slate-300">${bancaNom}</td>
                <td class="p-3 text-slate-300">${cantJugadas}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">$${montoVenta}</td>
                <td class="p-3 font-mono font-bold text-white">$${montoPremio}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
                        ${estatusText}
                    </span>
                </td>
                <td class="p-3 flex justify-center items-center space-x-2">
                    <button onclick="window.reimpresionUnificadaPOS('${t.id}')" title="Reimprimir (Formato Oficial)"
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-print mr-1"></i> Ver / Imprimir
                    </button>
                    ${esAnulable ? `
                    <button onclick="window.cancelarTicketDefinitivo('${codigoRef}')" title="Anular Ticket"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban"></i>
                    </button>` : '<span class="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded"><i class="fa-solid fa-lock"></i></span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("❌ Error al cargar historial de tickets:", err);
    }
}

export async function cancelarTicketDefinitivo(ticketRef) {
    if (!ticketRef || ticketRef === 'undefined' || ticketRef === 'null') {
        alert("⚠️ Error: La referencia del ticket está vacía.");
        return;
    }

    if (!confirm(`¿Está seguro de que desea CANCELAR el ticket "${ticketRef}"?`)) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) throw new Error("Cliente de Supabase no disponible.");

        const { data, error } = await supabase.rpc('cancelar_ticket_universal', { 
            p_referencia: String(ticketRef) 
        });

        if (error) throw error;

        if (data && data.success) {
            alert(`✅ ${data.message}`);
            await cargarHistorialTicketsCentral();
        } else {
            alert(`⚠️ ${data?.message || 'No se pudo cancelar el ticket.'}`);
        }

    } catch (err) {
        console.error("❌ Error al cancelar ticket:", err);
        alert("❌ Error: " + (err.message || JSON.stringify(err)));
    }
}

// =========================================================================
// 🏛️ INTERCEPTOR: CONECTAR HISTORIAL AL MOTOR PRINCIPAL DE TICKET MANAGER
// =========================================================================
if (typeof window !== 'undefined') {
    // 🚨 NUEVA FUNCIÓN: Esquiva por completo el modal viejo del HTML
    window.reimpresionUnificadaPOS = async function(ticketId) {
        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return alert("❌ Error: Sin conexión a la base de datos.");

            const { data: ticket, error: errTicket } = await supabase
                .from('tickets')
                .select('*, bancas(nombre)')
                .eq('id', ticketId)
                .single();

            if (errTicket || !ticket) throw new Error("Ticket no encontrado en el sistema.");

            const { data: jugadas, error: errJugadas } = await supabase
                .from('jugadas')
                .select('*')
                .eq('ticket_id', ticketId);

            if (errJugadas) throw errJugadas;

            const ticketData = {
                ...ticket,
                banca_nombre: ticket.bancas?.nombre || ticket.banca_nombre || ticket.vendedor_nombre || 'Banca',
                detalles: jugadas,
                jugadas: jugadas
            };

            // Llama exclusivamente a la ventana negra del ticketManager (el diseño a 2 columnas)
            if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
                window.mostrarOpcionesExportacionTicket(ticketData);
            } else {
                alert("⚠️ Error: El Gestor de Tickets (ticketManager) no está cargado.");
            }

        } catch (err) {
            console.error("Error cargando detalle del ticket:", err);
            alert("❌ No se pudo cargar el ticket: " + err.message);
        }
    };

    window.cancelarTicketDefinitivo = cancelarTicketDefinitivo;
    window.anularTicket = window.cancelarTicketDefinitivo;
    
    // Anulamos la función vieja para que no dé problemas
    window.verTicketDetalleDirecto = window.reimpresionUnificadaPOS;
}