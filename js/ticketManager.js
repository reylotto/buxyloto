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
 * Renderiza la plantilla del ticket en un contenedor fuera de pantalla (Oculto de la UI)
 */
export async function renderizarPlantillaTicket(ticketData) {
    await cargarLibreriaQR();

    let ticketElem = document.getElementById('ticket-print-area');
    
    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Estilos fijos para evitar que se muestre en el menú lateral y asegurar buen tamaño/contraste
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '320px'; // Tamaño estándar térmico 80mm
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '18px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '13px';
    ticketElem.style.lineHeight = '1.4';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    const codigo = ticketData.codigo_ticket || ticketData.codigo || ticketData.folio || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];
    const fechaActual = ticketData.created_at ? new Date(ticketData.created_at).toLocaleString() : new Date().toLocaleString();

    const filasHTML = jugadas.map(j => `
        <tr>
            <td style="padding: 4px 0; font-weight: bold; font-size: 13px;">${(j.tipo || 'DIRECTO').toUpperCase()} - ${j.numero}</td>
            <td style="text-align: right; padding: 4px 0; font-weight: bold; font-size: 13px;">$${parseFloat(j.monto || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    ticketElem.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px;">BUXYLOTO POS</h2>
            <p style="margin: 3px 0 0 0; font-size: 11px;">COMPROBANTE DE APUESTA</p>
        </div>

        <div style="margin-bottom: 10px; font-size: 12px;">
            <p style="margin: 2px 0;"><strong>Ticket #:</strong> ${codigo}</p>
            <p style="margin: 2px 0;"><strong>Fecha:</strong> ${fechaActual}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border-top: 1px solid #000; border-bottom: 1px solid #000;">
            <thead>
                <tr style="border-bottom: 1px solid #000;">
                    <th style="text-align: left; padding: 4px 0;">JUGADA</th>
                    <th style="text-align: right; padding: 4px 0;">MONTO</th>
                </tr>
            </thead>
            <tbody>
                ${filasHTML}
            </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 12px;">
            <span>TOTAL:</span>
            <span>$${montoTotal}</span>
        </div>

        <!-- CÓDIGO QR GENERADO -->
        <div style="text-align: center; margin-top: 10px;">
            <div id="ticket-qr-container" style="display: inline-block; padding: 6px; background: #fff;"></div>
            <p style="margin: 6px 0 0 0; font-size: 10px; font-weight: bold;">¡Gracias por su preferencia!</p>
        </div>
    `;

    // Generar el QR
    const qrContainer = document.getElementById('ticket-qr-container');
    if (qrContainer && window.QRCode) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: codigo,
            width: 90,
            height: 90,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

/**
 * Genera la imagen PNG de alta calidad desde la plantilla oculta
 */
export async function generarImagenTicket() {
    const ticketElem = document.getElementById('ticket-print-area');
    if (!ticketElem) return null;

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 3, // Alta resolución
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
        });
        return canvas.toDataURL("image/png");
    } catch (err) {
        console.error("Error generando imagen del ticket:", err);
        return null;
    }
}

/**
 * Compartir por WhatsApp
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
                console.log("Navegador no completó share nativo:", e);
            }
        }
    }

    const mensajeText = encodeURIComponent(
        `*BUXYLOTO POS*\n` +
        `*TICKET DE JUGADA #${ticketData.codigo_ticket || ticketData.codigo || ''}*\n` +
        `Total: $${parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2)}\n\n` +
        `¡Gracias por su compra!`
    );
    
    const url = numeroTelefono 
        ? `https://api.whatsapp.com/send?phone=${numeroTelefono}&text=${mensajeText}`
        : `https://api.whatsapp.com/send?text=${mensajeText}`;
        
    window.open(url, '_blank');
}

/**
 * Descargar ticket en PDF de 80mm
 */
export async function descargarPDFTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const dataUrl = await generarImagenTicket();
    if (!dataUrl) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 150]
    });

    doc.addImage(dataUrl, 'PNG', 0, 0, 80, 0);
    doc.save(`Ticket_${ticketData.codigo_ticket || ticketData.codigo || 'POS'}.pdf`);
}

/**
 * Modal desplegable con opciones
 */
export async function mostrarOpcionesExportacionTicket(ticketData) {
    // Renderizar la plantilla fuera de vista
    await renderizarPlantillaTicket(ticketData);

    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modal-export-ticket" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:99999;">
            <div style="background:#1e293b; color:#fff; padding:24px; border-radius:12px; width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin:0 0 8px 0; font-size:18px;">Ticket #${ticketData.codigo_ticket || ticketData.codigo || ''}</h3>
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

// Globales
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;