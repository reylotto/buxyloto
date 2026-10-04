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

// ----------------------------------------------------------
// PLANTILLA DE IMPRESIÓN Y RENDERIZADO DE TICKET (COLUMNAS)
// ----------------------------------------------------------
export async function renderizarPlantillaTicket(ticketData) {
    const contenedor = document.getElementById('ticket-template-container') || document.body;
    
    // Garantizar que capturamos las jugadas correctamente sin importar el formato del objeto
    const jugadas = ticketData.detalles || ticketData.jugadas || [];

    // Generar la lista de filas con formato de columnas: SORTEO | JUGADA | MONTO
    const filasHTML = jugadas.length > 0 ? jugadas.map(j => {
        const sorteoNombre = j.sorteo_nombre || ticketData.sorteo_nombre || 'GENERAL';
        const tipoJugada = j.tipo ? `${j.tipo.toUpperCase()} (${j.numero})` : String(j.numero || '');
        const montoFormateado = parseFloat(j.monto || 0).toFixed(2);

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: bold; padding: 3px 0; border-bottom: 1px dotted #e2e8f0;">
                <span style="width: 38%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sorteoNombre}</span>
                <span style="width: 37%; text-align: center; text-transform: uppercase;">${tipoJugada}</span>
                <span style="width: 25%; text-align: right;">${montoFormateado}</span>
            </div>
        `;
    }).join('') : `
        <div style="text-align: center; padding: 10px; font-size: 11px;">Sin jugadas registradas</div>
    `;

    const fechaFormateada = ticketData.fecha || new Date().toLocaleDateString();
    const horaFormateada = ticketData.hora || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const totalTicket = parseFloat(ticketData.monto_total || ticketData.monto || 0).toFixed(2);
    const codigoTicket = ticketData.codigo_ticket || ticketData.codigo || 'BX-000000';

    const plantillaHTML = `
        <div id="ticket-printable-area" style="width: 280px; font-family: monospace; padding: 12px; background: #ffffff; color: #000000; font-size: 12px; margin: 0 auto; box-sizing: border-box;">
            <!-- Encabezado del Comercio -->
            <div style="text-align: center; margin-bottom: 8px;">
                <div style="font-size: 22px; margin-bottom: 2px;">☘️</div>
                <div style="font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">BUXYLOTO</div>
                <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">POS CENTRAL</div>
                <div style="font-size: 10px; margin-top: 1px;">$$ DINERO SEGURO $$</div>
            </div>

            <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>

            <!-- Datos de la Transacción -->
            <div style="font-size: 11px; font-weight: bold; line-height: 1.4;">
                <div style="display: flex; justify-content: space-between;">
                    <span>BANCA</span>
                    <span>${ticketData.banca || 'BuxyLoto Main'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>FECHA</span>
                    <span>${fechaFormateada}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>HORA</span>
                    <span>${horaFormateada}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>TICKET</span>
                    <span>${codigoTicket}</span>
                </div>
            </div>

            <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>

            <!-- ENCABEZADO DE COLUMNAS -->
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; border-bottom: 1.5px solid #000000; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="width: 38%; text-align: left;">SORTEO</span>
                <span style="width: 37%; text-align: center;">JUGADA</span>
                <span style="width: 25%; text-align: right;">MONTO</span>
            </div>

            <!-- LISTA DE JUGADAS -->
            <div style="margin-bottom: 8px;">
                ${filasHTML}
            </div>

            <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>

            <!-- TOTAL -->
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 8px 0;">
                <span>TOTAL</span>
                <span>USD ${totalTicket}</span>
            </div>

            <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>

            <!-- Pie de página -->
            <div style="text-align: center; font-size: 10px; font-weight: bold; margin-top: 8px; line-height: 1.3;">
                <div>REVISE SU TICKET</div>
                <div>SIN TICKET NO SE PAGA</div>
                <div style="font-size: 8px; margin-top: 4px;">DIRECTO 60X1 | PALE 1000X1 | TRIPLETA 10000X1</div>
                <div style="font-size: 8px;">NO SE PAGA EL PALE DOBLE</div>
            </div>

            <!-- Código QR -->
            ${ticketData.qr_url ? `
                <div style="text-align: center; margin-top: 10px;">
                    <img src="${ticketData.qr_url}" style="width: 110px; height: 110px;" />
                </div>
            ` : ''}
        </div>
    `;

    // Si existe el contenedor asignado en el HTML se inserta ahí, o se actualiza dinámicamente
    let element = document.getElementById('ticket-template-container');
    if (!element) {
        element = document.createElement('div');
        element.id = 'ticket-template-container';
        element.style.display = 'none';
        document.body.appendChild(element);
    }
    element.innerHTML = plantillaHTML;
    return plantillaHTML;
}

window.renderizarPlantillaTicket = renderizarPlantillaTicket;

// Asignaciones globales para garantizar llamadas desde otros archivos
window.renderizarPlantillaTicket = renderizarPlantillaTicket;
window.generarImagenTicket = generarImagenTicket;
window.compartirTicketWhatsApp = compartirTicketWhatsApp;
window.descargarPDFTicket = descargarPDFTicket;
window.mostrarOpcionesExportacionTicket = mostrarOpcionesExportacionTicket;