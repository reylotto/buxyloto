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
            
            // Estilo conservado: "6 ap." o el nombre del sorteo
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
                <td class="p-3 flex justify-center items-center space-x-1.5">
                    <button onclick="window.verTicketSolo('${t.id}')" title="Ver Ticket (Menú)"
                            class="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold flex items-center">
                        <i class="fa-solid fa-eye mr-1"></i> Ver
                    </button>
                    <button onclick="window.imprimirTicketDirecto('${t.id}')" title="Impresión Rápida"
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold flex items-center">
                        <i class="fa-solid fa-print mr-1"></i> Imprimir
                    </button>
                    ${esAnulable ? `
                    <button onclick="window.cancelarTicketDefinitivo('${codigoRef}')" title="Anular Ticket"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban"></i>
                    </button>` : '<span class="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded" title="Sorteo Cerrado"><i class="fa-solid fa-lock"></i></span>'}
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
// 🏛️ INTERCEPTOR: BOTONES SEPARADOS (VER Y REIMPRIMIR)
// =========================================================================
if (typeof window !== 'undefined') {
    // 1. FUNCIÓN SOLO PARA VER (Abre el modal de opciones)
    window.verTicketSolo = async function(ticketId) {
        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return alert("❌ Error: Sin conexión a la BD.");

            const { data: ticket } = await supabase.from('tickets').select('*, bancas(nombre)').eq('id', ticketId).single();
            if (!ticket) throw new Error("Ticket no encontrado.");

            const { data: jugadas } = await supabase.from('jugadas').select('*').eq('ticket_id', ticketId);

            const ticketData = {
                ...ticket,
                codigo_ticket: ticket.codigo_ticket || ticket.folio || ticket.codigo || 'BX-000000',
                monto_total: parseFloat(ticket.monto_total || ticket.total || ticket.monto || 0).toFixed(2),
                banca_nombre: ticket.bancas?.nombre || ticket.banca_nombre || ticket.vendedor_nombre || 'Banca',
                detalles: jugadas || [], jugadas: jugadas || []
            };

            if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
                window.mostrarOpcionesExportacionTicket(ticketData);
            }
        } catch (err) { alert("❌ No se pudo cargar el ticket: " + err.message); }
    };

    // 2. FUNCIÓN IMPRESIÓN DIRECTA (Bypass de modal a térmica)
    window.imprimirTicketDirecto = async function(ticketId) {
        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return alert("❌ Error: Sin conexión a la BD.");

            const { data: ticket } = await supabase.from('tickets').select('*, bancas(nombre)').eq('id', ticketId).single();
            if (!ticket) throw new Error("Ticket no encontrado.");

            const { data: jugadas } = await supabase.from('jugadas').select('*').eq('ticket_id', ticketId);

            const ticketData = {
                ...ticket,
                codigo_ticket: ticket.codigo_ticket || ticket.folio || ticket.codigo || 'BX-000000',
                monto_total: parseFloat(ticket.monto_total || ticket.total || ticket.monto || 0).toFixed(2),
                banca_nombre: ticket.bancas?.nombre || ticket.banca_nombre || ticket.vendedor_nombre || 'Banca',
                detalles: jugadas || [], jugadas: jugadas || []
            };

            if (typeof window.imprimirTicketTermica === 'function') {
                window.imprimirTicketTermica(ticketData);
            }
        } catch (err) { alert("❌ No se pudo imprimir el ticket: " + err.message); }
    };

    window.cancelarTicketDefinitivo = cancelarTicketDefinitivo;
    window.anularTicket = window.cancelarTicketDefinitivo;
    window.reimpresionUnificadaPOS = window.verTicketSolo; // Compatibilidad
    window.verTicketDetalleDirecto = window.verTicketSolo; // Compatibilidad
}