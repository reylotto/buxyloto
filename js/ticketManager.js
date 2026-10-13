// ==========================================================
// MÓDULO DE GESTIÓN Y EXPORTACIÓN DE TICKETS (ticketManager.js)
// Replicación exacta de Ticket POS Térmico (58mm / 80mm)
// Soporte Completo para Múltiples Sorteos en un Mismo Ticket
// ==========================================================

function cargarLibreria(url, globalVar) {
    return new Promise((resolve, reject) => {
        if (window[globalVar]) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`No se pudo cargar la librería desde ${url}`));
        document.body.appendChild(script);
    });
}

async function asegurarLibrerias() {
    await Promise.all([
        cargarLibreria('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode'),
        cargarLibreria('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'),
        cargarLibreria('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf')
    ]);
}

async function generarQRDataURL(texto) {
    await cargarLibreria('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode');

    return new Promise((resolve) => {
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);

        new QRCode(tempDiv, {
            text: texto || '000000',
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

        setTimeout(() => {
            const canvas = tempDiv.querySelector('canvas');
            const img = tempDiv.querySelector('img');
            let dataUrl = '';

            if (canvas) {
                dataUrl = canvas.toDataURL("image/png");
            } else if (img && img.src) {
                dataUrl = img.src;
            }

            tempDiv.remove();
            resolve(dataUrl);
        }, 150);
    });
}

/**
 * Renderiza la plantilla HTML emulando exactamente la estructura de Rey Lotto / BuxyLoto
 */
export async function renderizarPlantillaTicket(ticketData) {
    let ticketElem = document.getElementById('ticket-print-area');

    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Configuración de papel térmico (58mm / 80mm)
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '270px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '10px 8px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.2';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    // 🌟 APLICAR PERSONALIZACIÓN (Lectura directa de localStorage)
    const configTitulo = localStorage.getItem('buxy_ticket_titulo') || ticketData.titulo_empresa || 'BUXYLOTO POS';
    const configIconoGuardado = localStorage.getItem('buxy_ticket_icono') || '☘️';
    
    // Convertir classnames de FontAwesome a Emojis para el ticket impreso
    let configIcono = '☘️';
    if (configIconoGuardado.includes('gem') || configIconoGuardado === '💎') configIcono = '💎';
    else if (configIconoGuardado.includes('crown') || configIconoGuardado === '👑') configIcono = '👑';
    else if (configIconoGuardado.includes('star') || configIconoGuardado === '⭐') configIcono = '⭐';
    else if (configIconoGuardado.includes('money') || configIconoGuardado === '💰') configIcono = '💰';
    else if (configIconoGuardado.includes('check') || configIconoGuardado === '✔️') configIcono = '✔️';

    const configTelefono = localStorage.getItem('buxy_ticket_telefono') || '';
    const configPieRaw = localStorage.getItem('buxy_ticket_pie') || 'REVISE SU TICKET\nSIN TICKET NO SE PAGA\nLNP 1ER 2500-2DO 700-3ER 300\nPALE 1000-1000-200\nTRIPLETA 10000X1 2Num 100x1\nNO SE PAGA EL PALE DOBLE';
    const configPieHTML = configPieRaw.split('\n').map(line => `<div>${line}</div>`).join('');

    // Datos principales
    const codigo = ticketData.codigo_ticket || ticketData.codigo || ticketData.ticket_id || '9312-0917-4579-1660';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const nombreBanca = ticketData.banca_nombre || ticketData.nombre_banca || ticketData.banca || 'General';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ticketData.fecha || ahora.toLocaleDateString('es-ES');
    const horaStr = ticketData.hora || ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Agrupar jugadas por sorteo
    const jugadasPorSorteo = {};
    let conteoTotalJugadas = 0;
    const listaJugadas = ticketData.detalles || ticketData.jugadas || ticketData.items || [];

    listaJugadas.forEach(j => {
        conteoTotalJugadas++;
        let nombreSorteo = j.sorteo_nombre || j.sorteo || j.nombre_sorteo || ticketData.sorteo_nombre || 'SORTEO';
        nombreSorteo = String(nombreSorteo).replace(/[\[\]{}"]/g, '').trim().toUpperCase();

        if (!jugadasPorSorteo[nombreSorteo]) {
            jugadasPorSorteo[nombreSorteo] = [];
        }
        jugadasPorSorteo[nombreSorteo].push(j);
    });

    const totalItems = conteoTotalJugadas.toString().padStart(3, '0');

    // CONSTRUCCIÓN DE BLOQUES POR SORTEO EN 2 COLUMNAS
    let bloquesSorteosHTML = '';

    for (const [sorteoNombre, listaJugadasSorteo] of Object.entries(jugadasPorSorteo)) {
        bloquesSorteosHTML += `
            <div style="margin-top: 8px;">
                <div style="font-weight: bold; font-size: 12px; text-transform: uppercase;">${sorteoNombre}</div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin-top: 2px; margin-bottom: 2px;">
                    <span style="width: 25%; text-align: left;">JUGADA</span>
                    <span style="width: 25%; text-align: right;">MONTO</span>
                    <span style="width: 25%; text-align: center;">JUGADA</span>
                    <span style="width: 25%; text-align: right;">MONTO</span>
                </div>
        `;

        for (let i = 0; i < listaJugadasSorteo.length; i += 2) {
            const j1 = listaJugadasSorteo[i];
            const j2 = listaJugadasSorteo[i + 1];

            const num1 = j1.numero || j1.jugada || '';
            const mnt1 = parseFloat(j1.monto || j1.valor || 0).toFixed(2);

            const num2 = j2 ? (j2.numero || j2.jugada || '') : '';
            const mnt2 = j2 ? parseFloat(j2.monto || j2.valor || 0).toFixed(2) : '';

            bloquesSorteosHTML += `
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; line-height: 1.2;">
                    <span style="width: 25%; text-align: left;">${num1}</span>
                    <span style="width: 25%; text-align: right;">${mnt1}</span>
                    <span style="width: 25%; text-align: center;">${num2}</span>
                    <span style="width: 25%; text-align: right;">${mnt2}</span>
                </div>
            `;
        }

        bloquesSorteosHTML += `</div>`;
    }

    const qrDataUrl = await generarQRDataURL(codigo);

    ticketElem.innerHTML = `
        <!-- ENCABEZADO CENTRAL -->
        <div style="text-align: center;">
            <div style="font-size: 22px; line-height: 1;">${configIcono}</div>
            <div style="font-size: 16px; font-weight: bold;">${configTitulo}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">$$ DINERO SEGURO $$</div>
        </div>

        <!-- METADATOS (BANCA, TICKET, FECHA) -->
        <div style="margin-top: 10px; font-size: 11px; font-weight: bold;">
            <div style="display: flex; justify-content: space-between;">
                <span>BANCA</span>
                <span>${nombreBanca}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>TICKET</span>
                <span>${codigo}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>FECHA</span>
                <span>${fechaStr} ${horaStr}</span>
            </div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <!-- BLOQUES DE SORTEOS Y JUGADAS -->
        ${bloquesSorteosHTML}

        <div style="border-top: 1px dashed #000; margin: 8px 0 4px 0;"></div>

        <!-- TOTAL GENERAL -->
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold;">
            <span>Total: ${totalItems}</span>
            <span>${montoTotal}</span>
        </div>

        <!-- REGLAS Y CONDICIONES DEL PIE -->
        <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 12px; line-height: 1.2;">
            ${configPieHTML}
            ${configTelefono ? `<div style="margin-top: 5px; border-top: 1px dotted #000; padding-top: 2px;">Atención: ${configTelefono}</div>` : ''}
        </div>

        <!-- CÓDIGO QR -->
        <div style="text-align: center; margin-top: 10px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:95px; height:95px; display:inline-block;" />` : ''}
        </div>
    `;

    return ticketElem;
}

export async function generarImagenTicketBlob() {
    await asegurarLibrerias();
    const ticketElem = document.getElementById('ticket-print-area');
    if (!ticketElem) return null;

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    } catch (err) {
        console.error("Error al generar la imagen del ticket:", err);
        return null;
    }
}

export async function generarImagenTicket() {
    await asegurarLibrerias();
    const ticketElem = document.getElementById('ticket-print-area');
    if (!ticketElem) return null;

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
        });
        return canvas.toDataURL("image/png");
    } catch (err) {
        console.error("Error al generar dataURL:", err);
        return null;
    }
}

export async function compartirTicketWhatsApp(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const blob = await generarImagenTicketBlob();

    if (!blob) {
        alert("Error al procesar la imagen del ticket.");
        return;
    }

    const codigo = ticketData.codigo_ticket || ticketData.codigo || 'ticket';
    const file = new File([blob], `Ticket_${codigo}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Ticket #${codigo}`,
                text: `Ticket de jugada #${codigo}`
            });
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Error compartiendo archivo:", err);
            }
        }
    }

    const urlImagen = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlImagen;
    a.download = `Ticket_${codigo}.png`;
    a.click();

    alert("La imagen del ticket ha sido descargada. Se abrirá WhatsApp para que pueda adjuntarla.");
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Adjunto ticket #${codigo}`)}`, '_blank');
}

