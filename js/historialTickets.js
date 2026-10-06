// ==========================================================
// MÓDULO EXCLUSIVO DE HISTORIAL Y ANULACIÓN DE TICKETS
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

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, sorteos(nombre), bancas(nombre)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay tickets registrados.</td></tr>';
            return;
        }

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            // Identificador prioritario para la cancelación (Código > Folio > ID)
            const codigoRef = t.codigo || t.codigo_ticket || t.folio || t.id;
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
                <td class="p-3 font-mono font-bold text-cyan-400">${codigoRef}</td>
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
                    <button onclick="window.cancelarTicketDefinitivo('${codigoRef}')" title="Anular Ticket"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban mr-1"></i> Cancelar
                    </button>` : '<span class="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Cerrado</span>'}
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

        // Ejecutar la función RPC comprobada en PostgreSQL
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

// Exposición explícita en el ámbito global del navegador
if (typeof window !== 'undefined') {
    window.cancelarTicketDefinitivo = async function(ticketRef) {
        if (!ticketRef || ticketRef === 'undefined' || ticketRef === 'null') {
            alert("⚠️ Error: La referencia del ticket es inválida.");
            return;
        }

        if (!confirm(`¿Desea anular definitivamente el ticket "${ticketRef}"?`)) return;

        try {
            const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
            
            if (!supabase) {
                alert("❌ Error: Cliente de Supabase no disponible.");
                return;
            }

            // Llamada RPC a la función SQL
            const { data, error } = await supabase.rpc('cancelar_ticket_universal', { 
                p_referencia: String(ticketRef).trim() 
            });

            if (error) {
                console.error("Error devuelto por Supabase RPC:", error);
                alert("❌ Error en BD: " + error.message);
                return;
            }

            if (data && data.success) {
                alert(`✅ ${data.message}`);
                // Recargar historial
                if (typeof window.cargarHistorialTicketsCentral === 'function') {
                    await window.cargarHistorialTicketsCentral();
                } else {
                    location.reload();
                }
            } else {
                alert(`⚠️ ${data?.message || 'No se pudo cancelar el ticket.'}`);
            }

        } catch (err) {
            console.error("Excepción al cancelar ticket:", err);
            alert("❌ Error: " + (err.message || "Fallo inesperado."));
        }
    };

    window.anularTicket = window.cancelarTicketDefinitivo;
}