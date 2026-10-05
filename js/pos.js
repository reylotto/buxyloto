// ==========================================================
// MÓDULO POS Y VENTA DELEGADA CON TICKET DIGITAL Y SUPABASE (js/pos.js)
// ==========================================================

import {
    renderizarPlantillaTicket,
    generarImagenTicket as generarImagenTicketManager,
    imprimirTicketTermica as imprimirTermicaManager,
    compartirTicketWhatsApp as compartirWhatsAppManager,
    descargarPDFTicket as descargarPDFManager,
    mostrarOpcionesExportacionTicket as mostrarOpcionesManager,
    anularOTicketCancelado
} from './ticketManager.js';

// Estado global de la venta activa
window.modoJuegoActual = window.modoJuegoActual || 'directo';
window.jugadasActuales = window.jugadasActuales || [];
window.ultimoMontoIngresado = window.ultimoMontoIngresado || null;

// Exponer la función globalmente para su uso desde cualquier parte del flujo del POS
window.anularOTicketCancelado = anularOTicketCancelado;

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
    return 2;
}
window.obtenerLimiteActualPOS = obtenerLimiteActualPOS;

export function setModoPOS(modo) {
    const m = String(modo).toLowerCase();
    window.modoJuegoActual = m;

    const inputNum = document.getElementById('pos-input-numbers') || document.querySelector('input[placeholder*="Número"]');
    if (inputNum) {
        inputNum.value = '';
        if (m.includes('pale') || m.includes('palé')) inputNum.maxLength = 5;
        else if (m.includes('tripleta')) inputNum.maxLength = 8;
        else inputNum.maxLength = 2;
    }
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
    const selectVendedor = document.getElementById('select-vendedor-asignado') || document.getElementById('pos-select-banca');
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
                const nombreBanca = b.nombre_banca || b.nombre || 'Banca';
                const operador = b.operador || b.email || `ID #${b.id}`;
                const option = document.createElement('option');
                option.value = b.id;
                option.dataset.uuid = b.usuario_id || b.vendedor_id || '';
                option.textContent = `🏪 ${nombreBanca} (${operador})`;
                selectVendedor.appendChild(option);
            });
            return true;
        }
    } catch (err) {
        console.error("❌ Error cargando bancas activas:", err.message);
    }
    return false;
}
window.cargarListaVendedores = cargarListaVendedores;

export function obtenerNombreBancaActual() {
    const selectBanca = document.getElementById('select-vendedor-asignado') || 
                        document.querySelector('select[name="pos-banca-destino"]') || 
                        document.getElementById('pos-select-banca');

    if (selectBanca && selectBanca.options && selectBanca.selectedIndex !== -1) {
        const txt = selectBanca.options[selectBanca.selectedIndex].text.trim();
        if (txt && !txt.includes('--')) {
            return txt.split('(')[0].trim();
        }
    }

    try {
        const sesionUser = JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        if (sesionUser.banca || sesionUser.nombre) {
            return sesionUser.banca || sesionUser.nombre;
        }
    } catch (e) {}

    return 'Banca Principal';
}
window.obtenerNombreBancaActual = obtenerNombreBancaActual;

