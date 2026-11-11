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
                <button onclick="window.verDesgloseDirecto('${t.id}')" title="Ver Desglose de Jugadas" 
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
// 🧠 CEREBRO DE ACCIONES 
// ==========================================================
if (typeof window !== 'undefined') {

    // 🔥 SE ELIMINÓ EL NEUTRALIZADOR CSS QUE OCULTABA TU MODAL BLANCO (Error solucionado)

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

            if (!ticket) throw new Error("Ticket no encontrado.");

            const { data: jugadas } = await supabase.from('jugadas').select('*').eq('ticket_id', ticket.id);
            let nombreBanca = ticket.banca_nombre || ticket.vendedor_nombre || 'Banca General';
            
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
                } 
            } else if (accion === 'imprimir') {
                if (typeof window.imprimirTicketTermica === 'function') {
                    window.imprimirTicketTermica(ticketData);
                } 
            } else if (accion === 'detalle') {
                // 🔥 RECONEXIÓN AL RECIBO BLANCO ORIGINAL (El Ojito)
                if (typeof window.verTicketDetalle === 'function') {
                    window.verTicketDetalle(ticket.id);
                } else if (typeof window.verTicketDetalleDirecto === 'function') {
                    window.verTicketDetalleDirecto(ticket.id);
                } else if (typeof window.showTicketModal === 'function') {
                    window.showTicketModal(ticket.id);
                } else if (typeof window.verTicketHistorial === 'function') {
                    window.verTicketHistorial(ticket.id);
                } else { 
                    alert("Error: El visor del recibo no está cargado."); 
                }
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
   // ==========================================================
// 🔍 VISUALIZADOR EXCLUSIVO DEL "OJITO" (CON SORTEO Y SUMA REAL)
// ==========================================================
if (typeof window !== 'undefined') {
    window.verDesgloseDirecto = async function(ticketId) {
        try {
            const supabase = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
            if (!supabase) throw new Error("Sin conexión a la Base de Datos.");

            // 1. Buscar el ticket
            let query = supabase.from('tickets').select('*');
            if (/^\d+$/.test(String(ticketId))) {
                query = query.eq('id', parseInt(ticketId));
            } else {
                query = query.eq('codigo_ticket', String(ticketId));
            }

            let { data: ticket } = await query.maybeSingle();
            if (!ticket) {
                const { data: fallback } = await supabase.from('tickets').select('*').eq('folio', String(ticketId)).maybeSingle();
                ticket = fallback;
            }
            if (!ticket) throw new Error("No se encontró el ticket en la base de datos.");

            // 2. 🎯 EXTRAER EL NOMBRE DEL SORTEO
            let nombreSorteo = ticket.sorteo_nombre || 'Sorteo General';
            if (!ticket.sorteo_nombre && ticket.sorteo_id) {
                try {
                    const { data: sData } = await supabase.from('sorteos').select('nombre').eq('id', ticket.sorteo_id).maybeSingle();
                    if (sData && sData.nombre) nombreSorteo = sData.nombre;
                } catch(e) {}
            }

            // 3. Buscar las jugadas
            let listaJugadas = [];
            const { data: jugadasDB } = await supabase.from('jugadas').select('*').eq('ticket_id', ticket.id);
            if (jugadasDB && jugadasDB.length > 0) {
                listaJugadas = jugadasDB;
            } else {
                listaJugadas = ticket.jugadas || ticket.detalles || [];
            }

            // 4. Construir filas y CALCULAR SUMA REAL EN VIVO
            let filasHTML = '';
            let sumaApostadoReal = 0;
            let sumaPremioReal = 0;

            if (listaJugadas.length === 0) {
                filasHTML = '<tr><td colspan="4" class="text-center p-4 text-slate-400 text-xs">No hay jugadas registradas.</td></tr>';
            } else {
                listaJugadas.forEach(j => {
                    const num = j.numero || j.num1 || '--';
                    const tipo = String(j.tipo || 'Directo').toUpperCase();
                    const monto = parseFloat(j.monto || j.amount || j.monto_apostado || 0);
                    const premio = parseFloat(j.premio || j.monto_premio || 0);
                    
                    // Suma matemática en vivo para evitar descuadres de la base de datos
                    sumaApostadoReal += monto;
                    sumaPremioReal += premio;

                    const esGanador = premio > 0;
                    filasHTML += `
                        <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-700/30">
                            <td class="p-2.5 text-center font-black text-white tracking-widest">${num}</td>
                            <td class="p-2.5 text-center text-cyan-300 font-semibold">${tipo}</td>
                            <td class="p-2.5 text-center text-emerald-400 font-mono">$${monto.toFixed(2)}</td>
                            <td class="p-2.5 text-center font-mono font-bold ${esGanador ? 'text-amber-400' : 'text-slate-500'}">$${premio.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            // Validar Estado Real basado en los cálculos vivos
            let estadoReal = sumaPremioReal > 0 ? 'PREMIADO' : (ticket.estatus || ticket.estado || 'PENDIENTE').toUpperCase();
            if (['CANCELADO', 'ANULADO'].includes((ticket.estatus || ticket.estado || '').toUpperCase())) {
                estadoReal = (ticket.estatus || ticket.estado).toUpperCase();
            }

            // 5. Dibujar el Modal
            const modalPrevio = document.getElementById('modal-desglose-puro');
            if (modalPrevio) modalPrevio.remove();

            const modalHTML = `
                <div id="modal-desglose-puro" class="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        
                        <div class="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                            <h3 class="text-white font-bold text-base flex items-center">
                                <i class="fa-solid fa-eye text-cyan-400 mr-2"></i> Detalle de Jugadas
                            </h3>
                            <button onclick="document.getElementById('modal-desglose-puro').remove()" class="text-slate-400 hover:text-rose-400 transition text-lg px-2">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        
                        <div class="p-4 bg-slate-800/50 grid grid-cols-2 gap-3 border-b border-slate-700/50 text-xs">
                            <div>
                                <span class="text-slate-400 font-bold">Folio:</span> <strong class="text-cyan-400 font-mono">${ticket.codigo_ticket || ticket.folio || 'BX'}</strong>
                            </div>
                            <div class="text-right">
                                <span class="text-slate-400 font-bold">Estado:</span> <strong class="${estadoReal === 'PREMIADO' ? 'text-amber-400' : 'text-slate-300'} uppercase">${estadoReal}</strong>
                            </div>
                            <!-- 🎯 AQUÍ SE MUESTRA EL SORTEO -->
                            <div class="col-span-2 pt-2 border-t border-slate-700/50 mt-1">
                                <span class="text-slate-400 font-bold">Sorteo:</span> <strong class="text-emerald-300 uppercase">${nombreSorteo}</strong>
                            </div>
                        </div>

                        <div class="overflow-y-auto max-h-60 bg-slate-900">
                            <table class="w-full">
                                <thead class="bg-slate-800 text-[10px] text-slate-400 uppercase sticky top-0">
                                    <tr>
                                        <th class="p-2 text-center">Número</th>
                                        <th class="p-2 text-center">Tipo</th>
                                        <th class="p-2 text-center">Apostado</th>
                                        <th class="p-2 text-center">Premio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filasHTML}
                                </tbody>
                            </table>
                        </div>

                        <div class="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                            <div>
                                <span class="text-slate-400 text-[10px] uppercase font-bold">Total Venta:</span>
                                <p class="text-emerald-400 font-mono font-bold text-sm">$${sumaApostadoReal.toFixed(2)}</p>
                            </div>
                            <div class="text-right">
                                <span class="text-slate-400 text-[10px] uppercase font-bold">Total Premio:</span>
                                <p class="text-amber-400 font-mono font-black text-lg">$${sumaPremioReal.toFixed(2)}</p>
                            </div>
                        </div>

                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

        } catch (err) {
            console.error(err);
            alert("❌ No se pudo cargar el detalle: " + err.message);
        }
    };
}

    // Apagar todos los enlaces viejos y obligarlos a usar la función nueva
    window.reimpresionUnificadaPOS = (id) => window.buxyAccionTicket(id, 'ver');
    window.verTicketDetalleDirecto = (id) => window.buxyAccionTicket(id, 'ver');
    window.verTicketDetalle = (id) => window.buxyAccionTicket(id, 'ver');
    window.showTicketModal = (id) => window.buxyAccionTicket(id, 'ver');
    window.anularTicket = window.cancelarTicketDefinitivo;
}