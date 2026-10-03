// =================================================================
// MÓDULO DE NAVEGACIÓN MÓVIL EXACTO PARA <ASIDE ID="SIDEBAR">
// =================================================================

export function initMobileModule() {
    console.log("📱 Inicializando navegación móvil para #sidebar...");

    asegurarMetaViewport();
    crearBarraSuperiorMobile();
    crearOverlayMenu();
    vincularControlesSidebar();
}

function asegurarMetaViewport() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
}

/**
 * Inyecta la barra superior para celulares con el botón hamburguesa
 */
function crearBarraSuperiorMobile() {
    if (document.getElementById('mobile-top-header')) return;

    const header = document.createElement('header');
    header.id = 'mobile-top-header';
    header.className = 'md:hidden bg-slate-900 border-b border-slate-700/80 p-3 flex items-center justify-between sticky top-0 z-40 shadow-lg';
    
    header.innerHTML = `
        <div class="flex items-center gap-3">
            <button id="btn-toggle-mobile" type="button" class="text-white text-lg p-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 transition-all">
                <i class="fa-solid fa-bars"></i>
            </button>
            <div class="flex items-center gap-2">
                <span class="font-extrabold text-white text-sm tracking-wide">BuxyLoto</span>
                <span class="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">POS</span>
            </div>
        </div>
        <span class="text-[10px] text-slate-300 font-semibold bg-slate-800/90 px-3 py-1 rounded-full border border-slate-700/80 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Panel Móvil
        </span>
    `;

    document.body.prepend(header);
}

/**
 * Inyecta la capa oscura traslúcida al desplegar el menú
 */
function crearOverlayMenu() {
    if (document.getElementById('mobile-menu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mobile-menu-overlay';
    overlay.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 hidden md:hidden transition-all duration-300';
    document.body.appendChild(overlay);
}

/**
 * Vincula el comportamiento del botón hamburguesa con el <aside id="sidebar">
 */
function vincularControlesSidebar() {
    const btnToggle = document.getElementById('btn-toggle-mobile');
    const overlay = document.getElementById('mobile-menu-overlay');
    const sidebar = document.getElementById('sidebar') || document.querySelector('aside');

    if (!sidebar) {
        console.warn("⚠️ No se encontró la barra lateral (#sidebar).");
        return;
    }

    // Configurar clases para posición flotante móvil
    const alternarMenu = (forzarCierre = false) => {
        const estaOculto = sidebar.classList.contains('hidden');

        if (forzarCierre || !estaOculto) {
            // CERRAR MENÚ EN MÓVIL
            if (window.innerWidth < 768) {
                sidebar.classList.add('hidden');
            }
            if (overlay) overlay.classList.add('hidden');
        } else {
            // ABRIR MENÚ EN MÓVIL
            sidebar.classList.remove('hidden');
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'w-64', 'shadow-2xl');
            if (overlay) overlay.classList.remove('hidden');
        }
    };

    // Evento de clic en el botón hamburguesa
    if (btnToggle) {
        btnToggle.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            alternarMenu();
        };
    }

    // Evento de clic fuera del menú
    if (overlay) {
        overlay.onclick = () => alternarMenu(true);
    }

    // Al presionar cualquier opción (Dashboard, POS, Balances, etc.) se cierra el menú en celulares
    sidebar.querySelectorAll('button, a').forEach(elem => {
        elem.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                setTimeout(() => alternarMenu(true), 150);
            }
        });
    });

    // Controlar cambio de pantalla horizontal / vertical
    const ajustarVista = () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'shadow-2xl');
            sidebar.classList.add('hidden', 'md:flex');
            if (overlay) overlay.classList.add('hidden');
        } else {
            sidebar.classList.add('hidden');
        }
    };

    ajustarVista();
    window.addEventListener('resize', ajustarVista);
}

// Inicializar al cargar el documento
document.addEventListener('DOMContentLoaded', initMobileModule);
window.initMobileModule = initMobileModule;