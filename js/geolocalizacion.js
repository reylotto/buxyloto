// =================================================================
// MÓDULO DE GEOLOCALIZACIÓN Y MONITOREO DE TERMINALES EN TIEMPO REAL
// =================================================================

let mapaTerminales = null;
let marcadoresGroup = [];
let intervaloActualizacion = null; // Variable para controlar el auto-refresco

export async function initGeolocalizacionModule() {
    console.log("🗺️ Inicializando Módulo de Geolocalización en Tiempo Real...");

    const mapContainer = document.getElementById('map-container') 
                       || document.getElementById('mapa-terminales') 
                       || document.getElementById('map');

    if (!mapContainer) return;

    if (mapaTerminales && mapContainer._leaflet_id) {
        setTimeout(() => { if (mapaTerminales) mapaTerminales.invalidateSize(); }, 200);
        await cargarUbicacionesEnVivo();
        iniciarAutoRefresco();
        return;
    }

    if (mapContainer._leaflet_id) {
        if (mapaTerminales) { try { mapaTerminales.remove(); } catch (e) {} }
        mapContainer._leaflet_id = null;
        mapaTerminales = null;
    }

    try {
        const panamaCoords = [8.9824, -79.5199];

        mapaTerminales = L.map(mapContainer, {
            center: panamaCoords,
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapaTerminales);

        setTimeout(() => { if (mapaTerminales) mapaTerminales.invalidateSize(); }, 300);

        // Carga inicial y encendido del motor de auto-refresco
        await cargarUbicacionesEnVivo();
        iniciarAutoRefresco();

    } catch (err) {
        console.error("❌ Error al inicializar el mapa:", err);
    }
}

/**
 * Consulta las ubicaciones en VIVO desde la tabla 'ubicaciones_terminales'
 * y las cruza con la tabla de 'bancas' para obtener los datos de límite/comisión.
 */
export async function cargarUbicacionesEnVivo() {
    if (!mapaTerminales) return;

    // Función de rescate para obtener el cliente de Supabase
    const getSupabase = () => {
        if (window.supabase) return window.supabase;
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof window.getSupabaseClient === 'function') return window.getSupabaseClient();
        return null;
    };

    const supabase = getSupabase();
    if (!supabase) {
        console.error("❌ Supabase no está inicializado.");
        return;
    }

   try {
        // 🔥 ESCUDO MULTI-TENANT INYECTADO
        let queryBancas = supabase.from('bancas').select('id, estatus, comision, limite_credito');
        const inquilinoId = localStorage.getItem('inquilino_id');
        
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
            queryBancas = queryBancas.eq('inquilino_id', inquilinoId);
        }

        const { data: bancasData, error: errBancas } = await queryBancas;
        if (errBancas) throw errBancas;
        const bancasMap = new Map((bancasData || []).map(b => [String(b.id), b]));

        // 2. Obtener ubicaciones en VIVO (dinámicas)
        const { data: ubicaciones, error: errGeo } = await supabase.from('ubicaciones_terminales').select('*');
        if (errGeo) throw errGeo;

        // Limpiar mapa antes de dibujar los nuevos pines
        marcadoresGroup.forEach(marker => mapaTerminales.removeLayer(marker));
        marcadoresGroup = [];

        if (!ubicaciones || ubicaciones.length === 0) {
            console.log("ℹ️ No hay terminales reportando ubicación en vivo.");
            return;
        }

        const ahora = new Date();

        ubicaciones.forEach(ub => {
            const lat = parseFloat(ub.latitud);
            const lng = parseFloat(ub.longitud);
            if (isNaN(lat) || isNaN(lng)) return;

            const nombreVendedor = ub.vendedor_nombre || 'Terminal Desconocida';
            const ultimaActualizacion = new Date(ub.ultima_actualizacion);
            const minutosInactivo = Math.floor((ahora - ultimaActualizacion) / 60000);

            // Obtener datos de la banca asociada para el popup
            const bancaAsociada = bancasMap.get(String(ub.banca_id)) || {};
            const estatusReal = String(bancaAsociada.estatus || 'activo').toLowerCase();
            const comision = bancaAsociada.comision !== undefined ? bancaAsociada.comision : 15;
            const limite = bancaAsociada.limite_credito !== undefined ? bancaAsociada.limite_credito : 300;

            // Determinar color del pin basado en el estado Y si ha reportado GPS recientemente
            let colorStatus = '#10b981'; // Verde por defecto (Activo y reportando)
            let estadoTexto = 'EN LINEA';

            if (estatusReal !== 'activo') {
                colorStatus = '#f43f5e'; // Rojo si la banca está bloqueada/inactiva
                estadoTexto = 'BLOQUEADO';
            } else if (minutosInactivo > 15) {
                colorStatus = '#94a3b8'; // Gris si lleva más de 15 minutos sin reportar GPS
                estadoTexto = `OFFLINE (${minutosInactivo}m)`;
            }

            // Crear el icono del pin
            const customIcon = L.divIcon({
                className: 'custom-map-pin',
                html: `
                    <div style="
                        background-color: ${colorStatus};
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        border: 3px solid #0f172a;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 12px;
                        transition: all 0.3s ease;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const horaFmt = ultimaActualizacion.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });

            const popupContent = `
                <div style="font-family: system-ui, sans-serif; padding: 4px; color: #0f172a; min-width: 180px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <strong style="font-size: 14px; color: #0f172a;">${nombreVendedor}</strong>
                        <span style="
                            background: ${colorStatus}20;
                            color: ${colorStatus};
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 9px;
                            font-weight: bold;
                            text-transform: uppercase;
                            border: 1px solid ${colorStatus}40;">
                            ${estadoTexto}
                        </span>
                    </div>
                    <div style="font-size: 12px; line-height: 1.5; color: #475569;">
                        <p style="margin: 2px 0;">💵 <b>Comisión:</b> ${comision}%</p>
                        <p style="margin: 2px 0;">💳 <b>Crédito:</b> $${Number(limite).toFixed(2)}</p>
                        <hr style="margin: 6px 0; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 2px 0; font-size: 10px; color: #64748b;">
                            <i class="fa-solid fa-clock"></i> Último reporte: ${horaFmt}
                        </p>
                        <p style="margin: 2px 0; font-size: 9px; color: #94a3b8;">
                            Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
                        </p>
                    </div>
                </div>
            `;

            const marker = L.marker([lat, lng], { icon: customIcon })
                .addTo(mapaTerminales)
                .bindPopup(popupContent);

            marcadoresGroup.push(marker);
        });

    } catch (err) {
        console.error("❌ Error cargando ubicaciones en vivo:", err);
    }
}

/**
 * Inicia el temporizador para recargar el mapa automáticamente
 */
function iniciarAutoRefresco() {
    if (intervaloActualizacion) clearInterval(intervaloActualizacion);
    // Refrescar las ubicaciones cada 15 segundos
    intervaloActualizacion = setInterval(() => {
        const geoSection = document.getElementById('section-geo');
        // Solo refresca si la pestaña del mapa está visible
        if (geoSection && !geoSection.classList.contains('hidden')) {
            cargarUbicacionesEnVivo();
        }
    }, 15000); 
}

// Observador para detener el rastreo si salimos de la pantalla (ahorra batería)
document.addEventListener('DOMContentLoaded', () => {
    const geoSection = document.getElementById('section-geo');
    if (geoSection) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isHidden = geoSection.classList.contains('hidden');
                    if (!isHidden) {
                        initGeolocalizacionModule();
                    } else if (intervaloActualizacion) {
                        clearInterval(intervaloActualizacion); // Apagar motor si cambiamos de pantalla
                    }
                }
            });
        });
        observer.observe(geoSection, { attributes: true });
    }
});

window.initGeolocalizacionModule = initGeolocalizacionModule;
window.initMap = initGeolocalizacionModule;
window.cargarBancasEnMapa = cargarUbicacionesEnVivo;