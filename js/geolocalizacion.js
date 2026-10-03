// =================================================================
// MÓDULO DE GEOLOCALIZACIÓN Y MONITOREO DE TERMINALES
// =================================================================

let mapaTerminales = null;
let marcadoresGroup = [];

/**
 * Inicializa el mapa y renderiza los puntos de las bancas
 */
export async function initGeolocalizacionModule() {
    console.log("🗺️ Inicializando Módulo de Geolocalización...");

    // Usar la ID exacta presente en tu HTML: 'map-container'
    const mapContainer = document.getElementById('map-container') 
                       || document.getElementById('mapa-terminales') 
                       || document.getElementById('map');

    if (!mapContainer) {
        console.warn("⚠️ No se encontró el contenedor del mapa (#map-container) en el DOM.");
        return;
    }

    // 1. Si el mapa ya existe en la variable, solo reajustamos el tamaño y cargamos los datos
    if (mapaTerminales && mapContainer._leaflet_id) {
        setTimeout(() => {
            if (mapaTerminales) mapaTerminales.invalidateSize();
        }, 200);
        await cargarBancasEnMapa();
        return;
    }

    // 2. BLINDAJE: Si Leaflet dejó el contenedor marcado pero la variable se perdió, destruimos la instancia previa
    if (mapContainer._leaflet_id) {
        if (mapaTerminales) {
            try { mapaTerminales.remove(); } catch (e) { console.warn(e); }
        }
        mapContainer._leaflet_id = null;
        mapaTerminales = null;
    }

    try {
        // Coordenadas centrales: Ciudad de Panamá [Latitud, Longitud]
        const panamaCoords = [8.9824, -79.5199];

        // Crear instancia del mapa Leaflet
        mapaTerminales = L.map(mapContainer, {
            center: panamaCoords,
            zoom: 12,
            zoomControl: true
        });

        // Capa de mapa OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapaTerminales);

        // Reajustar dimensiones para renderizado correcto sin cortes
        setTimeout(() => {
            if (mapaTerminales) mapaTerminales.invalidateSize();
        }, 300);

        // 3. Cargar bancas y dibujarlas en el mapa
        await cargarBancasEnMapa();

    } catch (err) {
        console.error("❌ Error al inicializar el mapa:", err);
    }
}

/**
 * Consulta las bancas desde Supabase y coloca los marcadores en el mapa
 */
export async function cargarBancasEnMapa() {
    if (!mapaTerminales) return;

    const supabase = window.supabase;
    if (!supabase) {
        console.error("❌ Supabase no está inicializado.");
        return;
    }

    // Limpiar marcadores anteriores
    marcadoresGroup.forEach(marker => mapaTerminales.removeLayer(marker));
    marcadoresGroup = [];

    try {
        const { data: bancas, error } = await supabase
            .from('bancas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!bancas || bancas.length === 0) {
            console.log("ℹ️ No hay bancas registradas para mostrar.");
            return;
        }

        // Puntos demostrativos en zonas clave de Panamá por si no tienen coordenadas en BD
        const ubicacionesPanamaDemo = [
            { lat: 8.9824, lng: -79.5199 }, // Bella Vista
            { lat: 9.0000, lng: -79.5000 }, // San Francisco
            { lat: 9.0150, lng: -79.5320 }, // El Dorado
            { lat: 8.9550, lng: -79.5480 }  // Albrook / Ancón
        ];

        bancas.forEach((banca, index) => {
            const lat = banca.latitud ? parseFloat(banca.latitud) : ubicacionesPanamaDemo[index % ubicacionesPanamaDemo.length].lat;
            const lng = banca.longitud ? parseFloat(banca.longitud) : ubicacionesPanamaDemo[index % ubicacionesPanamaDemo.length].lng;

            const nombre = banca.nombre_banca || banca.nombre || `Banca #${banca.id || index + 1}`;
            const operador = banca.vendedor_nombre || banca.operador || banca.vendedor || 'Sin Operador';
            const estatus = String(banca.estatus || 'activo').toLowerCase();
            const comision = banca.comision !== undefined ? banca.comision : 15;
            const limite = banca.limite_credito !== undefined ? banca.limite_credito : 300;

            const esActivo = estatus === 'activo';
            const colorStatus = esActivo ? '#10b981' : '#f43f5e';

            // Pin interactivo
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
                        font-size: 12px;">
                        <i class="fa-solid fa-store"></i>
                    </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            // Ventana emergente (Popup)
            const popupContent = `
                <div style="font-family: system-ui, sans-serif; padding: 4px; color: #0f172a; min-width: 180px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <strong style="font-size: 14px; color: #0f172a;">${nombre}</strong>
                        <span style="
                            background: ${esActivo ? '#d1fae5' : '#ffe4e6'};
                            color: ${esActivo ? '#065f46' : '#9f1239'};
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 10px;
                            font-weight: bold;
                            text-transform: uppercase;">
                            ${estatus}
                        </span>
                    </div>
                    <div style="font-size: 12px; line-height: 1.5; color: #475569;">
                        <p style="margin: 2px 0;">👤 <b>Operador:</b> ${operador}</p>
                        <p style="margin: 2px 0;">💵 <b>Comisión:</b> ${comision}%</p>
                        <p style="margin: 2px 0;">💳 <b>Límite Crédito:</b> $${Number(limite).toFixed(2)}</p>
                        <p style="margin: 2px 0; font-size: 10px; color: #94a3b8; margin-top: 4px;">
                            📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
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
        console.error("❌ Error al cargar las bancas en el mapa:", err);
    }
}

// =================================================================
// OBSERVADOR AUTOMÁTICO DE SECCIÓN (#section-geo)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    const geoSection = document.getElementById('section-geo');
    if (geoSection) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isHidden = geoSection.classList.contains('hidden');
                    if (!isHidden) {
                        initGeolocalizacionModule();
                    }
                }
            });
        });
        observer.observe(geoSection, { attributes: true });
    }
});

// Exponer globalmente para que index.html y otros módulos puedan llamarla sin colisiones
window.initGeolocalizacionModule = initGeolocalizacionModule;
window.initMap = initGeolocalizacionModule;
window.cargarBancasEnMapa = cargarBancasEnMapa;