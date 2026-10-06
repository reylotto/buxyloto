// ==========================================================
// MÓDULO EXCLUSIVO DE HISTORIAL Y ANULACIÓN DE TICKETS (js/historialTickets.js)
// ==========================================================

export async function cargarHistorialTicketsCentral() {
    const tbody = document.getElementById('tabla-historial-tickets') || 
                  document.getElementById('tickets-table-body') ||
                  document.getElementById('historial-tickets-body') ||
                  document.querySelector('#section-tickets tbody');

    if (!tbody) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) {
            console.error("❌ Cliente de Supabase no disponible.");
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center p-4 text-slate-400">
                    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando historial de tickets...
                </td>
            </tr>
        `;

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, sorteos(nombre), bancas(nombre)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados aún.</td></tr>';
            return;
        }

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            const codigo = t.codigo || t.codigo_ticket || t.folio || `#${t.id}`;
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            const sorteoNom = t.sorteos?.nombre || t.sorteo_nombre || t.sorteo || `Sorteo #${t.sorteo_id || ''}`;
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
                <td class="p-3 font-mono font-bold text-cyan-400">${codigo}</td>
                <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
                <td class="p-3 text-slate-300 font-semibold">${sorteoNom}</td>
                <td class="p-3 text-slate-300">${bancaNom}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">$${montoVenta}</td>
                <td class="p-3 font-mono font-bold text-white">$${montoPremio}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
                        ${estatusText}
                    </span>
                </td>
                <td class="p-3 text-center space-x-1">
                    <button onclick="window.verTicketDetalleDirecto('${t.id}')" title="Ver Detalle"
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-eye mr-1"></i> Ver
                    </button>
                    ${esAnulable ? `
                    <button onclick="window.cancelarTicketDefinitivo('${t.id}')" title="Anular Ticket"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban mr-1"></i> Cancelar
                    </button>` : '<span class="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Cerrado</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("❌ Error al cargar historial de tickets:", err.message);
    }
}

// FUNCIÓN PARA CANCELAR CUALQUIER TICKET DEFINITIVAMENTE
export async function cancelarTicketDefinitivo(ticketRef) {
    if (!ticketRef) return alert("⚠️ Referencia de ticket no válida.");

    if (!confirm(`¿Está seguro de que desea CANCELAR/ANULAR el ticket #${ticketRef}?`)) return;

    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (!supabase) throw new Error("No hay cliente Supabase activo.");

        // 1. Intentar llamar a la función del SQL Editor primero (Si fue creada)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('anular_ticket_seguro', { ticket_ref: String(ticketRef) });

        if (!rpcErr && rpcRes) {
            if (rpcRes.success) {
                alert("✅ Ticket cancelado exitosamente.");
            } else {
                alert(`⚠️ ${rpcRes.message}`);
            }
        } else {
            // 2. Fallback por actualización directa a Supabase en caso de que la función RPC no exista
            const refStr = String(ticketRef).trim();
            const esIdNumerico = /^\d+$/.test(refStr);

            let query = supabase.from('tickets').update({ estatus: 'cancelado', estado: 'cancelado' });

            if (esIdNumerico) {
                query = query.eq('id', parseInt(refStr, 10));
            } else {
                query = query.or(`codigo.eq.${refStr},codigo_ticket.eq.${refStr},folio.eq.${refStr}`);
            }

            const { error: updErr } = await query;
            if (updErr) throw updErr;

            alert("✅ Ticket cancelado exitosamente.");
        }

        // 3. Recargar datos del sistema automáticamente
        await cargarHistorialTicketsCentral();
        if (typeof window.cargarMetricasSeguras === 'function') window.cargarMetricasSeguras();
        if (typeof window.cargarResumenOperacionesHoy === 'function') window.cargarResumenOperacionesHoy();

    } catch (err) {
        console.error("❌ Error al cancelar ticket:", err);
        alert("❌ Error al cancelar ticket: " + (err.message || JSON.stringify(err)));
    }
}

// FUNCIÓN PARA VER EL DETALLE DEL TICKET
export async function verTicketDetalleDirecto(ticketId) {
    try {
        const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        const { data: t, error } = await supabase.from('tickets').select('*, sorteos(nombre)').eq('id', ticketId).single();
        
        if (error || !t) return alert("No se pudo cargar la información del ticket.");

        let jugadas = t.jugadas || t.detalles;
        if (typeof jugadas === 'string') {
            try { jugadas = JSON.parse(jugadas); } catch (e) { jugadas = []; }
        }

        let textoDetalle = `===========================\n`;
        textoDetalle += `     BUXYLOTO POS - TICKET     \n`;
        textoDetalle += `===========================\n`;
        textoDetalle += `Ticket: ${t.codigo || t.codigo_ticket || t.id}\n`;
        textoDetalle += `Sorteo: ${t.sorteos ? t.sorteos.nombre : (t.sorteo_nombre || t.sorteo_id)}\n`;
        textoDetalle += `Fecha: ${new Date(t.created_at).toLocaleString()}\n`;
        textoDetalle += `---------------------------\n`;
        textoDetalle += `JUGADAS:\n`;

        if (Array.isArray(jugadas)) {
            jugadas.forEach(j => {
                textoDetalle += `- ${j.tipo || 'Directo'}: ${j.numero || j.number} -> $${Number(j.monto || j.amount || 0).toFixed(2)}\n`;
            });
        }

        textoDetalle += `---------------------------\n`;
        textoDetalle += `TOTAL: $${Number(t.total || t.monto || t.monto_total || 0).toFixed(2)}\n`;
        textoDetalle += `ESTATUS: ${(t.estatus || t.estado || 'PENDIENTE').toUpperCase()}\n`;
        textoDetalle += `===========================`;

        alert(textoDetalle);
    } catch (err) {
        alert("Error al obtener el ticket: " + err.message);
    }
}

// EXPOSICIÓN GLOBAL
window.cargarHistorialTicketsCentral = cargarHistorialTicketsCentral;
window.cancelarTicketDefinitivo = cancelarTicketDefinitivo;
window.verTicketDetalleDirecto = verTicketDetalleDirecto;

// Reemplazar funciones globales antiguas para redirigir a la nueva lógica
window.anularTicket = cancelarTicketDefinitivo;
window.eliminarTicketHistorial = cancelarTicketDefinitivo;
window.cargarHistorialTickets = cargarHistorialTicketsCentral;