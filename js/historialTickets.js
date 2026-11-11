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
            // 🔥 FILTRO MAESTRO DE INQUILINOS ESTRICTO (MULTI-TENANT - HISTORIAL)
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined' && String(inquilinoId).trim() !== '') {
            query = query.eq('inquilino_id', inquilinoId);
        } else {
            query = query.is('inquilino_id', null);
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
            // 🎯 BOTONES DEFINITIVOS CON FUNCIONES INDEPENDIENTES
            // 🎯 BOTONES CORREGIDOS: Ojito (Detalles), Impresora (Opciones), Ban (Cancelar)
        // BOTONES CORREGIDOS: Ojito (Detalles), Impresora (Opciones), Ban (Cancelar)
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-cyan-400">${codigoRef}</td>
            <td class="p-3 text-slate-300 text-[11px]">${fecha}</td>
            <td class="p-3 text-slate-300">${bancaNom}</td>
            <td class="p-3 text-slate-300">${cantJugadas}</td>
            <td class="p-3 font-mono font-bold text-emerald-400">$${montoVenta}</td>
            <td class="p-3 font-mono font-bold text-white">$${montoPremio}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${estatusText}</span></td>
            <td class="p-3 flex justify-center items-center space-x-2">
                
                <!-- BOTÓN 1: OJITO (Llama directo al folio del ticket) -->
                <button onclick="window.verTicketHistorial('${codigoRef}')" title="Ver Detalles del Ticket" 
                        class="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-eye"></i>
                </button>
                
                <!-- BOTÓN 2: IMPRESORA (Abre tu modal de Imprimir/WhatsApp/Descargar) -->
                <button onclick="window.buxyAccionTicket('${t.id}', 'ver')" title="Opciones de Emisión" 
                        class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-print"></i>
                </button>
                
                <!-- BOTÓN 3: CANCELAR (Anular Ticket) -->
                ${esAnulable ? `
                <button onclick="window.cancelarTicketDefinitivo('${codigoRef}')" title="Anular Ticket" 
                        class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-ban"></i>
                </button>` : '<span class="text-slate-500 bg-slate-800 w-8 h-8 rounded-lg flex items-center justify-center" title="No Anulable"><i class="fa-solid fa-lock"></i></span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    } catch (err) {
        console.error("❌ Error al cargar historial:", err);
    }
}

