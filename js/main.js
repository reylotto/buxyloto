// --- CONTROLADOR PRINCIPAL (MAIN) ---
import { initPOSModule } from './pos.js';
import { initDashboardModule } from './dashboard.js';
import { initAdminModule } from './admin.js';

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
    restaurarUltimaVista();
}

function configurarNavegacion() {
    const navButtons = document.querySelectorAll('[data-target-view]');

    navButtons.forEach(btn => {
        // Clonar el botón para evitar duplicar listeners si se llama varias veces
        const nuevoBtn = btn.cloneNode(true);
        btn.replaceWith(nuevoBtn);

        nuevoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetViewId = nuevoBtn.getAttribute('data-target-view');
            cambiarVista(targetViewId);
        });
    });
}

export function cambiarVista(targetViewId) {
    const vistas = document.querySelectorAll('.app-view');
    vistas.forEach(vista => vista.classList.add('hidden'));

    const vistaActiva = document.getElementById(targetViewId);
    if (vistaActiva) {
        vistaActiva.classList.remove('hidden');
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