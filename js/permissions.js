// ==========================================================
// MÓDULO CENTRALIZADO DE PERMISOS, ROLES Y ZONAS (js/permissions.js)
// ==========================================================

window.obtenerSesionActual = function() {
    try {
        const sesion = localStorage.getItem('usuario_sesion');
        return sesion ? JSON.parse(sesion) : {};
    } catch (e) {
        return {};
    }
};

window.esAdministradorGlobal = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || '').toLowerCase().trim();
    return rol === 'admin' || rol === 'administrador';
};

window.obtenerFiltroZonaSupervisor = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || '').toLowerCase().trim();
    if (rol === 'supervisor' && user.zona) {
        return user.zona; // Retorna por ejemplo "Zona Ciudad" o "Zona Oeste"
    }
    return null; // Si es admin, retorna null para ver todo
};

// Aplicar restricciones visuales y actualizar cabecera
window.aplicarPermisosGlobales = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || 'admin').toLowerCase().trim();
    const zona = user.zona || 'Zona General';
    const nombre = user.nombre || user.nombre_completo || user.username || 'Usuario';

    console.log(`🛡️ Control de Roles -> [Rol: ${rol}] [Zona: ${zona}] [Nombre: ${nombre}]`);

    // 1. Actualizar el indicador superior derecho (Nombre y Rol Real)
    setTimeout(() => {
        // Buscar el elemento del nombre en la esquina superior derecha
        const headerNameEl = document.querySelector('#admin-user-name, .user-name-display, header div.font-bold');
        if (headerNameEl && !headerNameEl.textContent.includes('Plataforma')) {
            headerNameEl.textContent = nombre;
        }

        // Buscar el elemento del rol/estatus en la esquina superior derecha
        const headerRoleEl = document.querySelector('#admin-user-role, .user-role-display, header span.text-xs');
        if (headerRoleEl) {
            if (rol === 'supervisor') {
                headerRoleEl.textContent = `Supervisor (${zona})`;
                headerRoleEl.className = 'text-amber-400 font-semibold text-xs';
            } else if (rol === 'caja' || rol === 'vendedor') {
                headerRoleEl.textContent = 'Banca / Vendedor POS';
                headerRoleEl.className = 'text-cyan-400 font-semibold text-xs';
            } else {
                headerRoleEl.textContent = 'Administrador Central';
                headerRoleEl.className = 'text-emerald-400 font-semibold text-xs';
            }
        }
    }, 350);

    // 2. Ocultar menús y secciones según el rol
    setTimeout(() => {
        const linksMenu = document.querySelectorAll('aside nav a, nav a, .sidebar a');
        
        linksMenu.forEach(link => {
            const texto = link.textContent.toLowerCase();
            const href = link.getAttribute('href') || '';

            if (rol === 'supervisor') {
                // Supervisores NO pueden ver POS, Gestión de Usuarios, Bancas, Loterías, Riesgo, etc.
                if (
                    texto.includes('punto de venta') || href.includes('pos') ||
                    texto.includes('gestión de usuarios') || texto.includes('gestion de usuarios') ||
                    texto.includes('bancas') || texto.includes('vendedores') ||
                    texto.includes('loterías') || texto.includes('loterias') ||
                    texto.includes('control de riesgo') || texto.includes('riesgo') ||
                    texto.includes('personalizar ticket') ||
                    texto.includes('geolocalización') || texto.includes('geolocalizacion')
                ) {
                    const contenedor = link.closest('li') || link.closest('div') || link;
                    if (contenedor) contenedor.style.display = 'none';
                }
            } else if (rol === 'caja' || rol === 'vendedor') {
                // Vendedores solo ven POS e Historial
                if (!texto.includes('pos') && !texto.includes('punto de venta') && !texto.includes('historial')) {
                    const contenedor = link.closest('li') || link.closest('div') || link;
                    if (contenedor) contenedor.style.display = 'none';
                }
            }
        });

        // Ocultar botones de administración si no es admin
        if (rol !== 'admin' && rol !== 'administrador') {
            document.querySelectorAll('.admin-only, #btn-open-usuario-modal, #btn-open-banca-modal, #btn-open-loteria-modal').forEach(el => {
                el.style.display = 'none';
            });
        }
    }, 250);
};

// Ejecutar automáticamente al cargar la página y al cambiar de sección
document.addEventListener('DOMContentLoaded', window.aplicarPermisosGlobales);
window.addEventListener('hashchange', window.aplicarPermisosGlobales);