// ==========================================================
// 🧠 CEREBRO DE ACCIONES Y VISUALIZADOR DEFINITIVO
// ==========================================================
if (typeof window !== 'undefined') {

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
            
            if (!ticket) {
                let { data: fallback } = await supabase.from('tickets').select('*').eq('folio', identificador).maybeSingle();
                ticket = fallback;
            }

            if (!ticket) throw new Error("Ticket no encontrado en la base de datos.");

            const { data: jugadas } = await supabase.from('jugadas').select('*').eq('ticket_id', ticket.id);
            let nombreBanca = ticket.banca_nombre || ticket.vendedor_nombre || 'Banca General';
            
            const ticketData = {
                ...ticket,
                codigo_ticket: ticket.codigo_ticket || ticket.folio || ticket.codigo || 'BX-000000',
                monto_total: parseFloat(ticket.monto_total || ticket.total || ticket.monto || 0).toFixed(2),
                banca_nombre: nombreBanca,
                detalles: jugadas || [], jugadas: jugadas || []
            };

            // RUTEO DE ACCIONES BLINDADO
            if (accion === 'ver') {
                if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
                    window.mostrarOpcionesExportacionTicket(ticketData);
                } 
            } else if (accion === 'imprimir') {
                if (typeof window.imprimirTicketTermica === 'function') {
                    window.imprimirTicketTermica(ticketData);
                } 
            } else if (accion === 'detalle') {
                // 🔥 LLAMAMOS AL NUEVO VISUALIZADOR A PRUEBA DE FALLOS
                window.renderizarDetalleTicketBuxy(ticketData);
            }
        } catch (err) { 
            console.error(err);
            alert("❌ " + err.message); 
        }
    };

    // 🔥 VISUALIZADOR DEFINITIVO DEL TICKET (El Ojito)
    window.renderizarDetalleTicketBuxy = function(ticket) {
        // Eliminar modal anterior si existe para evitar choques
        const existingModal = document.getElementById('modal-detalle-blindado');
        if (existingModal) existingModal.remove();

        const jugadas = ticket.detalles || ticket.jugadas || [];
        let filasJugadas = '';

        if (jugadas.length === 0) {
            filasJugadas = '<tr><td colspan="4" class="text-center p-4 text-slate-400 text-xs">No hay detalles registrados para este ticket.</td></tr>';
        } else {
            jugadas.forEach(j => {
                const num = j.numero || j.num1 || '--';
                const tipo = String(j.tipo || 'Directo').toUpperCase();
                const monto = parseFloat(j.monto || j.amount || j.monto_apostado || 0).toFixed(2);
                const premio = parseFloat(j.premio || j.monto_premio || 0).toFixed(2);
                const esGanador = premio > 0;
                
                filasJugadas += `
                    <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-700/30 transition">
                        <td class="p-2.5 text-center font-black text-white tracking-widest">${num}</td>
                        <td class="p-2.5 text-center text-cyan-300 font-semibold">${tipo}</td>
                        <td class="p-2.5 text-center text-emerald-400 font-mono">$${monto}</td>
                        <td class="p-2.5 text-center font-mono font-bold ${esGanador ? 'text-amber-400' : 'text-slate-500'}">$${premio}</td>
                    </tr>
                `;
            });
        }

        const estatus = String(ticket.estatus || ticket.estado || 'PENDIENTE').toUpperCase();
        let badgeColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        if (estatus.includes('PREMIAD') || estatus.includes('GANADOR')) badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        else if (estatus.includes('NO') || estatus.includes('PERDEDOR')) badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
        else if (estatus.includes('CANCEL')) badgeColor = 'bg-red-600/20 text-red-500 border-red-600/30';

        const modalHTML = `
            <div id="modal-detalle-blindado" class="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                    
                    <!-- Cabecera -->
                    <div class="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                        <h3 class="text-white font-bold text-base flex items-center">
                            <i class="fa-solid fa-receipt text-cyan-400 mr-2"></i> Desglose del Ticket
                        </h3>
                        <button onclick="document.getElementById('modal-detalle-blindado').remove()" class="text-slate-400 hover:text-rose-400 transition text-lg px-2">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    
                    <!-- Información General -->
                    <div class="p-4 bg-slate-800/50 grid grid-cols-2 gap-4 border-b border-slate-700/50">
                        <div>
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Folio</p>
                            <p class="text-cyan-400 font-mono font-bold text-sm">${ticket.codigo_ticket}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Estado</p>
                            <span class="px-2 py-0.5 rounded text-[10px] font-black border uppercase ${badgeColor}">${estatus}</span>
                        </div>
                        <div>
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Fecha</p>
                            <p class="text-slate-200 text-xs">${new Date(ticket.created_at).toLocaleString('en-GB')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Banca</p>
                            <p class="text-slate-200 text-xs truncate">${ticket.banca_nombre}</p>
                        </div>
                    </div>

                    <!-- Tabla de Números -->
                    <div class="overflow-y-auto max-h-64 bg-slate-900">
                        <table class="w-full">
                            <thead class="bg-slate-800 text-[10px] text-slate-400 uppercase sticky top-0 shadow-md">
                                <tr>
                                    <th class="p-2.5 text-center">N°</th>
                                    <th class="p-2.5 text-center">Tipo</th>
                                    <th class="p-2.5 text-center">Apostado</th>
                                    <th class="p-2.5 text-center">Premio</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasJugadas}
                            </tbody>
                        </table>
                    </div>

                    <!-- Totales -->
                    <div class="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                        <div>
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Jugado</p>
                            <p class="text-emerald-400 font-mono font-bold text-lg">$${parseFloat(ticket.monto_total || ticket.monto || 0).toFixed(2)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Ganado</p>
                            <p class="text-amber-400 font-mono font-black text-2xl drop-shadow-md">$${parseFloat(ticket.premio || ticket.monto_premio || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    };




    window.cancelarTicketDefinitivo = async function(ticketRef) {
        if (!confirm(`¿Está seguro de que desea CANCELAR el ticket "${ticketRef}"?`)) return;
        try {
            const supabase = window.supabaseClient || window.supabase;
            
            // 🛑 CANDADO DE TIEMPO DASHBOARD
            let queryVal = supabase.from('tickets').select('sorteo_id');
            if (/^\d+$/.test(ticketRef)) queryVal = queryVal.eq('id', parseInt(ticketRef));
            else queryVal = queryVal.eq('codigo_ticket', String(ticketRef).trim());
            
            const { data: tData } = await queryVal.maybeSingle();
            if (tData && tData.sorteo_id) {
                const { data: sData } = await supabase.from('sorteos').select('hora_cierre, estatus, estado').eq('id', tData.sorteo_id).single();
                if (sData) {
                    const estatus = String(sData.estatus || sData.estado || 'ACTIVO').toUpperCase();
                    if (estatus !== 'ACTIVO' && estatus !== 'ABIERTO') throw new Error("El sorteo ya no está activo.");
                    const ahoraStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false });
                    if (ahoraStr >= (sData.hora_cierre || '23:59:00')) throw new Error("Hora de cierre superada. Prohibido anular.");
                }
            }

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