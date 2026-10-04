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
 * Renderiza la plantilla HTML emulando la estructura física exacta con Multi-Sorteo
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
    ticketElem.style.padding = '10px 8px';
    ticketElem.style.fontFamily = "'Courier New', Courier, monospace";
    ticketElem.style.fontSize = '12px';
    ticketElem.style.lineHeight = '1.2';
    ticketElem.style.boxSizing = 'border-box';
    ticketElem.style.zIndex = '-9999';

    // Extracción de metadatos del ticket
    const codigo = ticketData.codigo_ticket || ticketData.codigo || ticketData.ticket_id || 'BX-000000';
    const montoTotal = parseFloat(ticketData.monto_total || ticketData.monto || ticketData.total || 0).toFixed(2);
    const nombreBanca = ticketData.banca_nombre || ticketData.nombre_banca || ticketData.banca || 'Jey';

    const ahora = ticketData.created_at ? new Date(ticketData.created_at) : new Date();
    const fechaStr = ticketData.fecha || ahora.toLocaleDateString('es-ES');
    const horaStr = ticketData.hora || ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // ------------------------------------------------------------------
    // ESTRATEGIA DE AGRUPACIÓN MULTI-SORTEO
    // ------------------------------------------------------------------
    const jugadasPorSorteo = {};
    let conteoTotalJugadas = 0;

    const listaJugadas = ticketData.detalles || ticketData.jugadas || ticketData.items || [];
    
    listaJugadas.forEach(j => {
        conteoTotalJugadas++;
        
        // Prioridad de extracción de nombre del sorteo
        let nombreSorteo = j.sorteo_nombre || j.sorteo || j.nombre_sorteo || j.loteria || ticketData.sorteo_nombre || ticketData.sorteo || 'SORTEO';
        
        // Limpieza de caracteres no deseados
        nombreSorteo = String(nombreSorteo).replace(/[\[\]{}"]/g, '').trim().toUpperCase();

        if (!jugadasPorSorteo[nombreSorteo]) {
            jugadasPorSorteo[nombreSorteo] = [];
        }
        jugadasPorSorteo[nombreSorteo].push(j);
    });

    const totalItems = conteoTotalJugadas.toString().padStart(3, '0');

    // CONSTRUCCIÓN DEL HTML DE TODOS LOS SORTEOS
    let bloquesSorteosHTML = '';

    for (const [sorteoNombre, listaJugadasSorteo] of Object.entries(jugadasPorSorteo)) {
        bloquesSorteosHTML += `
            <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px;">
                <div style="font-weight: bold; font-size: 13px; text-transform: uppercase;">${sorteoNombre}</div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin-top: 4px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px;">
                    <span style="width: 25%; text-align: left;">JUGADA</span>
                    <span style="width: 25%; text-align: right;">MONTO</span>
                    <span style="width: 25%; text-align: center;">JUGADA</span>
                    <span style="width: 25%; text-align: right;">MONTO</span>
                </div>
        `;

        // Iterar jugadas de 2 en 2 para formatearlas en 2 columnas paralelas
        for (let i = 0; i < listaJugadasSorteo.length; i += 2) {
            const j1 = listaJugadasSorteo[i];
            const j2 = listaJugadasSorteo[i + 1];

            const num1 = j1.numero || j1.jugada || '';
            const mnt1 = parseFloat(j1.monto || j1.valor || 0).toFixed(2);

            const num2 = j2 ? (j2.numero || j2.jugada || '') : '';
            const mnt2 = j2 ? parseFloat(j2.monto || j2.valor || 0).toFixed(2) : '';

            bloquesSorteosHTML += `
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; line-height: 1.3;">
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
            <div style="font-size: 20px; line-height: 1;">☘️</div>
            <div style="font-size: 16px; font-weight: bold; text-transform: uppercase;">REY LOTTO</div>
            <div style="font-size: 11px; font-weight: bold;">$$ DINERO SEGURO $$</div>
        </div>

        <!-- DATOS ENCABEZADO: BANCA, TICKET, FECHA Y HORA -->
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

        <!-- BLOQUES DE TODOS LOS SORTEOS Y JUGADAS -->
        ${bloquesSorteosHTML}

        <div style="border-top: 1px dashed #000000; margin: 8px 0 4px 0;"></div>

        <!-- TOTAL DE JUGADAS Y MONTO GLOBAL -->
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold;">
            <span>Total: ${totalItems}</span>
            <span>${montoTotal}</span>
        </div>

        <!-- REGLAS DE PAGO Y CONDICIONES -->
        <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 12px; line-height: 1.2;">
            <div>REVISE SU TICKET</div>
            <div>SIN TICKET NO SE PAGA</div>
            <div>LNP 1ER 2500-2DO 700-3ER 300</div>
            <div>PALE 1000-1000-200</div>
            <div>TRIPLETA 10000X1 2Num 100x1</div>
            <div>NO SE PAGA EL PALE DOBLE</div>
        </div>

        <!-- CÓDIGO QR -->
        <div style="text-align: center; margin-top: 8px;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:90px; height:90px; display:inline-block;" />` : ''}
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