export async function descargarImagenTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const blob = await generarImagenTicketBlob();
    if (!blob) return;

    const codigo = ticketData.codigo_ticket || ticketData.codigo || 'ticket';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ticket_${codigo}.png`;
    a.click();
}

export async function descargarPDFTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const imgData = await generarImagenTicket();

    if (!imgData) {
        alert("❌ No se pudo generar el documento PDF.");
        return;
    }

    await asegurarLibrerias();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 150]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, 80, 0);
    const codigo = ticketData.codigo_ticket || ticketData.codigo || 'ticket';
    pdf.save(`Ticket_${codigo}.pdf`);
}

export async function imprimirTicketTermica(ticketData) {
    const ticketElem = await renderizarPlantillaTicket(ticketData);

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
        alert("Por favor habilita las ventanas emergentes (pop-ups) para imprimir.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Ticket</title>
            <style>
                @page { size: 58mm auto; margin: 0; }
                body { margin: 0; padding: 5px; background: #fff; display: flex; justify-content: center; }
            </style>
        </head>
        <body>
            <div style="width: 270px;">
                ${ticketElem.innerHTML}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

export function mostrarOpcionesExportacionTicket(ticketData) {
    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';

    const modalHTML = `
        <div id="modal-export-ticket" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 99999;">
            <div style="background: #1e293b; color: #fff; border-radius: 12px; padding: 24px; width: 90%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center;">
                <h3 style="margin-top: 0; color: #10b981;">🎟 Ticket #${codigo}</h3>
                <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Seleccione cómo desea emitir el ticket:</p>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btn-print-thermal" style="background: #10b981; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">🖨 Imprimir Ticket (Térmica POS)</button>
                    <button id="btn-share-wapp" style="background: #25d366; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">🖼 Enviar Imagen por WhatsApp</button>
                    <button id="btn-download-img" style="background: #3b82f6; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">📥 Descargar Imagen (PNG)</button>
                    <button id="btn-close-modal-export" style="background: #475569; color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px;">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-print-thermal').onclick = () => imprimirTicketTermica(ticketData);
    document.getElementById('btn-share-wapp').onclick = () => compartirTicketWhatsApp(ticketData);
    document.getElementById('btn-download-img').onclick = () => descargarImagenTicket(ticketData);
    document.getElementById('btn-close-modal-export').onclick = () => {
        const modal = document.getElementById('modal-export-ticket');
        if (modal) modal.remove();
    };
}

