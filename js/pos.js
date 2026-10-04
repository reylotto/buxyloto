// ==========================================================
// MÓDULO POS Y VENTA DELEGADA CON TICKET DIGITAL Y SUPABASE (js/pos.js)
// ==========================================================

// Variables globales para evitar 'ReferenceError' desde eventos HTML (oninput/onclick)
window.inputNumbers = '';
let inputNumbers = '';

// Variables globales de modalidad activa y apuestas
window.modoJuegoActual = window.modoJuegoActual || 'directo';
window.jugadasActuales = window.jugadasActuales || [];

// ----------------------------------------------------------
// 1. INICIALIZACIÓN DEL MÓDULO POS
// ----------------------------------------------------------
export function initPOSModule() {
    console.log("🚀 Módulo POS Inicializado correctamente.");
    ejecutarCargaConReintento();
    cargarSorteosPOS();
    activarEventosPOS();
}
window.initPOSModule = initPOSModule;

function ejecutarCargaConReintento(intentos = 0) {
    cargarListaVendedores().then(cargados => {
        if (!cargados && intentos < 5) {
            setTimeout(() => ejecutarCargaConReintento(intentos + 1), 500);
        }
    });
}

// ----------------------------------------------------------
// 2. CONTROL DE MODALIDAD Y LÍMITE DE DÍGITOS
// ----------------------------------------------------------
export function obtenerLimiteActualPOS() {
    const modo = (window.modoJuegoActual || 'directo').toLowerCase();
    if (modo.includes('pale') || modo.includes('palé')) return 4;
    if (modo.includes('tripleta')) return 6;
    return 2; // Directo por defecto
}
window.obtenerLimiteActualPOS = obtenerLimiteActualPOS;

export function setModoPOS(modo) {
    const m = String(modo).toLowerCase();
    window.modoJuegoActual = m;

    const inputNum = document.getElementById('pos-input-numbers');
    if (inputNum) {
        inputNum.value = ''; // Limpiar entrada
        
        // Ajustar maxlength del HTML permitiendo guiones adicionales (ej. 12-34 o 12-34-56)
        if (m.includes('pale') || m.includes('palé')) {
            inputNum.maxLength = 5; // 4 dígitos + 1 guión
        } else if (m.includes('tripleta')) {
            inputNum.maxLength = 8; // 6 dígitos + 2 guiones
        } else {
            inputNum.maxLength = 2; // Directo (2 dígitos)
        }
    }
    console.log(`🎮 Modo POS activo: ${window.modoJuegoActual.toUpperCase()}`);
}
window.setModoPOS = setModoPOS;

export function validarJugadaCompleta(num, modo) {
    const digitos = String(num || '').replace(/\D/g, '');
    const m = (modo || window.modoJuegoActual || 'directo').toLowerCase();
    let requeridos = 2;
    let nombreModo = "Directo";

    if (m.includes('pale') || m.includes('palé')) {
        requeridos = 4;
        nombreModo = "Palé";
    } else if (m.includes('tripleta')) {
        requeridos = 6;
        nombreModo = "Tripleta";
    }

    if (digitos.length !== requeridos) {
        alert(`⚠️ JUGADA INCOMPLETA: Un ${nombreModo} debe tener EXACTAMENTE ${requeridos} dígitos.`);
        return false;
    }
    return true;
}
window.validarJugadaCompleta = validarJugadaCompleta;

