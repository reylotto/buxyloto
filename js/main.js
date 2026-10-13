// --- CONTROLADOR PRINCIPAL (MAIN) ---
import { initPOSModule } from './pos.js';
import { initDashboardModule } from './dashboard.js';
import { initAdminModule } from './admin.js';
import { initBalancesCuadresModule } from './balancesCuadres.js'; // 👈 ¡Nuevo módulo integrado!

// 1. Detección inmediata de sesión al cargar la página (Anti-cierre con F5)
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    
    if (!supabase) {
        console.error("❌ Supabase no está inicializado globalmente en window.supabase");
        return;
    }

    // Verificar sesión almacenada de inmediato
    try {
        const { data: { session } } = await supabase.auth.getSession();
        procesarSesionUsuario(session);
    } catch (err) {
        console.error("Error al validar sesión en F5:", err);
        procesarSesionUsuario(null);
    }

    // Mantener sincronizado si hay cambios de sesión o cierre de sesión
    supabase.auth.onAuthStateChange((event, session) => {
        procesarSesionUsuario(session);
    });
});

// 2. Control robusto de vistas y pantallas
function procesarSesionUsuario(session) {
    const vistaLogin = document.getElementById('auth-view');
    const vistaDashboard = document.getElementById('dashboard-view');

    if (session) {
        window.currentUserProfile = session.user;
        
        // Mostrar la aplicación y ocultar el login
        if (vistaLogin) vistaLogin.classList.add('hidden');
        if (vistaDashboard) vistaDashboard.classList.remove('hidden');

        // Inicializar módulos del sistema si no se han cargado
        iniciarAplicacionPrincipal();
    } else {
        window.currentUserProfile = null;
        
        // Mostrar login y ocultar la aplicación
        if (vistaLogin) vistaLogin.classList.remove('hidden');
        if (vistaDashboard) vistaDashboard.classList.add('hidden');
    }
}

export function iniciarAplicacionPrincipal() {
    // Evitar múltiples inicializaciones si ya corrió
    if (window._buxyAppInitialized) return;
    window._buxyAppInitialized = true;

    console.log("¡Iniciando todos los módulos del sistema BuxyLoto POS!");
    
    configurarNavegacion();
    initDashboardModule();
    initPOSModule();
    initAdminModule();
    initBalancesCuadresModule(); // 👈 ¡Inicializamos el módulo de balances y cuadres aquí!
    restaurarUltimaVista();
}

function configurarNavegacion() {
    // 1. Ampliamos el radar para detectar cualquier botón de menú sin importar su estructura
    const navButtons = document.querySelectorAll('[data-target], [data-target-view], [data-section]');

    navButtons.forEach(btn => {
        // 🚨 SOLUCIÓN: Eliminamos la clonación (btn.cloneNode) que destruía los eventos nativos.
        // Ahora solo "escuchamos" el clic en paralelo a tu plantilla sin romper nada.
        btn.addEventListener('click', () => {
            const targetViewId = btn.getAttribute('data-target') || btn.getAttribute('data-target-view') || btn.getAttribute('data-section');
            if (targetViewId) {
                cambiarVista(targetViewId);
            }
        });
    });
}

export function cambiarVista(targetViewId) {
    // 2. Control aislado y forzado sobre la sección de Balances y Cuadres
    const sectionReports = document.getElementById('section-reports');
    if (sectionReports) {
        if (targetViewId === 'section-reports') {
            sectionReports.classList.remove('hidden');
            sectionReports.style.display = 'block';
        } else {
            sectionReports.classList.add('hidden');
            sectionReports.style.display = 'none'; // Cortar de raíz cualquier superposición
        }
    }

    // 3. Control seguro sobre todas las demás vistas posibles de la plantilla
    const vistas = document.querySelectorAll('.app-view, .content-section, section[id^="section-"]');
    vistas.forEach(vista => {
        if (vista.id !== targetViewId && vista.id !== 'section-reports') {
            vista.classList.add('hidden');
            vista.style.display = 'none';
        }
    });

    // 4. Activar visualmente la vista solicitada
    const vistaActiva = document.getElementById(targetViewId);
    if (vistaActiva) {
        vistaActiva.classList.remove('hidden');
        vistaActiva.style.display = 'block'; 
        localStorage.setItem('buxy_active_tab', targetViewId);
    }
}

function restaurarUltimaVista() {
    const ultimaSeccion = localStorage.getItem('buxy_active_tab');
    if (ultimaSeccion) {
        const vistaGuardada = document.getElementById(ultimaSeccion);
        if (vistaGuardada) {
            cambiarVista(ultimaSeccion);
        }
    }
}