// Ventana global
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.generarImagenTicketBlob = generarImagenTicketBlob;
window.imprimirTicketTermica = imprimirTicketTermica;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarImagenTicket = descargarImagenTicket;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;

// ==========================================================
// FUNCIÓN DE VALIDACIÓN DE TICKET Y COMPROBACIÓN DE ESTADO
// ==========================================================
export async function validarTicket(identificadorTicket) {
    if (!identificadorTicket) return { success: false, error: 'Identificador de ticket no proporcionado.' };

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return { success: false, error: 'No hay conexión con Supabase.' };

    try {
        const refStr = String(identificadorTicket).trim();

        const { data, error } = await supabase
            .from('tickets')
            .select('*, ticket_detalles(*), sorteos(*)')
            .or(`codigo_ticket.eq.${refStr},id.eq.${refStr}`)
            .maybeSingle();

        if (error) throw error;
        if (!data) return { success: false, error: 'Ticket no encontrado en el sistema.' };

        const estado = String(data.estatus || data.estado || '').toLowerCase();
        const esAnulado = estado === 'cancelado' || estado === 'anulado';
        const esGanador = estado === 'ganador' || estado === 'premiado';
        const esPerdedor = estado === 'perdedor' || estado === 'no_premiado';

        return {
            success: true,
            valido: !esAnulado,
            ticket: data,
            estado: estado,
            esAnulado,
            esGanador,
            esPerdedor,
            mensaje: esAnulado 
                ? 'El ticket está cancelado/anulado.' 
                : esGanador 
                    ? '¡Ticket GANADOR!' 
                    : esPerdedor 
                        ? 'Ticket procesado (no premiado).' 
                        : 'Ticket activo y válido.'
        };
    } catch (err) {
        console.error("Error al validar ticket:", err);
        return { success: false, error: err.message || 'Error en la validación del ticket.' };
    }
}