// ----------------------------------------------------------
// 3. CARGA DE VENDEDORES Y BANCAS
// ----------------------------------------------------------
export async function cargarListaVendedores() {
    const selectVendedor = document.getElementById('select-vendedor-asignado');
    if (!selectVendedor) return false;

    try {
        const supabase = window.supabase;
        if (!supabase) return false;

        const { data: bancasActivas, error } = await supabase
            .from('bancas')
            .select('*')
            .eq('estatus', 'activo');

        if (error) throw error;

        if (bancasActivas && bancasActivas.length > 0) {
            window._bancasCache = bancasActivas;
            selectVendedor.innerHTML = '<option value="">-- Registrar a mi nombre (Administrador) --</option>';
            bancasActivas.forEach(b => {
                const nombreBanca = b.nombre_banca || 'Banca';
                const operador = b.operador || b.email || `ID #${b.id}`;
                const option = document.createElement('option');
                option.value = b.id;
                option.textContent = `🏪 ${nombreBanca} (${operador})`;
                selectVendedor.appendChild(option);
            });
            return true;
        } else {
            selectVendedor.innerHTML = '<option value="">No hay bancas activas disponibles</option>';
        }
    } catch (err) {
        console.error("❌ Error cargando bancas activas:", err.message);
    }
    return false;
}
window.cargarListaVendedores = cargarListaVendedores;

export function obtenerIdVendedorAsignado() {
    const selectVendedor = document.getElementById('select-vendedor-asignado');
    if (!selectVendedor || !selectVendedor.value) {
        return window.currentUserProfile?.id || null;
    }
    return selectVendedor.value;
}
window.obtenerIdVendedorAsignado = obtenerIdVendedorAsignado;

// ----------------------------------------------------------
// 4. CARGA DE SORTEOS EN LA INTERFAZ DE VENTA POS
// ----------------------------------------------------------
export async function cargarSorteosPOS() {
    try {
        const supabase = window.supabase;
        if (!supabase) return;

        const { data: sorteos, error } = await supabase
            .from('sorteos')
            .select('*')
            .order('hora_cierre', { ascending: true });

        const contCheckboxes = document.getElementById('pos-loterias-checkboxes');
        if (!contCheckboxes) return;

        contCheckboxes.innerHTML = '';

        if (error || !sorteos || sorteos.length === 0) {
            contCheckboxes.innerHTML = '<p class="text-slate-400 text-xs p-2 col-span-full">No hay sorteos creados.</p>';
            return;
        }

        const ahora = new Date();

        const sorteosDisponibles = sorteos.filter(s => {
            const estatus = String(s.estatus || s.estado || '').toLowerCase();

            if (estatus === 'cerrado' || estatus === 'finalizado' || estatus === 'escrutado') {
                return false;
            }

            const tieneP1 = s.p1 && String(s.p1).trim() !== '' && String(s.p1).trim() !== '--';
            const tienePremio = s.primer_premio && String(s.primer_premio).trim() !== '';
            if (tieneP1 || tienePremio) {
                return false;
            }

            if (s.hora_cierre) {
                const [horas, minutos] = s.hora_cierre.split(':');
                const fechaCierre = new Date();
                fechaCierre.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);

                if (ahora >= fechaCierre) {
                    return false;
                }
            }

            return true;
        });

        if (sorteosDisponibles.length === 0) {
            contCheckboxes.innerHTML = '<p class="text-slate-400 text-xs p-2 col-span-full">No hay sorteos activos disponibles para venta en este momento.</p>';
            return;
        }

        sorteosDisponibles.forEach(s => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700 cursor-pointer hover:border-emerald-500 transition-colors select-none';
            label.innerHTML = `
                <input type="checkbox" name="pos-sorteos-selected" value="${s.id}" data-nombre="${s.nombre}" class="w-4 h-4 text-emerald-500 rounded border-slate-600 focus:ring-emerald-500">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white">${s.nombre}</span>
                    <span class="text-[10px] text-slate-400">🕒 ${s.hora_apertura || '--'} - ${s.hora_cierre || '--'}</span>
                </div>
            `;
            contCheckboxes.appendChild(label);
        });

        contCheckboxes.removeEventListener('change', actualizarResumenSorteos);
        contCheckboxes.addEventListener('change', actualizarResumenSorteos);

    } catch (err) {
        console.error("❌ Error al cargar sorteos en POS:", err.message);
    }
}
window.cargarSorteosPOS = cargarSorteosPOS;
window.renderizarSorteosPOS = cargarSorteosPOS;

