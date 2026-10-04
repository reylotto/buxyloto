// ==========================================================
// MÓDULO DE GESTIÓN Y EXPORTACIÓN DE TICKETS (ticketManager.js)
// ==========================================================

/**
 * Carga dinámicamente la librería de QR Code si no está presente
 */
function cargarLibreriaQR() {
    return new Promise((resolve) => {
        if (window.QRCode) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => resolve();
        document.body.appendChild(script);
    });
}

/**
 * Renderiza la plantilla del ticket en un contenedor fuera de pantalla
 */
export async function renderizarPlantillaTicket(ticketData) {
    await cargarLibreriaQR();

    let ticketElem = document.getElementById('ticket-print-area');
    
    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Estilos fijos fuera de pantalla con excelente legibilidad y tamaño tipo POS (80mm)
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '320px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '20px 16px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '13px';
    ticketElem.style.lineHeight = '1.3';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    const codigo = ticketData.codigo_ticket || ticketData.codigo || ticketData.folio || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];
    const nombreSorteo = ticketData.sorteo_nombre || ticketData.sorteo || ticketData.nombre_sorteo || 'Sorteo General';
    const fechaActual = ticketData.created_at ? new Date(ticketData.created_at).toLocaleString() : new Date().toLocaleString();

    // Filas para cada jugada (Modalidad / Número / Monto)
    const filasHTML = jugadas.map(j => `
        <tr style="border-bottom: 1px dashed #ccc;">
            <td style="padding: 6px 0; font-weight: bold; font-size: 13px;">${(j.tipo || 'DIRECTO').toUpperCase()}</td>
            <td style="padding: 6px 0; font-weight: bold; font-size: 14px; text-align: center;">${j.numero}</td>
            <td style="padding: 6px 0; font-weight: bold; font-size: 13px; text-align: right;">$${parseFloat(j.monto || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    ticketElem.innerHTML = `
        <!-- CABECERA CON TRÉBOL -->
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <div style="font-size: 28px; line-height: 1; margin-bottom: 4px;">☘️</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px;">BUXYLOTO POS</h2>
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">PLATAFORMA DE CONTROL & LOTERÍAS</p>
        </div>

        <!-- DATOS DEL SORTEO Y TICKET -->
        <div style="margin-bottom: 10px; font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 8px;">
            <p style="margin: 2px 0;"><strong>TICKET #:</strong> <span style="font-size: 14px; font-weight: 900;">${codigo}</span></p>
            <p style="margin: 2px 0;"><strong>SORTEO:</strong> <span style="font-size: 13px; font-weight: bold;">${nombreSorteo}</span></p>
            <p style="margin: 2px 0;"><strong>FECHA/HORA:</strong> ${fechaActual}</p>
        </div>

        <!-- TABLA DE JUGADAS -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
                <tr style="border-bottom: 2px solid #000; text-align: left;">
                    <th style="padding: 4px 0;">MODALIDAD</th>
                    <th style="padding: 4px 0; text-align: center;">JUGADA</th>
                    <th style="padding: 4px 0; text-align: right;">MONTO</th>
                </tr>
            </thead>
            <tbody>
                ${filasHTML}
            </tbody>
        </table>

        <!-- MONTO TOTAL -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px dashed #000; padding: 8px 0; margin-bottom: 12px;">
            <span>TOTAL A PAGAR:</span>
            <span style="font-size: 18px;">$${montoTotal}</span>
        </div>

        <!-- CÓDIGO QR Y PIE DE PÁGINA -->
        <div style="text-align: center; margin-top: 10px;">
            <div id="ticket-qr-container" style="display: inline-block; padding: 6px; background: #fff;"></div>
            <p style="margin: 6px 0 0 0; font-size: 10px; font-weight: bold;">Verifique su ticket antes de retirar.</p>
            <p style="margin: 2px 0 0 0; font-size: 10px;">¡Gracias por su compra y buena suerte!</p>
        </div>
    `;

    // Generación del código QR basado en el código único del ticket
    const qrContainer = document.getElementById('ticket-qr-container');
    if (qrContainer && window.QRCode) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: codigo,
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

/**
 * Genera la captura PNG del ticket
 */
export async function generarImagenTicket() {
    const ticketElem = document.getElementById('ticket-print-area');
    if (!ticketElem) return null;

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 3,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
        });
        return canvas.toDataURL("image/png");
    } catch (err) {
        console.error("Error generando la imagen del ticket:", err);
        return null;
    }
}

/**
 * Enviar por WhatsApp
 */
export async function compartirTicketWhatsApp(ticketData, numeroTelefono = '') {
    await renderizarPlantillaTicket(ticketData);
    const dataUrl = await generarImagenTicket();
    
    if (dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `Ticket_${ticketData.codigo_ticket || ticketData.codigo || 'POS'}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: `Ticket ${ticketData.codigo_ticket || ticketData.codigo}`,
                    text: `Comprobante de Ticket #${ticketData.codigo_ticket || ticketData.codigo}`
                });
                return;
            } catch (e) {
                console.log("No se completó la acción de compartir:", e);
            }
        }
    }

    const mensajeText = encodeURIComponent(
        `*BUXYLOTO POS*\n` +
        `*TICKET DE JUGADA #${ticketData.codigo_ticket || ticketData.codigo || ''}*\n` +
        `Sorteo: ${ticketData.sorteo_nombre || ticketData.sorteo || 'General'}\n` +
        `Total: $${parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2)}\n\n` +
        `¡Gracias por su compra!`
    );
    
    const url = numeroTelefono 
        ? `https://api.whatsapp.com/send?phone=${numeroTelefono}&text=${mensajeText}`
        : `https://api.whatsapp.com/send?text=${mensajeText}`;
        
    window.open(url, '_blank');
}

/**
 * Descargar Ticket como PDF de 80mm
 */
export async function descargarPDFTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const dataUrl = await generarImagenTicket();
    if (!dataUrl) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 160]
    });

    doc.addImage(dataUrl, 'PNG', 0, 0, 80, 0);
    doc.save(`Ticket_${ticketData.codigo_ticket || ticketData.codigo || 'POS'}.pdf`);
}

/**
 * Modal con las opciones de envío / descarga
 */
export async function mostrarOpcionesExportacionTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);

    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modal-export-ticket" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:99999;">
            <div style="background:#1e293b; color:#fff; padding:24px; border-radius:12px; width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin:0 0 6px 0; font-size:18px;">Ticket #${ticketData.codigo_ticket || ticketData.codigo || ''}</h3>
                <p style="font-size:13px; color:#94a3b8; margin-bottom:20px;">¿Cómo desea entregar el comprobante?</p>
                
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button id="btn-print-thermal" style="background:#0284c7; color:#fff; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                        🖨️ Imprimir Térmica (80mm)
                    </button>
                    <button id="btn-share-wapp" style="background:#22c55e; color:#fff; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                        📲 Compartir Imagen (WhatsApp)
                    </button>
                    <button id="btn-download-pdf" style="background:#475569; color:#fff; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                        📄 Descargar PDF
                    </button>
                </div>

                <button id="btn-close-modal-export" style="margin-top:18px; background:transparent; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:14px;">
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

// Asignar funciones globales
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;