// ----------------------------------------------------------
// 4. CARGA DE SORTEOS EN POS
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
            if (estatus === 'cerrado' || estatus === 'finalizado' || estatus === 'escrutado') return false;

            if (s.hora_cierre) {
                const [horas, minutos] = s.hora_cierre.split(':');
                const fechaCierre = new Date();
                fechaCierre.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);
                if (ahora >= fechaCierre) return false;
            }
            return true;
        });

        if (sorteosDisponibles.length === 0) {
            contCheckboxes.innerHTML = '<p class="text-slate-400 text-xs p-2 col-span-full">No hay sorteos activos disponibles.</p>';
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
// 5. AGREGAR JUGADA Y RENDERIZAR EN TIEMPO REAL
// ----------------------------------------------------------
export function agregarJugadaAlCarrito() {
    const inputNum = document.getElementById('pos-input-numbers') || document.querySelector('input[placeholder*="Número"]');
    const inputMnt = document.getElementById('pos-input-amount') || document.querySelector('input[placeholder*="Monto"]');

    if (!inputNum || !inputMnt) {
        alert("⚠️ No se encontraron las cajas de entrada de número o monto.");
        return;
    }

    const numero = inputNum.value.trim();
    const monto = parseFloat(inputMnt.value);

    const checkboxesCheck = document.querySelectorAll('input[name="pos-sorteos-selected"]:checked');
    if (checkboxesCheck.length === 0) {
        alert("⚠️ Seleccione al menos un sorteo antes de agregar la jugada.");
        return;
    }

    if (isNaN(monto) || monto <= 0) {
        alert("⚠️ Ingrese un monto válido mayor a 0.");
        inputMnt.focus();
        return;
    }

    const numLen = numero.replace(/\D/g, '').length;
    let tipo = window.modoJuegoActual || 'directo';

    if (numLen === 2) tipo = 'directo';
    else if (numLen === 4) tipo = 'pale';
    else if (numLen === 6) tipo = 'tripleta';
    else {
        alert("⚠️ La cantidad de dígitos no corresponde a una jugada válida (2 dígitos = Directo, 4 = Palé, 6 = Tripleta).");
        inputNum.focus();
        return;
    }

    window.ultimoMontoIngresado = monto;

    checkboxesCheck.forEach(cb => {
        const labelText = cb.closest('label')?.textContent?.trim() || cb.nextElementSibling?.textContent?.trim() || 'SORTEO';
        const nombreSorteo = (cb.dataset.nombre || labelText).replace(/[\n\r]+/g, ' ').trim().toUpperCase();

        window.jugadasActuales.push({
            id: Date.now() + Math.random(),
            numero: numero,
            monto: monto,
            tipo: tipo,
            sorteo_id: cb.value ? parseInt(cb.value, 10) : null,
            sorteo_nombre: nombreSorteo
        });
    });

    inputNum.value = '';
    inputMnt.value = window.ultimoMontoIngresado.toFixed(2);
    inputNum.focus();

    renderizarCarrito();
}
window.agregarJugadaAlCarrito = agregarJugadaAlCarrito;

export function renderizarCarrito() {
    let totalMonto = 0;
    const cantidadJugadas = window.jugadasActuales ? window.jugadasActuales.length : 0;

    // Buscar contenedor de la lista en HTML
    let areaLista = document.getElementById('ticket-actual-list') || 
                    document.querySelector('.ticket-actual-list') ||
                    document.querySelector('[data-ticket-list]');

    if (!areaLista) {
        const posibles = document.querySelectorAll('div, section, aside');
        for (let el of posibles) {
            if (el.textContent && (el.textContent.includes('TOTAL A PAGAR') || el.textContent.includes('Cantidad de apuestas') || el.textContent.includes('Cantidad de jugadas'))) {
                areaLista = el.querySelector('.space-y-2') || el.querySelector('.overflow-y-auto') || el;
                if (areaLista) break;
            }
        }
    }

    if (areaLista) {
        areaLista.innerHTML = '';

        if (cantidadJugadas === 0) {
            areaLista.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 25px 10px; font-size: 13px;">
                    <div style="font-size: 22px; margin-bottom: 6px; opacity: 0.5;">📋</div>
                    No hay jugadas añadidas
                </div>`;
        } else {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;';

            window.jugadasActuales.forEach((j, index) => {
                const mnt = parseFloat(j.monto || 0);
                totalMonto += mnt;

                const itemRow = document.createElement('div');
                itemRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #ffffff;';

                itemRow.innerHTML = `
                    <div style="flex: 1; text-align: left;">
                        <div style="font-size: 10px; color: #38bdf8; font-weight: bold;">[${j.sorteo_nombre}]</div>
                        <div style="margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                            <strong style="color: #facc15; font-size: 14px; font-family: monospace;">#${j.numero}</strong> 
                            <span style="font-size: 9px; text-transform: uppercase; background: #0f172a; color: #cbd5e1; padding: 1px 5px; border-radius: 3px; border: 1px solid #475569;">${j.tipo}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: bold; color: #10b981; font-size: 14px; font-family: monospace;">$${mnt.toFixed(2)}</span>
                        <button type="button" data-index="${index}" class="btn-eliminar-jugada" style="background: #ef4444; color: #ffffff; border: none; border-radius: 4px; width: 22px; height: 22px; cursor: pointer; font-size: 11px; font-weight: bold;">✕</button>
                    </div>
                `;

                const btnBorrar = itemRow.querySelector('.btn-eliminar-jugada');
                btnBorrar.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.eliminarJugadaCarrito(index);
                };

                wrapper.appendChild(itemRow);
            });

            areaLista.appendChild(wrapper);
        }
    } else {
        window.jugadasActuales.forEach(j => totalMonto += parseFloat(j.monto || 0));
    }

    // Actualizar Totales en HTML
    const totalFormatted = `$${totalMonto.toFixed(2)}`;
    const elTotales = document.querySelectorAll('#lbl-total-pagar, .lbl-total-pagar, [data-total-pagar], .total-pagar-monto, h2, span, div');
    
    elTotales.forEach(el => {
        if (el.textContent && (el.textContent.includes('TOTAL A PAGAR:') || el.classList?.contains('total-pagar-monto'))) {
            const spanMonto = el.querySelector('span:last-child') || el;
            if (spanMonto && spanMonto !== el && spanMonto.children.length === 0) {
                spanMonto.textContent = totalFormatted;
            } else if (el.classList?.contains('total-pagar-monto')) {
                el.textContent = totalFormatted;
            }
        }
    });

    // Actualizar Cantidad de Apuestas en HTML
    const elCantidades = document.querySelectorAll('#lbl-cantidad-jugadas, .lbl-cantidad-jugadas, [data-cantidad-jugadas], .cantidad-jugadas-count, span, div');
    elCantidades.forEach(el => {
        if (el.textContent && el.textContent.includes('Cantidad de apuestas:')) {
            const spanCount = el.querySelector('span:last-child') || el;
            if (spanCount) spanCount.textContent = cantidadJugadas;
        }
    });
}
window.renderizarCarrito = renderizarCarrito;

export function eliminarJugadaCarrito(index) {
    if (window.jugadasActuales && window.jugadasActuales[index] !== undefined) {
        window.jugadasActuales.splice(index, 1);
        renderizarCarrito();
    }
}
window.eliminarJugadaCarrito = eliminarJugadaCarrito;

export function vaciarCarrito() {
    window.jugadasActuales = [];
    window.ultimoMontoIngresado = null;
    
    const inputNum = document.getElementById('pos-input-numbers') || document.querySelector('input[placeholder*="Número"]');
    const inputMnt = document.getElementById('pos-input-amount') || document.querySelector('input[placeholder*="Monto"]');
    if (inputNum) inputNum.value = '';
    if (inputMnt) inputMnt.value = '';

    renderizarCarrito();
}
window.vaciarCarrito = vaciarCarrito;

// ----------------------------------------------------------
// 6. REGISTRO Y EMISIÓN DE TICKET EN SUPABASE
// ----------------------------------------------------------
export async function guardarTicketEnSupabase(enviarPorWhatsApp = false) {
    const supabase = window.supabase;
    if (!supabase) {
        alert("❌ Error: Supabase no está conectado.");
        return;
    }

    const jugadasAProcesar = Array.isArray(window.jugadasActuales) && window.jugadasActuales.length > 0
        ? [...window.jugadasActuales]
        : [];

    if (jugadasAProcesar.length === 0) {
        alert("⚠️ No hay jugadas en la lista para registrar.");
        return;
    }

    const btnEmitir = document.getElementById('btn-pos-process-ticket') || document.getElementById('btn-procesar-ticket');
    if (btnEmitir) btnEmitir.disabled = true;

    try {
        let montoTotal = 0;
        const listaJugadas = jugadasAProcesar.map(j => {
            const mnt = parseFloat(j.monto || 0);
            montoTotal += mnt;
            return {
                numero: String(j.numero).trim(),
                monto: mnt,
                tipo: String(j.tipo || 'directo').toLowerCase(),
                sorteo_id: j.sorteo_id ? parseInt(j.sorteo_id, 10) : null,
                sorteo_nombre: j.sorteo_nombre || 'SORTEO'
            };
        });

        const sorteosIdsUnicos = [...new Set(listaJugadas.map(j => j.sorteo_id).filter(Boolean))];
        const sorteosNombresUnicos = [...new Set(listaJugadas.map(j => j.sorteo_nombre))].join(' / ');
        const codigoTicket = "BX-" + Math.floor(Math.random() * 900000 + 100000);
        const nombreBanca = typeof obtenerNombreBancaActual === 'function' ? obtenerNombreBancaActual() : 'Banca Principal';

        let usuarioId = null;
        let bancaId = null;
        try {
            const sesion = JSON.parse(localStorage.getItem('usuario_sesion') || localStorage.getItem('usuario') || '{}');
            usuarioId = sesion.id || sesion.user_id || sesion.uuid || null;
            bancaId = sesion.banca_id || null;
        } catch (e) {}

        // Payload de Ticket
        const payloadTicket = {
            codigo_ticket: codigoTicket,
            sorteo_id: sorteosIdsUnicos.length === 1 ? sorteosIdsUnicos[0] : null,
            sorteo_nombre: sorteosNombresUnicos,
            monto_total: parseFloat(montoTotal.toFixed(2)),
            monto: parseFloat(montoTotal.toFixed(2)),
            jugadas: listaJugadas,
            detalles: listaJugadas,
            estatus: 'pendiente',
            estado: 'pendiente',
            usuario_id: usuarioId,
            vendedor_id: usuarioId,
            banca_id: bancaId,
            vendedor: nombreBanca,
            banca_nombre: nombreBanca
        };

        // 1. Insertar Ticket
        const { data: ticketData, error: ticketError } = await supabase
            .from('tickets')
            .insert([payloadTicket])
            .select('*');

        if (ticketError) throw ticketError;

        const ticketCreado = (ticketData && ticketData.length > 0) ? ticketData[0] : null;
        if (!ticketCreado || !ticketCreado.id) {
            throw new Error("No se obtuvo el ID del ticket generado.");
        }

        // 2. Mapear e insertar en la tabla jugadas manteniendo el tipo de dato nativo del ID
        const registrosJugadas = listaJugadas.map(j => ({
            ticket_id: ticketCreado.id, // Mantiene la referencia nativa (UUID o INT) sin forzar parseInt
            numero: String(j.numero).trim(),
            monto: parseFloat(j.monto) || 0,
            tipo: String(j.tipo || 'directo').toLowerCase(),
            sorteo_id: j.sorteo_id || ticketCreado.sorteo_id || null
        }));

        const { error: jugadasError } = await supabase
            .from('jugadas')
            .insert(registrosJugadas);

        if (jugadasError) {
            console.error("❌ Error al insertar en tabla 'jugadas':", jugadasError);
            alert(`⚠️ El ticket fue guardado, pero ocurrió un error registrando las jugadas individuales: ${jugadasError.message}`);
        } else {
            console.log("✅ Jugadas sincronizadas con éxito en la tabla 'jugadas'.");
        }

        // Limpiar estado
        if (typeof vaciarCarrito === 'function') vaciarCarrito();
        document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
        if (typeof actualizarResumenSorteos === 'function') actualizarResumenSorteos();

        const ticketParaImprimir = {
            ...ticketCreado,
            banca_nombre: nombreBanca,
            detalles: listaJugadas,
            jugadas: listaJugadas
        };

        if (enviarPorWhatsApp) {
            if (typeof compartirWhatsAppManager === 'function') compartirWhatsAppManager(ticketParaImprimir);
        } else if (typeof mostrarOpcionesManager === 'function') {
            mostrarOpcionesManager(ticketParaImprimir);
        } else {
            alert(`✅ Ticket #${codigoTicket} procesado con éxito.`);
        }

    } catch (err) {
        console.error("❌ Error inesperado en la emisión:", err);
        alert("❌ Error al guardar ticket: " + (err.message || JSON.stringify(err)));
    } finally {
        if (btnEmitir) btnEmitir.disabled = false;
    }
}
window.guardarTicketEnSupabase = guardarTicketEnSupabase;

// ----------------------------------------------------------
// 7. EVENTOS E INTERACCIONES DE INTERFAZ
// ----------------------------------------------------------
export function activarEventosPOS() {
    const btnAdd = document.getElementById('btn-pos-add-item') || document.getElementById('btn-pos-add') || document.getElementById('btn-agregar-jugada') || document.querySelector('.btn-add-jugada');
    if (btnAdd) {
        btnAdd.onclick = (e) => {
            e.preventDefault();
            agregarJugadaAlCarrito();
        };
    }

    const btnEmitir = document.getElementById('btn-pos-process-ticket') || document.getElementById('btn-procesar-ticket');
    if (btnEmitir) {
        btnEmitir.onclick = (e) => {
            e.preventDefault();
            guardarTicketEnSupabase(false);
        };
    }

    const inputNum = document.getElementById('pos-input-numbers') || document.querySelector('input[placeholder*="Número"]');
    const inputMnt = document.getElementById('pos-input-amount') || document.querySelector('input[placeholder*="Monto"]');

    const manejarEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarJugadaAlCarrito();
        }
    };

    if (inputNum) inputNum.onkeydown = manejarEnter;
    if (inputMnt) inputMnt.onkeydown = manejarEnter;

    const btnSelectAll = document.getElementById('btn-select-all-loterias');
    if (btnSelectAll) {
        btnSelectAll.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = true);
            actualizarResumenSorteos();
        };
    }

    const btnClearAll = document.getElementById('btn-clear-all-loterias');
    if (btnClearAll) {
        btnClearAll.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
            actualizarResumenSorteos();
        };
    }

    const btnClearCart = document.getElementById('btn-pos-clear-cart');
    if (btnClearCart) {
        btnClearCart.onclick = (e) => {
            e.preventDefault();
            vaciarCarrito();
        };
    }

    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const amt = btn.dataset.amt;
            if (inputMnt && amt) inputMnt.value = amt;
        };
    });

    renderizarCarrito();
}
window.activarEventosPOS = activarEventosPOS;

// ----------------------------------------------------------
// 8. TECLADO NUMÉRICO TÁCTIL
// ----------------------------------------------------------
let ultimoToqueTeclado = 0;

if (!window.posKeypadGlobalHandlerInit) {
    window.posKeypadGlobalHandlerInit = true;

    document.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.pos-keypad-btn, #btn-pos-clear-input');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const ahora = Date.now();
        if (ahora - ultimoToqueTeclado < 220) return;
        ultimoToqueTeclado = ahora;

        const inputNum = document.getElementById('pos-input-numbers') || document.querySelector('input[placeholder*="Número"]');
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
}

// Re-exportar herramientas de ticketManager
export async function imprimirTicketTermica(ticketData) {
    if (ticketData) await imprimirTermicaManager(ticketData);
}
export async function compartirTicketWhatsApp(ticketData) {
    await compartirWhatsAppManager(ticketData);
}
export async function descargarPDFTicket(ticketData) {
    await descargarPDFManager(ticketData);
}
export function mostrarOpcionesExportacionTicket(ticketData) {
    mostrarOpcionesManager(ticketData);
}

window.imprimirTicketTermica = imprimirTicketTermica;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;

// Inicialización automática
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPOSModule);
} else {
    initPOSModule();
}