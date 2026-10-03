// ==========================================================
// MÓDULO POS Y VENTA DELEGADA CON TICKET DIGITAL Y SUPABASE (js/pos.js)
// ==========================================================

// 1. INICIALIZACIÓN DEL MÓDULO POS
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
// 2. CARGA DE VENDEDORES Y BANCAS
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
// 3. CARGA DE SORTEOS EN LA INTERFAZ DE VENTA POS (CON FILTRADO DE SEGURIDAD)
// ----------------------------------------------------------
export async function cargarSorteosPOS() {
    try {
        const supabase = window.supabase;
        if (!supabase) return;

        // Consultar todos los sorteos
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

        // Filtrar estrictamente los sorteos disponibles para la venta
        const sorteosDisponibles = sorteos.filter(s => {
            const estatus = String(s.estatus || s.estado || '').toLowerCase();

            // REGLA A: Si ya fue cerrado, escrutado o finalizado, ocultar
            if (estatus === 'cerrado' || estatus === 'finalizado' || estatus === 'escrutado') {
                return false;
            }

            // REGLA B: Si ya tiene números ganadores registrados en p1 o primer_premio, ocultar
            const tieneP1 = s.p1 && String(s.p1).trim() !== '' && String(s.p1).trim() !== '--';
            const tienePremio = s.primer_premio && String(s.primer_premio).trim() !== '';
            if (tieneP1 || tienePremio) {
                return false;
            }

            // REGLA C: Validar hora límite de cierre
            if (s.hora_cierre) {
                const [horas, minutos] = s.hora_cierre.split(':');
                const fechaCierre = new Date();
                fechaCierre.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);

                if (ahora >= fechaCierre) {
                    return false; // Ya pasó la hora límite de cierre
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

        // Listener para actualizar resumen cuando cambie la selección
        contCheckboxes.removeEventListener('change', actualizarResumenSorteos);
        contCheckboxes.addEventListener('change', actualizarResumenSorteos);

    } catch (err) {
        console.error("❌ Error al cargar sorteos en POS:", err.message);
    }
}
window.cargarSorteosPOS = cargarSorteosPOS;
window.renderizarSorteosPOS = cargarSorteosPOS; // Alias para compatibilidad con app.js

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
// 4. GESTIÓN DEL CARRITO DE JUGADAS LOCAL
// ----------------------------------------------------------
window.jugadasActuales = [];

function agregarJugadaAlCarrito(e) {
    if (e) e.preventDefault();
    const inputNumero = document.getElementById('pos-input-numbers');
    const inputMonto = document.getElementById('pos-input-amount');

    const num = inputNumero ? inputNumero.value.trim() : '';
    const mnt = inputMonto ? parseFloat(inputMonto.value) : 0;

    if (!num) {
        alert("⚠️️ Ingrese un número para la jugada.");
        return;
    }
    if (isNaN(mnt) || mnt <= 0) {
        alert("⚠️ Ingrese un monto válido.");
        return;
    }

    window.jugadasActuales.push({ numero: num, monto: mnt });

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
// 5. ACTIVACIÓN DE EVENTOS E INTERFAZ POS
// ----------------------------------------------------------
export function activarEventosPOS() {
    // Botón Agregar Jugada (+)
    const btnAdd = document.getElementById('btn-pos-add-item');
    if (btnAdd) {
        const newBtnAdd = btnAdd.cloneNode(true);
        btnAdd.replaceWith(newBtnAdd);
        newBtnAdd.addEventListener('click', agregarJugadaAlCarrito);
    }

    // Botón Marcar Todos los Sorteos
    const btnSelectAll = document.getElementById('btn-select-all-loterias');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = true);
            actualizarResumenSorteos();
        });
    }

    // Botón Limpiar Sorteos
    const btnClearAll = document.getElementById('btn-clear-all-loterias');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
            actualizarResumenSorteos();
        });
    }

    // Botón Vaciar Carrito
    const btnClearCart = document.getElementById('btn-pos-clear-cart');
    if (btnClearCart) {
        btnClearCart.addEventListener('click', (e) => {
            e.preventDefault();
            window.jugadasActuales = [];
            renderizarCarrito();
        });
    }

    // Botones de Monto Rápido
    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const amt = btn.dataset.amt;
            const inputAmount = document.getElementById('pos-input-amount');
            if (inputAmount && amt) inputAmount.value = amt;
        });
    });

    // 1. Función para detectar el límite dinámico según lo visible en la pantalla
function obtenerLimiteActualPOS() {
    // Si hay una variable global establecida
    if (window.modoJuegoActual === 'pale') return 4;
    if (window.modoJuegoActual === 'tripleta') return 6;

    // Buscar el selector o botón activo en el DOM si la variable no existe
    const activo = document.querySelector('.modo-btn-active, [data-modo].active, select#pos-select-modo');
    if (activo) {
        const val = (activo.value || activo.dataset.modo || activo.textContent || '').toLowerCase();
        if (val.includes('pale') || val.includes('palé')) return 4;
        if (val.includes('tripleta')) return 6;
    }
    
    return 2; // Directo por defecto
}

