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

    // Configuración estética y de espacio optimizada
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '300px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '14px 12px';
    ticketElem.style.fontFamily = "Courier, 'Courier New', monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.4';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    // Extracción de metadatos del ticket
    const codigo = ticketData.codigo_ticket || ticketData.codigo || '000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const jugadas = ticketData.detalles || ticketData.jugadas || [];

    const nombreBanca = ticketData.banca_nombre || ticketData.nombre_banca || ticketData.banca || 'BUXYLOTO MAIN';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ticketData.fecha || ahora.toLocaleDateString();
    const horaStr = ticketData.hora || ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const qrDataUrl = await generarQRDataURL(codigo);

    // Renderizado correcto de las jugadas en 3 columnas sin colisión vertical
    const filasHTML = jugadas.length > 0 ? jugadas.map(j => {
        let sorteoRaw = j.sorteo_nombre || j.sorteo || ticketData.sorteo_nombre || ticketData.sorteo || 'GENERAL';
        sorteoRaw = sorteoRaw.replace(/\[\vert{}\]/g, '').trim();

        const numeroLimpio = j.numero || '';
        const tipoLimpio = (j.tipo || '').toUpperCase();
        const jugadaTexto = tipoLimpio ? `${tipoLimpio} ${numeroLimpio}`.trim() : String(numeroLimpio);

        const montoFormateado = parseFloat(j.monto || 0).toFixed(2);

        return `
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: bold; padding: 4px 0; border-bottom: 1px dashed #cccccc; line-height: 1.2;">
                <span style="width: 42%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: bold; line-height: 1.2; display: inline-block;">${sorteoRaw}</span>
                <span style="width: 36%; text-align: center; font-weight: bold; line-height: 1.2; display: inline-block;">${jugadaTexto}</span>
                <span style="width: 22%; text-align: right; font-weight: bold; line-height: 1.2; display: inline-block;">${montoFormateado}</span>
            </div>
        `;
    }).join('') : `
        <div style="text-align: center; padding: 6px; font-size: 11px; font-weight: bold;">Sin jugadas registradas</div>
    `;

    ticketElem.innerHTML = `
        <!-- CABECERA -->
        <div style="text-align: center; margin-bottom: 8px;">
            <div style="font-size: 24px; line-height: 1; margin-bottom: 2px;">☘️</div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #000;">BUXYLOTO</h2>
            <div style="font-size: 11px; font-weight: bold;">POS CENTRAL</div>
            <div style="font-size: 10px; font-weight: bold;">$$ DINERO SEGURO $$</div>
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- METADATOS -->
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

        <!-- ENCABEZADO DE TABLA -->
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 4px;">
            <span style="width: 42%; text-align: left; font-weight: bold;">SORTEO</span>
            <span style="width: 36%; text-align: center; font-weight: bold;">JUGADA</span>
            <span style="width: 22%; text-align: right; font-weight: bold;">MONTO</span>
        </div>

        <!-- JUGADAS -->
        <div style="margin-bottom: 6px;">
            ${filasHTML}
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- TOTAL -->
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 6px 0;">
            <span>TOTAL</span>
            <span>USD ${montoTotal}</span>
        </div>

        <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

        <!-- AVISOS -->
        <div style="text-align: center; font-size: 10px; font-weight: bold; line-height: 1.3; margin-bottom: 8px;">
            <p style="margin: 2px 0;">REVISE SU TICKET</p>
            <p style="margin: 2px 0;">SIN TICKET NO SE PAGA</p>
            <p style="margin: 4px 0 2px 0; font-size: 8px;">DIRECTO 60X1 | PALE 1000X1 | TRIPLETA 10000X1</p>
            <p style="margin: 2px 0; font-size: 8px;">NO SE PAGA EL PALE DOBLE</p>
        </div>

        <!-- QR -->
        <div style="text-align: center; margin-top: 6px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:100px; height:100px; display:inline-block;" alt="Código QR Ticket" />` : ''}
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
        try {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `Ticket_${ticketData.codigo_ticket || ticketData.codigo || 'POS'}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Ticket ${ticketData.codigo_ticket || ticketData.codigo}`,
                    text: `Comprobante de Ticket #${ticketData.codigo_ticket || ticketData.codigo}`
                });
                return;
            }
        } catch (e) {
            console.log("Acción cancelada o no disponible:", e);
        }
    }

    const jugadas = ticketData.detalles || ticketData.jugadas || [];
    let lineasJugadas = "";

    jugadas.forEach(j => {
        const sorteo = (j.sorteo_nombre || ticketData.sorteo_nombre || 'SORTEO').replace(/\[\vert{}\]/g, '').trim();
        const tipoJugada = j.tipo ? `${j.tipo.toUpperCase()} ${j.numero}` : j.numero;
        const monto = parseFloat(j.monto || 0).toFixed(2);
        
        lineasJugadas += `${sorteo} | ${tipoJugada} | $${monto}\n`;
    });

    const codigo = ticketData.codigo_ticket || ticketData.codigo || '';
    const total = parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2);

    const textoMensaje = 
        `*BUXYLOTO POS*\n` +
        `*TICKET #${codigo}*\n` +
        `----------------------------\n` +
        `*SORTEO | JUGADA | MONTO*\n` +
        `----------------------------\n` +
        `${lineasJugadas}` +
        `----------------------------\n` +
        `*TOTAL: USD $${total}*\n\n` +
        `¡Gracias por su compra!`;

    const mensajeText = encodeURIComponent(textoMensaje);

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

// Asignaciones globales
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;