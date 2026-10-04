// ==========================================================
// MÓDULO DE GESTIÓN Y EXPORTACIÓN DE TICKETS (ticketManager.js)
// ==========================================================

/**
 * Renders or updates the ticket HTML template in DOM
 * @param {Object} ticketData Data of the registered ticket
 */
export function renderizarPlantillaTicket(ticketData) {
    let ticketElem = document.getElementById('ticket-print-area');
    
    // Si la plantilla no existe en el DOM, la creamos dinámicamente
    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];
    const fechaActual = new Date().toLocaleString();

    // Generar filas de detalles
    const filasHTML = jugadas.map(j => `
        <tr>
            <td style="padding:2px 0;">${(j.tipo || 'Directo').toUpperCase()} - ${j.numero}</td>
            <td style="text-align:right; padding:2px 0;">$${parseFloat(j.monto || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    // Inyectar HTML dentro de la plantilla
    ticketElem.innerHTML = `
        <div class="header-ticket">
            <h3>BUXYLOTO POS</h3>
            <p><strong>Ticket #:</strong> ${codigo}</p>
            <p><strong>Fecha:</strong> ${fechaActual}</p>
        </div>
        <hr style="border:none; border-top:1px dashed #000; margin:6px 0;">
        <table>
            <thead>
                <tr>
                    <th style="text-align:left;">Jugada</th>
                    <th style="text-align:right;">Monto</th>
                </tr>
            </thead>
            <tbody>
                ${filasHTML}
            </tbody>
        </table>
        <div class="total-section">
            <p>TOTAL: $${montoTotal}</p>
        </div>
        <div style="text-align:center; margin-top:8px; font-size:10px;">
            ¡Gracias por su compra!
        </div>
    `;
}

/**
 * Generates PNG Image Data URL using html2canvas
 */
export async function generarImagenTicket(ticketElementId = 'ticket-print-area') {
    const ticketElem = document.getElementById(ticketElementId);
    if (!ticketElem) {
        alert("No se encontró la plantilla del ticket para generar la imagen.");
        return null;
    }

    // Visibilidad temporal para asegurar captura
    const displayOriginal = ticketElem.style.display;
    const positionOriginal = ticketElem.style.position;
    
    ticketElem.style.display = 'block';
    ticketElem.style.position = 'absolute';
    ticketElem.style.left = '-9999px'; // Oculto fuera de pantalla para que no parpadee UI

    try {
        const canvas = await html2canvas(ticketElem, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        });
        
        // Restaurar estilos
        ticketElem.style.display = displayOriginal;
        ticketElem.style.position = positionOriginal;
        
        return canvas.toDataURL("image/png");
    } catch (err) {
        console.error("Error al generar la imagen del ticket:", err);
        ticketElem.style.display = displayOriginal;
        ticketElem.style.position = positionOriginal;
        return null;
    }
}

/**
 * Share via WhatsApp (Native Share or Web API Link)
 */
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
 * Download Ticket as 80mm PDF
 */
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
    doc.save(`Ticket_${ticketData.codigo_ticket || ticketData.codigo || 'POS'}.pdf`);
}

/**
 * Displays Modal with Print / Share Options
 */
export function mostrarOpcionesExportacionTicket(ticketData) {
    // 1. Preparar/Rellenar datos en el HTML del ticket
    renderizarPlantillaTicket(ticketData);

    // 2. Limpiar modal anterior si existía
    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    // 3. Crear modal de opciones
    const modalHTML = `
        <div id="modal-export-ticket" class="modal-overlay-ticket">
            <div class="modal-content-ticket">
                <h3>Ticket #${ticketData.codigo_ticket || ticketData.codigo || ''}</h3>
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

    // 4. Conectar Eventos
    document.getElementById('btn-print-thermal').onclick = () => window.print();
    document.getElementById('btn-share-wapp').onclick = () => compartirTicketWhatsApp(ticketData);
    document.getElementById('btn-download-pdf').onclick = () => descargarPDFTicket(ticketData);
    document.getElementById('btn-close-modal-export').onclick = () => {
        const modal = document.getElementById('modal-export-ticket');
        if (modal) modal.remove();
    };
}

// Hacer visible globalmente por si usas scripts sin módulos
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;