function actualizarResumenSorteos() {
    const seleccionados = document.querySelectorAll('input[name="pos-sorteos-selected"]:checked');
    const countEl = document.getElementById('cart-loteria-count');
    const namesEl = document.getElementById('cart-selected-loterias-names');

    if (countEl) countEl.textContent = `${seleccionados.length} sorteo(s)`;
    if (namesEl) {
        if (seleccionados.length === 0) {
            namesEl.textContent = 'Ninguno seleccionado';
        } else {
            const nombres = Array.from(seleccionados).map(cb => cb.dataset.nombre).join(', ');
            namesEl.textContent = nombres;
        }
    }
}
window.actualizarResumenSorteos = actualizarResumenSorteos;

// ----------------------------------------------------------
// 5. GESTIÓN DEL CARRITO DE JUGADAS LOCAL
// ----------------------------------------------------------
function agregarJugadaAlCarrito(e) {
    if (e) e.preventDefault();
    const inputNumero = document.getElementById('pos-input-numbers');
    const inputMonto = document.getElementById('pos-input-amount');

    const num = inputNumero ? inputNumero.value.trim() : '';
    const mnt = inputMonto ? parseFloat(inputMonto.value) : 0;
    const modo = window.modoJuegoActual || 'directo';

    if (!num) {
        alert("⚠️ Ingrese un número para la jugada.");
        return;
    }

    if (!validarJugadaCompleta(num, modo)) {
        return;
    }

    if (isNaN(mnt) || mnt <= 0) {
        alert("⚠️ Ingrese un monto válido.");
        return;
    }

    window.jugadasActuales.push({ 
        numero: num, 
        monto: mnt,
        tipo: modo
    });

    if (inputNumero) inputNumero.value = '';
    renderizarCarrito();
}
window.agregarJugadaAlCarrito = agregarJugadaAlCarrito;

