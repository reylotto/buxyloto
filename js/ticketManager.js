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
 * Renderiza la plantilla HTML emulando la estructura exacta de la imagen BUXYLOTO
 */
export async function renderizarPlantillaTicket(ticketData) {
    let ticketElem = document.getElementById('ticket-print-area');

    if (!ticketElem) {
        ticketElem = document.createElement('div');
        ticketElem.id = 'ticket-print-area';
        document.body.appendChild(ticketElem);
    }

    // Configuración de lienzo térmico
    ticketElem.style.position = 'fixed';
    ticketElem.style.top = '-9999px';
    ticketElem.style.left = '-9999px';
    ticketElem.style.width = '270px';
    ticketElem.style.backgroundColor = '#ffffff';
    ticketElem.style.color = '#000000';
    ticketElem.style.padding = '12px 10px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.3';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    // Datos principales
    const codigo = ticketData.codigo_ticket || ticketData.codigo || ticketData.ticket_id || 'BX-168344';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const nombreBanca = ticketData.banca_nombre || ticketData.nombre_banca || ticketData.banca || 'BuxyLoto Main';
    const tituloHeader = ticketData.titulo_empresa || 'BUXYLOTO';
    const subtituloHeader = ticketData.subtitulo_empresa || 'POS CENTRAL';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ticketData.fecha || ahora.toLocaleDateString('es-ES');
    const horaStr = ticketData.hora || ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Extraer lista de jugadas
    const listaJugadas = ticketData.detalles || ticketData.jugadas || ticketData.items || [];

    // Obtener la lista unificada de sorteos para la cabecera del detalle
    const nombresSorteosUnicos = [...new Set(listaJugadas.map(j => 
        j.sorteo_nombre || j.sorteo || j.nombre_sorteo || ticketData.sorteo_nombre || 'SORTEO'
    ))];
    
    const textoCabeceraSorteos = ticketData.sorteo_nombre || nombresSorteosUnicos.join(' / ');

    // CONSTRUCCIÓN DE LAS JUGADAS EN LISTA VERTICAL (IGUAL A LA IMAGEN)
    let jugadasHTML = '';

    listaJugadas.forEach(j => {
        const nombreSorteo = (j.sorteo_nombre || j.sorteo || j.nombre_sorteo || ticketData.sorteo_nombre || 'SORTEO').toString().toUpperCase().trim();
        const tipoJuego = (j.tipo || j.tipo_juego || 'DIRECTO').toString().toUpperCase().trim();
        const numero = String(j.numero || j.jugada || '').trim();
        const monto = parseFloat(j.monto || j.valor || 0).toFixed(2);

        jugadasHTML += `
            <div style="margin-top: 6px;">
                <div style="font-size: 10px; color: #444; font-weight: normal; margin-bottom: 1px;">[${nombreSorteo}]</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold;">
                    <span style="width: 35%; text-align: left; text-transform: uppercase;">${tipoJuego}</span>
                    <span style="width: 30%; text-align: center;">${numero}</span>
                    <span style="width: 35%; text-align: right;">${monto}</span>
                </div>
            </div>
        `;
    });

    const qrDataUrl = await generarQRDataURL(codigo);

    ticketElem.innerHTML = `
        <!-- LOGO Y ENCABEZADO -->
        <div style="text-align: center;">
            <div style="font-size: 22px; line-height: 1;">☘️</div>
            <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-top: 2px;">${tituloHeader}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">${subtituloHeader}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">$$ DINERO SEGURO $$</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <!-- METADATOS BANCA, FECHA, HORA, TICKET -->
        <div style="font-size: 11px; font-weight: bold;">
            <div style="display: flex; justify-content: space-between;">
                <span>BANCA</span>
                <span>${nombreBanca}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>FECHA</span>
                <span>${fechaStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>HORA</span>
                <span>${horaStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>TICKET</span>
                <span>${codigo}</span>
            </div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <!-- LISTADO DE SORTEOS AFECTADOS -->
        <div style="font-weight: bold; font-size: 12px; text-transform: uppercase; word-wrap: break-word;">
            ${textoCabeceraSorteos}
        </div>

        <!-- JUGADAS -->
        <div style="margin-top: 4px;">
            ${jugadasHTML}
        </div>

        <div style="border-top: 1px dashed #000; margin: 10px 0 6px 0;"></div>

        <!-- TOTAL -->
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
            <span>TOTAL</span>
            <span>USD ${montoTotal}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0 10px 0;"></div>

        <!-- PIE DE PÁGINA -->
        <div style="text-align: center; font-size: 9px; font-weight: bold; line-height: 1.3;">
            <div>REVISE SU TICKET</div>
            <div>SIN TICKET NO SE PAGA</div>
            <div style="margin-top: 3px; font-size: 8px;">DIRECTO 60X1 | PALE 1000X1 | TRIPLETA 10000X1</div>
            <div style="font-size: 8px;">NO SE PAGA EL PALE DOBLE</div>
        </div>

        <!-- CÓDIGO QR -->
        <div style="text-align: center; margin-top: 10px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:100px; height:100px; display:inline-block;" />` : ''}
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