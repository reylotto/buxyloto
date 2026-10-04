// ==========================================================
// MÓDULO DE GESTIÓN Y EXPORTACIÓN DE TICKETS (ticketManager.js)
// Basado en el formato estándar POS JuegaGana
// ==========================================================

function cargarLibreriaQR() {
    return new Promise((resolve, reject) => {
        if (window.QRCode) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar QRCode.js"));
        document.body.appendChild(script);
    });
}

async function generarQRDataURL(texto) {
    await cargarLibreriaQR();

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
        }, 100);
    });
}

export async function renderizarPlantillaTicket(ticketData) {
    let ticketElem = document.getElementById('ticket-print-area');

    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Configuración estética oculta para renderizado exacto
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '320px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '20px 16px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.3';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];

    let nombreSorteo = ticketData.sorteo_nombre || ticketData.sorteo || ticketData.nombre_sorteo;
    if (!nombreSorteo && ticketData.sorteos) {
        nombreSorteo = typeof ticketData.sorteos === 'object' ? (ticketData.sorteos.nombre || ticketData.sorteos.titulo) : ticketData.sorteos;
    }
    if (!nombreSorteo) nombreSorteo = 'SORTEO GENERAL';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ahora.toLocaleDateString();
    const horaStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const qrDataUrl = await generarQRDataURL(codigo);

    // Renderizado de las jugadas
    // Dentro de renderizarPlantillaTicket en js/ticketManager.js

const esSorteoUnico = ticketData.detalles.every(j => j.sorteo_nombre === ticketData.detalles[0].sorteo_nombre);

const filasHTML = jugadas.map(j => `
    <div style="margin-bottom: 4px;">
        ${(!esSorteoUnico && j.sorteo_nombre) ? `<div style="font-size: 10px; color: #444; font-weight: bold; text-transform: uppercase;">[${j.sorteo_nombre}]</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold;">
            <span style="width: 35%; text-transform: uppercase;">${j.tipo || 'DIRECTO'}</span>
            <span style="width: 35%; text-align: center;">${j.numero}</span>
            <span style="width: 30%; text-align: right;">${parseFloat(j.monto || 0).toFixed(2)}</span>
        </div>
    </div>
`).join('');

    ticketElem.innerHTML = `
        <!-- CABECERA DE MARCA -->
        <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 32px; line-height: 1; margin-bottom: 2px;">☘️</div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">BUXYLOTO</h2>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">POS CENTRAL</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">$$ DINERO SEGURO $$</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <!-- METADATOS DEL TICKET -->
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 3px;">
            <span>BANCA</span>
            <span>BuxyLoto Main</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 3px;">
            <span>FECHA</span>
            <span>${fechaStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 3px;">
            <span>HORA</span>
            <span>${horaStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 6px;">
            <span>TICKET</span>
            <span>${codigo}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <!-- ENCABEZADO DE SORTEO -->
        <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 8px;">
            ${nombreSorteo}
        </div>

        <!-- LISTA DE JUGADAS -->
        <div style="margin-bottom: 10px;">
            ${filasHTML}
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <!-- TOTAL USD -->
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin: 8px 0;">
            <span>TOTAL</span>
            <span>USD ${montoTotal}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 12px 0 8px 0;"></div>

        <!-- REGLAS Y AVISOS -->
        <div style="text-align: center; font-size: 10px; font-weight: bold; line-height: 1.3; margin-bottom: 12px;">
            <p style="margin: 2px 0;">REVISE SU TICKET</p>
            <p style="margin: 2px 0;">SIN TICKET NO SE PAGA</p>
            <p style="margin: 4px 0 2px 0; font-size: 9px; color: #333;">DIRECTO 60X1 | PALE 1000X1 | TRIPLETA 10000X1</p>
            <p style="margin: 2px 0; font-size: 9px; color: #333;">NO SE PAGA EL PALE DOBLE</p>
        </div>

        <!-- CÓDIGO QR -->
        <div style="text-align: center; margin-top: 6px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:115px; height:115px; display:inline-block;" alt="Código QR Ticket" />` : ''}
        </div>
    `;
}

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
        console.error("Error al generar la imagen del ticket:", err);
        return null;
    }
}

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
                console.log("Acción cancelada o no disponible:", e);
            }
        }
    }

    const nombreSorteo = ticketData.sorteo_nombre || ticketData.sorteo || 'Lotería';
    const mensajeText = encodeURIComponent(
        `*BUXYLOTO POS*\n` +
        `*TICKET #${ticketData.codigo_ticket || ticketData.codigo || ''}*\n` +
        `Sorteo: ${nombreSorteo}\n` +
        `Total: USD $${parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2)}\n\n` +
        `¡Gracias por su compra!`
    );

    const url = numeroTelefono 
        ? `https://api.whatsapp.com/send?phone=${numeroTelefono}&text=${mensajeText}`
        : `https://api.whatsapp.com/send?text=${mensajeText}`;

    window.open(url, '_blank');
}

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

window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;