window.validarTicket = validarTicket;

// ==========================================================
// FUNCIÓN DE ANULACIÓN DIRECTA A SUPABASE (RPC)
// ==========================================================
export async function anularTicketCancelado(identificadorTicket) {
    if (!identificadorTicket) return { success: false, error: 'Identificador no válido.' };

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return { success: false, error: 'No hay conexión con Supabase.' };

    try {
        const refStr = String(identificadorTicket).trim();

        const validacion = await validarTicket(refStr);
        if (validacion.success && validacion.esAnulado) {
            return { success: false, error: 'El ticket ya se encuentra anulado/cancelado.' };
        }

        const { data, error } = await supabase.rpc('cancelar_ticket_universal', { 
            p_referencia: refStr 
        });

        if (error) throw error;

        if (data && data.success) {
            return { success: true, message: data.message };
        } else {
            return { success: false, error: data?.message || 'No se pudo cancelar el ticket.' };
        }
    } catch (err) {
        console.error("Error en anularTicketCancelado:", err);
        return { success: false, error: err.message || 'Error al procesar la cancelación.' };
    }
}

window.anularTicketCancelado = anularTicketCancelado;

// ==========================================================
// MÓDULO ACTIVO DE PERSONALIZACIÓN DE TICKET
// ==========================================================

window.cargarPersonalizacionTicket = function() {
    const iTitulo = document.getElementById('cfg-ticket-title');
    const iIcono = document.getElementById('cfg-ticket-icon');
    const iTelefono = document.getElementById('cfg-ticket-phone');
    const tPie = document.getElementById('cfg-ticket-footer');

    if (iTitulo) iTitulo.value = localStorage.getItem('buxy_ticket_titulo') || 'BUXYLOTO POS';
    if (iIcono) iIcono.value = localStorage.getItem('buxy_ticket_icono') || 'fa-clover';
    if (iTelefono) iTelefono.value = localStorage.getItem('buxy_ticket_telefono') || '';
    if (tPie) tPie.value = localStorage.getItem('buxy_ticket_pie') || 'REVISE SU TICKET\nSIN TICKET NO SE PAGA\nLNP 1ER 2500-2DO 700-3ER 300\nPALE 1000-1000-200\nTRIPLETA 10000X1 2Num 100x1\nNO SE PAGA EL PALE DOBLE';
};

