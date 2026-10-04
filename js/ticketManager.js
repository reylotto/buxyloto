// ==========================================================
// MÓDULO DE GESTIÓN Y EXPORTACIÓN DE TICKETS (ticketManager.js)
// Basado en el formato estándar POS JuegaGana / Buxyloto
// ==========================================================

/**
 * Carga dinámica de librerías requeridas (QRCode, html2canvas, jsPDF)
 */
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
            width: 120,
            height: 120,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
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

export async function renderizarPlantillaTicket(ticketData) {
    let ticketElem = document.getElementById('ticket-print-area');

    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Configuración para renderizado preciso
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '280px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '12px 10px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.4';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    // Extracción y formateo de metadatos del ticket
    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];

    const nombreBanca = ticketData.banca_nombre || ticketData.nombre_banca || ticketData.banca || 'BUXYLOTO MAIN';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ticketData.fecha || ahora.toLocaleDateString('es-ES');
    const horaStr = ticketData.hora || ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Generar URL del QR
    const qrDataUrl = await generarQRDataURL(codigo);

    // Formatear filas de jugadas
    const filasHTML = jugadas.length > 0 ? jugadas.map(j => {
        let sorteoRaw = j.sorteo_nombre || j.sorteo || ticketData.sorteo_nombre || ticketData.sorteo || 'GENERAL';
        sorteoRaw = sorteoRaw.replace(/\[\vert{}\]/g, '').trim();

        const numeroLimpio = j.numero || '';
        const tipoLimpio = (j.tipo || '').toUpperCase();
        const jugadaTexto = tipoLimpio ? `${tipoLimpio} ${numeroLimpio}`.trim() : String(numeroLimpio);
        const montoFormateado = parseFloat(j.monto || 0).toFixed(2);

        return `
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 10px; font-weight: bold; padding: 3px 0; border-bottom: 1px dotted #000000; line-height: 1.2;">
                <span style="width: 38%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase;">${sorteoRaw}</span>
                <span style="width: 38%; text-align: center; text-transform: uppercase;">${jugadaTexto}</span>
                <span style="width: 24%; text-align: right;">${montoFormateado}</span>
            </div>
        `;
    }).join('') : `
        <div style="text-align: center; padding: 6px; font-size: 11px; font-weight: bold;">Sin jugadas registradas</div>
    `;

    ticketElem.innerHTML = `
        <!-- CABECERA DE MARCA -->
        <div style="text-align: center; margin-bottom: 8px;">
            <div style="font-size: 24px; line-height: 1; margin-bottom: 2px;">☘️</div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #000;">BUXYLOTO</h2>
            <div style="font-size: 11px; font-weight: bold;">POS CENTRAL</div>
            <div style="font-size: 10px; font-weight: bold;">$$ DINERO SEGURO $$</div>
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- METADATOS DEL TICKET -->
        <div style="font-size: 11px; font-weight: bold; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between;">
                <span>BANCA</span>
                <span style="text-transform: uppercase;">${nombreBanca}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>FECHA</span>
                <span>${fechaStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>HORA</span>
                <span>${horaStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>TICKET</span>
                <span>${codigo}</span>
            </div>
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- ENCABEZADO DE TABLA (SORTEO | JUGADA | MONTO) -->
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 11px; border-bottom: 2px solid #000000; padding-bottom: 3px; margin-bottom: 4px; text-transform: uppercase;">
            <span style="width: 38%; text-align: left;">SORTEO</span>
            <span style="width: 38%; text-align: center;">JUGADA</span>
            <span style="width: 24%; text-align: right;">MONTO</span>
        </div>

        <!-- LISTA DE JUGADAS -->
        <div style="margin-bottom: 6px;">
            ${filasHTML}
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- TOTAL USD -->
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 6px 0;">
            <span>TOTAL</span>
            <span>USD ${montoTotal}</span>
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- REGLAS Y AVISOS -->
        <div style="text-align: center; font-size: 10px; font-weight: bold; line-height: 1.3; margin-bottom: 8px;">
            <p style="margin: 2px 0;">REVISE SU TICKET</p>
            <p style="margin: 2px 0;">SIN TICKET NO SE PAGA</p>
            <p style="margin: 4px 0 2px 0; font-size: 8px;">DIRECTO 60X1 | PALE 1000X1 | TRIPLETA 10000X1</p>
            <p style="margin: 2px 0; font-size: 8px;">NO SE PAGA EL PALE DOBLE</p>
        </div>

        <!-- CÓDIGO QR -->
        <div style="text-align: center; margin-top: 6px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:100px; height:100px; display:inline-block;" alt="Código QR Ticket" />` : ''}
        </div>
    `;

    return ticketElem;
}

export async function generarImagenTicket() {
    await asegurarLibrerias();
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
        console.error("Error al generar la imagen del ticket:", err);
        return null;
    }
}

/**
 * Imprime directamente el ticket en impresoras térmicas
 */
export async function imprimirTicketTermica(ticketData) {
    const ticketElem = await renderizarPlantillaTicket(ticketData);

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
        alert("Por favor habilita los pop-ups para imprimir el ticket.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Ticket #${ticketData.codigo_ticket || ticketData.codigo}</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                body {
                    margin: 0;
                    padding: 10px;
                    background: #fff;
                    display: flex;
                    justify-content: center;
                }
            </style>
        </head>
        <body>
            <div style="width: 280px;">
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

/**
 * Comparte el resumen del ticket por WhatsApp
 */
export function compartirTicketWhatsApp(ticketData) {
    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];

    let mensaje = `🎟️ *TICKET BUXYLOTO #${codigo}*\n`;
    mensaje += `💰 *Total:* $${montoTotal}\n`;
    mensaje += `--------------------------\n`;

    jugadas.forEach(j => {
        const num = j.numero || '';
        const tipo = (j.tipo || '').toUpperCase();
        const mnt = parseFloat(j.monto || 0).toFixed(2);
        mensaje += `• ${tipo} ${num} -> $${mnt}\n`;
    });

    mensaje += `--------------------------\n`;
    mensaje += `¡Mucha Suerte! 🍀`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