// 2. Escuchar cambios en los botones o selector de modalidad (Directo, Palé, Tripleta)
document.querySelectorAll('[data-modo], .tab-modo, .btn-modo, select#pos-select-modo').forEach(elem => {
    const cambiarModo = () => {
        const txt = (elem.value || elem.dataset.modo || elem.textContent || '').toLowerCase();
        if (txt.includes('pale') || txt.includes('palé')) window.modoJuegoActual = 'pale';
        else if (txt.includes('tripleta')) window.modoJuegoActual = 'tripleta';
        else window.modoJuegoActual = 'directo';

        const inputNum = document.getElementById('pos-input-numbers');
        if (inputNum) inputNum.value = ''; // Limpiar el input al cambiar de modo
    };

    elem.addEventListener('click', cambiarModo);
    elem.addEventListener('change', cambiarModo);
});

// 3. Teclado Numérico con límite dinámico en tiempo real
document.querySelectorAll('.pos-keypad-btn').forEach(btn => {
    btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        const inputNum = document.getElementById('pos-input-numbers');
        if (!inputNum) return;

        const maxDigitos = obtenerLimiteActualPOS();
        const action = this.dataset.action;
        const val = this.textContent.trim();
        const soloNumeros = inputNum.value.replace(/\D/g, '');

        if (action === 'backspace') {
            inputNum.value = inputNum.value.slice(0, -1);
        } else if (action === 'dash') {
            if (inputNum.value.length > 0 && !inputNum.value.endsWith('-')) {
                inputNum.value += '-';
            }
        } else if (!action) {
            // Solo agregar el número si NO se ha alcanzado el límite de la modalidad
            if (soloNumeros.length < maxDigitos) {
                inputNum.value += val;
            }
        }
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
// 6. REGISTRO Y EMISIÓN EN SUPABASE
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

        if (num && mnt > 0) {
            jugadas.push({ numero: num, monto: mnt });
        }
    }

    if (jugadas.length === 0) {
        alert("⚠️ Añada al menos una jugada con su monto antes de emitir.");
        return;
    }

    const idBanca = obtenerIdVendedorAsignado();
    const montoTotal = jugadas.reduce((sum, j) => sum + j.monto, 0);
    const ticketsProcesados = [];

    const btnEmitir = document.getElementById('btn-pos-process-ticket');
    if (btnEmitir) btnEmitir.disabled = true;

    try {
        for (const sItem of sorteosSeleccionados) {
            const codigoTicket = "BX-" + Math.floor(Math.random() * 900000 + 100000);
            const sorteoIdParsed = isNaN(sItem.id) ? sItem.id : parseInt(sItem.id, 10);

            // Payload estándar completo
            const payloadTicket = {
                codigo: codigoTicket,
                codigo_ticket: codigoTicket,
                sorteo_id: sorteoIdParsed,
                monto: montoTotal,
                monto_total: montoTotal,
                total: montoTotal,
                detalles: jugadas,
                jugadas: jugadas,
                estatus: 'pendiente',
                estado: 'pendiente'
            };

            if (idBanca) {
                payloadTicket.usuario_id = idBanca;
                payloadTicket.vendedor_id = idBanca;
                payloadTicket.banca_id = idBanca;
            }

            console.log("📡 Registrando venta en Supabase:", payloadTicket);

            // 1. Intento principal en la tabla 'tickets'
            let response = await supabase.from('tickets').insert([payloadTicket]).select();
            let ticketGuardado = response.data ? response.data[0] : null;
            let error = response.error;

            // 2. Si falla por conflicto de columnas, intentar con esquema simplificado
            if (error) {
                console.warn("Intentando esquema simplificado en 'tickets':", error.message);
                const payloadLimpio = {
                    codigo_ticket: codigoTicket,
                    sorteo_id: sorteoIdParsed,
                    monto_total: montoTotal,
                    detalles: jugadas,
                    estatus: 'pendiente'
                };
                if (idBanca) payloadLimpio.vendedor_id = idBanca;

                const res2 = await supabase.from('tickets').insert([payloadLimpio]).select();
                if (!res2.error) {
                    error = null;
                    ticketGuardado = res2.data ? res2.data[0] : null;
                } else {
                    // 3. Reintento en la tabla 'ventas'
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

           // 4. Inserción opcional en tabla auxiliar 'jugadas'
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

            ticketsProcesados.push({ codigo: codigoTicket, sorteo: sItem.nombre });
        }

        alert(`🎉 ¡Venta realizada con éxito!\n\n🎟️ Tickets generados: ${ticketsProcesados.length}\n💰 Total: $${montoTotal.toFixed(2)}`);

        // Resetear la interfaz del POS
        window.jugadasActuales = [];
        renderizarCarrito();

        const inputNum = document.getElementById('pos-input-numbers');
        const inputMnt = document.getElementById('pos-input-amount');
        if (inputNum) inputNum.value = '';
        if (inputMnt) inputMnt.value = '';

        document.querySelectorAll('input[name="pos-sorteos-selected"]').forEach(cb => cb.checked = false);
        actualizarResumenSorteos();

        // Actualizar automáticamente los historiales de ventas disponibles
        if (typeof window.cargarHistorialTickets === 'function') {
            window.cargarHistorialTickets();
        } else if (typeof window.cargarVentas === 'function') {
            window.cargarVentas();
        } else if (typeof window.cargarTablaHistorial === 'function') {
            window.cargarTablaHistorial();
        }

    } catch (err) {
        console.error("❌ Error general al procesar la venta:", err);
        alert("❌ Error general al procesar la venta: " + err.message);
    } finally {
        if (btnEmitir) btnEmitir.disabled = false;
    }
};