// Escuchar automáticamente la carga y el botón Guardar del formulario
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.cargarPersonalizacionTicket, 1000);

    const formPersonalizacion = document.getElementById('form-ticket-custom');
    if (formPersonalizacion) {
        formPersonalizacion.addEventListener('submit', function(e) {
            e.preventDefault(); // Evita que la página se recargue al dar clic en Guardar

            const iTitulo = document.getElementById('cfg-ticket-title');
            const iIcono = document.getElementById('cfg-ticket-icon');
            const iTelefono = document.getElementById('cfg-ticket-phone');
            const tPie = document.getElementById('cfg-ticket-footer');

            if (iTitulo) localStorage.setItem('buxy_ticket_titulo', iTitulo.value);
            if (iIcono) localStorage.setItem('buxy_ticket_icono', iIcono.value);
            if (iTelefono) localStorage.setItem('buxy_ticket_telefono', iTelefono.value);
            if (tPie) localStorage.setItem('buxy_ticket_pie', tPie.value);

            alert("✅ ¡Personalización Guardada Exitosamente!\nTodos los tickets impresos a partir de ahora tendrán este diseño.");
        });
    }
});
// ==========================================================
// MOTOR DE REIMPRESIÓN DIAGNOSTICADO Y ASEGURADO
// ==========================================================
window.reimprimirTicketUnificado = async function(ticketId) {
    alert("🔍 Clic detectado en ticket ID: " + ticketId); // Alerta de prueba para verificar ejecución

    try {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            alert("❌ Error: Cliente de Supabase no disponible en la ventana.");
            return;
        }

        // 1. Obtener ticket principal
        const { data: ticket, error: errTicket } = await supabase
            .from('tickets')
            .select('*, bancas(nombre)')
            .eq('id', ticketId)
            .single();

        if (errTicket) {
            alert("❌ Error de BD al buscar ticket: " + errTicket.message);
            throw errTicket;
        }
        if (!ticket) {
            alert("⚠️ Ticket no encontrado en la base de datos.");
            return;
        }

        // 2. Obtener las jugadas
        const { data: jugadas, error: errJugadas } = await supabase
            .from('jugadas')
            .select('*')
            .eq('ticket_id', ticketId);

        if (errJugadas) {
            alert("❌ Error al buscar jugadas: " + errJugadas.message);
        }

        // 3. Formatear datos para el motor de 2 columnas
        const ticketData = {
            ...ticket,
            codigo_ticket: ticket.codigo_ticket || ticket.folio || ticket.codigo || 'BX-000000',
            monto_total: parseFloat(ticket.monto_total || ticket.total || ticket.monto || 0).toFixed(2),
            banca_nombre: ticket.bancas?.nombre || ticket.banca_nombre || ticket.vendedor_nombre || 'Banca',
            detalles: jugadas || [],
            jugadas: jugadas || []
        };

        // 4. Lanzar el menú de exportación
        if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
            window.mostrarOpcionesExportacionTicket(ticketData);
        } else {
            alert("⚠️ Error: 'mostrarOpcionesExportacionTicket' no está cargada en window.");
        }

    } catch (err) {
        console.error("Error crítico al reimprimir:", err);
        alert("❌ Excepción capturada: " + (err.message || JSON.stringify(err)));
    }
};

// ==========================================================
// INTERCEPTOR ABSOLUTO: ELIMINA ALERTAS Y FUERZA EL DISEÑO A 2 COLUMNAS
// ==========================================================
if (typeof window !== 'undefined') {
    window.showTicketModal = async function(ticketInput) {
        // Bloquear alertas nativas momentáneamente
        const originalAlert = window.alert;
        window.alert = function(msg) {
            if (typeof msg === 'string' && (msg.includes('JUGADAS:') || msg.includes('TOTAL:'))) return; 
            originalAlert(msg);
        };

        try {
            if (!ticketInput) return;
            let ticketData = ticketInput;

            if (typeof ticketInput === 'string' || typeof ticketInput === 'number') {
                const supabase = window.supabaseClient || window.supabase;
                if (supabase) {
                    const { data: tData } = await supabase.from('tickets').select('*, bancas(nombre)').eq('id', ticketInput).single();
                    const { data: jData } = await supabase.from('jugadas').select('*').eq('ticket_id', ticketInput);
                    if (tData) {
                        ticketData = { ...tData, banca_nombre: tData.bancas?.nombre || 'Banca', detalles: jData || [] };
                    }
                }
            } else {
                ticketData = {
                    ...ticketInput,
                    codigo_ticket: ticketInput.codigo_ticket || ticketInput.folio || 'BX-000000',
                    monto_total: parseFloat(ticketInput.monto_total || ticketInput.total || 0).toFixed(2),
                    detalles: ticketInput.detalles || ticketInput.jugadas || []
                };
            }

            // Ocultar el modal HTML viejo si está abierto
            const oldModal = document.getElementById('modal-ticket-view');
            if (oldModal) oldModal.style.display = 'none';

            // Lanzar el panel moderno de 2 columnas
            if (typeof window.mostrarOpcionesExportacionTicket === 'function') {
                window.mostrarOpcionesExportacionTicket(ticketData);
            }
        } finally {
            // Restaurar alertas normales
            setTimeout(() => { window.alert = originalAlert; }, 500);
        }
    };
    
    // Conectar botones del historial
    window.reimprimirTicketUnificado = window.showTicketModal;
    window.reimpresionUnificadaPOS = window.showTicketModal;
    window.verTicketDetalleDirecto = window.showTicketModal;
}