/**
 * Descarga el ticket como un archivo PDF
 */
export async function descargarPDFTicket(ticketData) {
    await renderizarPlantillaTicket(ticketData);
    const imgData = await generarImagenTicket();

    if (!imgData) {
        alert("❌ No se pudo generar el documento PDF.");
        return;
    }

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

/**
 * Despliega el modal interactivo de exportación de tickets
 */
export function mostrarOpcionesExportacionTicket(ticketData) {
    const modalExistente = document.getElementById('modal-export-ticket');
    if (modalExistente) modalExistente.remove();

    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';

    const modalHTML = `
        <div id="modal-export-ticket" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 99999;">
            <div style="background: #1e293b; color: #fff; border-radius: 12px; padding: 24px; width: 90%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center;">
                <h3 style="margin-top: 0; color: #10b981;">🎉 Ticket #${codigo} Emitido</h3>
                <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Seleccione cómo desea enviar o entregar el ticket:</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btn-print-thermal" style="background: #10b981; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">🖨️ Imprimir Ticket (Térmica)</button>
                    <button id="btn-share-wapp" style="background: #25d366; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">💬 Enviar por WhatsApp</button>
                    <button id="btn-download-pdf" style="background: #3b82f6; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">📄 Descargar PDF</button>
                    <button id="btn-close-modal-export" style="background: #475569; color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px;">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-print-thermal').onclick = () => imprimirTicketTermica(ticketData);
    document.getElementById('btn-share-wapp').onclick = () => compartirTicketWhatsApp(ticketData);
    document.getElementById('btn-download-pdf').onclick = () => descargarPDFTicket(ticketData);
    document.getElementById('btn-close-modal-export').onclick = () => {
        const modal = document.getElementById('modal-export-ticket');
        if (modal) modal.remove();
    };
}

// Asignaciones globales para compatibilidad
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.imprimirTicketTermica = imprimirTicketTermica;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;