function renderizarCarrito() {
    const container = document.getElementById('pos-cart-items-container');
    const totalEl = document.getElementById('pos-cart-total');
    const countEl = document.getElementById('pos-cart-count');

    if (!container) return;

    if (window.jugadasActuales.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-xs">
                <i class="fa-solid fa-ticket text-3xl mb-2 text-slate-600 block"></i>
                No hay jugadas añadidas en este ticket.
            </div>`;
        if (totalEl) totalEl.textContent = '$0.00';
        if (countEl) countEl.textContent = '0';
        return;
    }

    let html = '';
    let total = 0;

    window.jugadasActuales.forEach((j, idx) => {
        total += j.monto;
        html += `
            <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-xs">
                <div>
                    <span class="font-mono font-bold text-emerald-400 text-sm">#${j.numero}</span>
                    <span class="text-[10px] text-slate-400 uppercase ml-2">(${j.tipo || 'directo'})</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-mono font-bold text-white">$${j.monto.toFixed(2)}</span>
                    <button type="button" onclick="eliminarJugada(${idx})" class="text-rose-400 hover:text-rose-300">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>`;
    });

    container.innerHTML = html;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    if (countEl) countEl.textContent = window.jugadasActuales.length.toString();
}
window.renderizarCarrito = renderizarCarrito;

window.eliminarJugada = function(index) {
    window.jugadasActuales.splice(index, 1);
    renderizarCarrito();
};

// ----------------------------------------------------------
// 6. TECLADO NUMÉRICO ANTI-DUPLICACIÓN (MANDATORIO)
// ----------------------------------------------------------
let ultimoToqueTeclado = 0;

if (!window.posKeypadGlobalHandlerInit) {
    window.posKeypadGlobalHandlerInit = true;

    // Listener global en fase de captura para evitar duplicados táctiles
    document.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.pos-keypad-btn, #btn-pos-clear-input');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const ahora = Date.now();
        if (ahora - ultimoToqueTeclado < 220) return; // Anti-doble pulsación (220ms)
        ultimoToqueTeclado = ahora;

        const inputNum = document.getElementById('pos-input-numbers');
        if (!inputNum) return;

        if (btn.id === 'btn-pos-clear-input') {
            inputNum.value = '';
            return;
        }

        const maxDigitos = obtenerLimiteActualPOS();
        const action = btn.dataset.action;
        const val = btn.textContent.trim();
        const soloNumeros = inputNum.value.replace(/\D/g, '');

        if (action === 'backspace') {
            inputNum.value = inputNum.value.slice(0, -1);
        } else if (action === 'dash') {
            if (inputNum.value.length > 0 && !inputNum.value.endsWith('-')) {
                inputNum.value += '-';
            }
        } else if (!action) {
            if (soloNumeros.length < maxDigitos) {
                inputNum.value += val;
            }
        }
    }, { capture: true });

    // Cancelar el clic tradicional que los celulares emiten tras pointerdown
    document.addEventListener('click', (e) => {
        if (e.target.closest('.pos-keypad-btn, #btn-pos-clear-input')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, { capture: true });
}

// ----------------------------------------------------------
// 7. ACTIVACIÓN DE EVENTOS E INTERFAZ POS
// ----------------------------------------------------------
export function activarEventosPOS() {
    // Escuchar cambio de modalidad en pestañas/selectores
    document.querySelectorAll('[data-modo], .tab-modo, .btn-modo, select#pos-select-modo').forEach(elem => {
        const cambiarModo = () => {
            const txt = (elem.value || elem.dataset.modo || elem.textContent || '').toLowerCase();
            if (txt.includes('pale') || txt.includes('palé')) setModoPOS('pale');
            else if (txt.includes('tripleta')) setModoPOS('tripleta');
            else setModoPOS('directo');
        };

        elem.removeEventListener('click', cambiarModo);
        elem.removeEventListener('change', cambiarModo);
        elem.addEventListener('click', cambiarModo);
        elem.addEventListener('change', cambiarModo);
    });

    // Botón Agregar Jugada (+ / Agregar)
    const btnAdd = document.getElementById('btn-pos-add-item') || document.getElementById('btn-pos-add') || document.getElementById('btn-agregar-jugada');
    if (btnAdd) {
        const newBtnAdd = btnAdd.cloneNode(true);
        btnAdd.replaceWith(newBtnAdd);
        newBtnAdd.addEventListener('click', agregarJugadaAlCarrito);
    }

    // Botón Marcar Todos los Sorteos
    const btnSelectAll = document.getElementById('btn-select-all-loterias');
    if (btnSelectAll) {
        btnSelectAll.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = true);
            actualizarResumenSorteos();
        };
    }

    // Botón Limpiar Sorteos
    const btnClearAll = document.getElementById('btn-clear-all-loterias');
    if (btnClearAll) {
        btnClearAll.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
            actualizarResumenSorteos();
        };
    }

    // Botón Vaciar Carrito
    const btnClearCart = document.getElementById('btn-pos-clear-cart');
    if (btnClearCart) {
        btnClearCart.onclick = (e) => {
            e.preventDefault();
            window.jugadasActuales = [];
            renderizarCarrito();
        };
    }

    // Botones de Monto Rápido
    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const amt = btn.dataset.amt;
            const inputAmount = document.getElementById('pos-input-amount');
            if (inputAmount && amt) inputAmount.value = amt;
        };
    });

    // Botón Principal: EMITIR TICKET
    const btnEmitir = document.getElementById('btn-pos-process-ticket');
    if (btnEmitir) {
        const newBtnEmitir = btnEmitir.cloneNode(true);
        btnEmitir.replaceWith(newBtnEmitir);
        newBtnEmitir.addEventListener('click', (e) => {
            e.preventDefault();
            window.guardarTicketEnSupabase(false);
        });
    }
}
window.activarEventosPOS = activarEventosPOS;

// ----------------------------------------------------------
// 8. REGISTRO Y EMISIÓN EN SUPABASE
// ----------------------------------------------------------
window.guardarTicketEnSupabase = async function(enviarPorWhatsApp = false) {
    const supabase = window.supabase;
    if (!supabase) {
        alert("❌ Error: Supabase no está conectado.");
        return;
    }

    // A. Capturar Sorteos Seleccionados
    const checkboxesCheck = document.querySelectorAll('input[name="pos-sorteos-selected"]:checked');
    if (checkboxesCheck.length === 0) {
        alert("⚠️ Debe seleccionar al menos UN sorteo para emitir el ticket.");
        return;
    }
    
    const sorteosSeleccionados = Array.from(checkboxesCheck).map(cb => ({
        id: cb.value,
        nombre: cb.dataset.nombre || 'Sorteo'
    }));

    // B. Capturar Jugadas (del carrito o entrada manual actual)
    let jugadas = [...window.jugadasActuales];
    if (jugadas.length === 0) {
        const inputNum = document.getElementById('pos-input-numbers');
        const inputMnt = document.getElementById('pos-input-amount');
        const num = inputNum ? inputNum.value.trim() : '';
        const mnt = inputMnt ? parseFloat(inputMnt.value) : 0;
        const modo = window.modoJuegoActual || 'directo';

        if (num && mnt > 0) {
            if (!validarJugadaCompleta(num, modo)) {
                return;
            }
            jugadas.push({ numero: num, monto: mnt, tipo: modo });
        }
    }

    if (jugadas.length === 0) {
        alert("⚠️ Añada al menos una jugada con su monto antes de emitir.");
        return;
    }

    const idBanca = obtenerIdVendedorAsignado();
    const montoTotal = jugadas.reduce((sum, j) => sum + parseFloat(j.monto || 0), 0);
    const ticketsProcesados = [];
    let ultimoTicketGuardado = null; // Guardamos la referencia para el modal

    const btnEmitir = document.getElementById('btn-pos-process-ticket');
    if (btnEmitir) btnEmitir.disabled = true;

    try {
        for (const sItem of sorteosSeleccionados) {
            const codigoTicket = "BX-" + Math.floor(Math.random() * 900000 + 100000);
            const sorteoIdParsed = isNaN(sItem.id) ? sItem.id : parseInt(sItem.id, 10);

            // Mapear el nombre del sorteo a cada jugada
            const jugadasConSorteo = jugadas.map(j => ({
                ...j,
                sorteo_nombre: sItem.nombre
            }));

            const payloadTicket = {
                codigo: codigoTicket,
                codigo_ticket: codigoTicket,
                sorteo_id: sorteoIdParsed,
                sorteo_nombre: sItem.nombre,
                monto: montoTotal,
                monto_total: montoTotal,
                total: montoTotal,
                detalles: jugadasConSorteo,
                jugadas: jugadasConSorteo,
                estatus: 'pendiente',
                estado: 'pendiente'
            };

            if (idBanca) {
                payloadTicket.usuario_id = idBanca;
                payloadTicket.vendedor_id = idBanca;
                payloadTicket.banca_id = idBanca;
            }

            console.log("📡 Registrando venta en Supabase:", payloadTicket);

            let response = await supabase.from('tickets').insert([payloadTicket]).select();
            let ticketGuardado = response.data ? response.data[0] : null;
            let error = response.error;

            if (error) {
                console.warn("Intentando esquema simplificado en 'tickets':", error.message);
                const payloadLimpio = {
                    codigo_ticket: codigoTicket,
                    sorteo_id: sorteoIdParsed,
                    sorteo_nombre: sItem.nombre,
                    monto_total: montoTotal,
                    detalles: jugadasConSorteo,
                    estatus: 'pendiente'
                };
                if (idBanca) payloadLimpio.vendedor_id = idBanca;

                const res2 = await supabase.from('tickets').insert([payloadLimpio]).select();
                if (!res2.error) {
                    error = null;
                    ticketGuardado = res2.data ? res2.data[0] : null;
                } else {
                    console.warn("Intentando en tabla 'ventas':", res2.error.message);
                    const resVentas = await supabase.from('ventas').insert([payloadLimpio]).select();
                    if (!resVentas.error) {
                        error = null;
                        ticketGuardado = resVentas.data ? resVentas.data[0] : null;
                    } else {
                        error = resVentas.error;
                    }
                }
            }

            if (error) {
                console.error("❌ Error de Supabase al guardar:", error);
                alert(`❌ Error al guardar en Supabase:\n${error.message}\n${error.details || ''}`);
                return;
            }

            if (ticketGuardado && ticketGuardado.id) {
                const idTicketNum = parseInt(ticketGuardado.id, 10);

                const filasJugadas = jugadas.map(j => ({
                    ticket_id: idTicketNum,
                    numero: String(j.numero),
                    monto: Number(j.monto) || 0,
                    tipo: j.tipo || 'directo',
                    estatus: 'pendiente'
                }));

                try {
                    let resJugadas = await supabase.from('jugadas').insert(filasJugadas);

                    if (resJugadas.error) {
                        const filasLimpias = jugadas.map(j => ({
                            ticket_id: idTicketNum,
                            numero: String(j.numero),
                            monto: Number(j.monto) || 0,
                            tipo: j.tipo || 'directo'
                        }));
                        resJugadas = await supabase.from('jugadas').insert(filasLimpias);
                    }

                    if (resJugadas.error) {
                        console.warn("Aviso (Tabla jugadas auxiliar):", resJugadas.error.message);
                    }
                } catch (errJugadas) {
                    console.warn("Aviso (Tabla jugadas auxiliar):", errJugadas.message);
                }
            }

            // Guardamos el objeto ticket enriquecido para enviarlo a la plantilla
            ultimoTicketGuardado = ticketGuardado || payloadTicket;
            if (!ultimoTicketGuardado.sorteo_nombre) {
                ultimoTicketGuardado.sorteo_nombre = sItem.nombre;
            }

            ticketsProcesados.push({ codigo: codigoTicket, sorteo: sItem.nombre });
        }

        // Limpiar formulario y carrito
        window.jugadasActuales = [];
        if (typeof renderizarCarrito === 'function') renderizarCarrito();

        const inputNum = document.getElementById('pos-input-numbers');
        const inputMnt = document.getElementById('pos-input-amount');
        if (inputNum) inputNum.value = '';
        if (inputMnt) inputMnt.value = '';

        document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
        if (typeof actualizarResumenSorteos === 'function') actualizarResumenSorteos();

        if (typeof window.cargarHistorialTickets === 'function') {
            window.cargarHistorialTickets();
        } else if (typeof window.cargarVentas === 'function') {
            window.cargarVentas();
        } else if (typeof window.cargarTablaHistorial === 'function') {
            window.cargarTablaHistorial();
        }

        // Invocación del Modal / Compartir
        if (enviarPorWhatsApp && ultimoTicketGuardado) {
            if (typeof compartirTicketWhatsApp === 'function') {
                compartirTicketWhatsApp(ultimoTicketGuardado);
            } else if (typeof window.compartirTicketWhatsApp === 'function') {
                window.compartirTicketWhatsApp(ultimoTicketGuardado);
            }
        } else if (typeof window.mostrarOpcionesExportacionTicket === 'function' && ultimoTicketGuardado) {
            window.mostrarOpcionesExportacionTicket(ultimoTicketGuardado);
        } else if (typeof mostrarOpcionesExportacionTicket === 'function' && ultimoTicketGuardado) {
            mostrarOpcionesExportacionTicket(ultimoTicketGuardado);
        } else {
            alert(`🎉 ¡Venta realizada con éxito!\n\n🎟️ Tickets generados: ${ticketsProcesados.length}\n💰 Total: $${montoTotal.toFixed(2)}`);
        }

    } catch (err) {
        console.error("❌ Error general al procesar la venta:", err);
        alert("❌ Error general al procesar la venta: " + err.message);
    } finally {
        if (btnEmitir) btnEmitir.disabled = false;
    }
};

/**
 * Cancela/Anula un ticket y todas sus jugadas asociadas en Supabase
 * @param {string|number} folioOrId Código de ticket (ej. BX-419776) o ID numérico
 */
export async function cancelarTicketPOS(folioOrId) {
    if (!folioOrId) {
        alert("Por favor seleccione un ticket válido para cancelar.");
        return;
    }

    const supabase = window.supabase;

    try {
        // 1. Consultar el ticket junto con la información/estado de su sorteo
        let ticketData = null;
        if (supabase) {
            const esNumeroPuro = !isNaN(folioOrId) && !isNaN(parseFloat(folioOrId));
            let queryFilter = `codigo_ticket.eq.${folioOrId},folio.eq.${folioOrId}`;
            if (esNumeroPuro) queryFilter += `,id.eq.${folioOrId}`;

            const { data, error } = await supabase
                .from('tickets')
                .select('*, sorteos(estatus, estado, hora_cierre)')
                .or(queryFilter)
                .maybeSingle();

            if (error) console.warn("Error al verificar estado del sorteo:", error);
            ticketData = data;
        }

        // 2. Validar si el sorteo ya cerró
        if (ticketData) {
            const estadoSorteo = (ticketData.sorteos?.estatus || ticketData.sorteos?.estado || '').toLowerCase();
            const horaCierre = ticketData.sorteos?.hora_cierre ? new Date(ticketData.sorteos.hora_cierre) : null;
            const yaPasoHora = horaCierre && new Date() >= horaCierre;

            if (estadoSorteo === 'cerrado' || estadoSorteo === 'finalizado' || yaPasoHora) {
                alert("❌ No se puede cancelar el ticket: El sorteo ya ha cerrado o finalizado.");
                return;
            }

            if ((ticketData.estatus || '').toLowerCase() === 'cancelado') {
                alert("El ticket ya se encuentra cancelado.");
                return;
            }
        }

        const confirmacion = confirm(`¿Está seguro de que desea cancelar el ticket ${folioOrId}? El registro permanecerá visible como cancelado.`);
        if (!confirmacion) return;

        // 3. Proceder con el marcado a 'cancelado' (sin eliminar filas)
        if (supabase) {
            const payload = { 
                estatus: 'cancelado',
                status: 'cancelado',
                estado: 'cancelado',
                updated_at: new Date().toISOString()
            };

            const esNumeroPuro = !isNaN(folioOrId) && !isNaN(parseFloat(folioOrId));
            let queryFilter = `codigo_ticket.eq.${folioOrId},folio.eq.${folioOrId}`;
            if (esNumeroPuro) queryFilter += `,id.eq.${folioOrId}`;

            // Marcar ticket como cancelado
            const { data: ticketsCancelados, error: errTicket } = await supabase
                .from('tickets')
                .update(payload)
                .or(queryFilter)
                .select();

            if (!errTicket && ticketsCancelados?.length > 0) {
                // Marcar jugadas asociadas como canceladas
                const idsTicket = ticketsCancelados.map(t => t.id);
                await supabase
                    .from('jugadas')
                    .update({ estatus: 'cancelado', estado: 'cancelado' })
                    .in('ticket_id', idsTicket);

                alert(`✅ Ticket ${folioOrId} marcado como CANCELADO exitosamente.`);
            } else {
                alert("No se pudo procesar la cancelación en la base de datos.");
                return;
            }
        }

        // 4. Actualizar vista e historiales
        if (typeof window.cargarHistorialTickets === 'function') window.cargarHistorialTickets();
        if (typeof window.actualizarResumenDashboard === 'function') window.actualizarResumenDashboard();

    } catch (err) {
        console.error("❌ Error al procesar cancelación:", err);
        alert("Ocurrió un error inesperado al validar o cancelar el ticket.");
    }
}

// ==========================================================
// FUNCIONES DE EXPORTACIÓN Y COMPARTIDO DE TICKETS (POS)
// ==========================================================

export function imprimirTicketTermica() {
    window.print();
}

export async function generarImagenTicket(ticketElementId = 'ticket-print-area') {
    const ticketElem = document.getElementById(ticketElementId);
    if (!ticketElem) {
        alert("No se encontró la plantilla del ticket para generar la imagen.");
        return null;
    }

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        });
        return canvas.toDataURL("image/png");
    } catch (err) {
        console.error("Error al generar la imagen del ticket:", err);
        return null;
    }
}

export async function compartirTicketWhatsApp(ticketData, numeroTelefono = '') {
    const dataUrl = await generarImagenTicket();
    
    if (dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `Ticket_${ticketData.codigo_ticket || 'POS'}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: `Ticket ${ticketData.codigo_ticket}`,
                    text: `Aquí tienes tu ticket de jugada #${ticketData.codigo_ticket}`
                });
                return;
            } catch (e) {
                console.log("Compartido nativo no completado:", e);
            }
        }
    }

    const mensajeText = encodeURIComponent(
        `*TICKET DE JUGADA #${ticketData.codigo_ticket || ticketData.folio || ''}*\n` +
        `Total: $${parseFloat(ticketData.monto_total || 0).toFixed(2)}\n\n` +
        `¡Gracias por su compra!`
    );
    
    const url = numeroTelefono 
        ? `https://api.whatsapp.com/send?phone=${numeroTelefono}&text=${mensajeText}`
        : `https://api.whatsapp.com/send?text=${mensajeText}`;
        
    window.open(url, '_blank');
}

export async function descargarPDFTicket(ticketData, ticketElementId = 'ticket-print-area') {
    const dataUrl = await generarImagenTicket(ticketElementId);
    if (!dataUrl) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 200]
    });

    doc.addImage(dataUrl, 'PNG', 0, 0, 80, 0);
    doc.save(`Ticket_${ticketData.codigo_ticket || 'POS'}.pdf`);
}

export function mostrarOpcionesExportacionTicket(ticketData) {
    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modal-export-ticket" class="modal-overlay-ticket">
            <div class="modal-content-ticket">
                <h3>Ticket #${ticketData.codigo_ticket || ticketData.folio || ''}</h3>
                <p style="font-size: 13px; color: #64748b;">¿Cómo desea entregar el comprobante?</p>
                
                <div class="modal-buttons-grid">
                    <button id="btn-print-thermal" style="background:#0284c7; color:#fff; padding:10px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                        🖨️ Imprimir Térmica (80mm)
                    </button>
                    <button id="btn-share-wapp" style="background:#22c55e; color:#fff; padding:10px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                        📲 Compartir Imagen (WhatsApp)
                    </button>
                    <button id="btn-download-pdf" style="background:#475569; color:#fff; padding:10px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                        📄 Descargar PDF
                    </button>
                </div>

                <button id="btn-close-modal-export" style="margin-top: 15px; background: transparent; border: none; color: #ef4444; cursor: pointer; font-weight: bold;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-print-thermal').onclick = () => window.print();
    document.getElementById('btn-share-wapp').onclick = () => compartirTicketWhatsApp(ticketData);
    document.getElementById('btn-download-pdf').onclick = () => descargarPDFTicket(ticketData);
    document.getElementById('btn-close-modal-export').onclick = () => {
        const modal = document.getElementById('modal-export-ticket');
        if (modal) modal.remove();
    };
}

// 🌐 Asignar explícitamente a window para compatibilidad global
window.cancelarTicketPOS = cancelarTicketPOS;
window.imprimirTicketTermica = imprimirTicketTermica;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;