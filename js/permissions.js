// ==========================================================
// MÓDULO CENTRALIZADO DE PERMISOS Y ZONAS (js/permissions.js)
// ==========================================================

window.obtenerSesionActual = function() {
    try {
        const sesion = localStorage.getItem('usuario_sesion');
        return sesion ? JSON.parse(sesion) : { rol: 'admin', zona: 'Zona General' };
    } catch (e) {
        return { rol: 'admin', zona: 'Zona General' };
    }
};

window.obtenerFiltroZonaSupervisor = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || '').toLowerCase().trim();
    if (rol.includes('supervisor') && user.zona) {
        return String(user.zona).trim();
    }
    return null; // Admin ve todo
};

window.aplicarPermisosGlobales = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || 'admin').toLowerCase().trim();
    const zona = user.zona || 'Zona General';
    const nombre = user.nombre || user.username || 'Usuario';

    console.log(`🛡️ [SEGURIDAD] Aplicando permisos -> [Rol: ${rol}] [Zona: ${zona}]`);

    // 1. Ocultar automáticamente cualquier menú o botón de "Cambiar Rol" o "Simulación" en pantalla
    document.querySelectorAll('div, span, button, select, label').forEach(el => {
        const texto = el.textContent.toLowerCase();
        if (texto.includes('cambiar rol') || texto.includes('simulación') || texto.includes('simulacion')) {
            const contenedor = el.closest('div.relative') || el.closest('div') || el;
            if (contenedor) contenedor.style.display = 'none';
        }
    });

    // 2. Actualizar nombre y rol real en la esquina superior derecha
    setTimeout(() => {
        const headerNameEl = document.querySelector('#admin-user-name, .user-name-display, header div.font-bold');
        if (headerNameEl && !headerNameEl.textContent.includes('Plataforma')) {
            headerNameEl.textContent = nombre;
        }

        const headerRoleEl = document.querySelector('#admin-user-role, .user-role-display, header span.text-xs');
        if (headerRoleEl) {
            if (rol.includes('supervisor')) {
                headerRoleEl.textContent = `Supervisor (${zona})`;
                headerRoleEl.className = 'text-amber-400 font-semibold text-xs';
            } else if (rol.includes('caja') || rol.includes('vendedor')) {
                headerRoleEl.textContent = 'Banca / Vendedor POS';
                headerRoleEl.className = 'text-cyan-400 font-semibold text-xs';
            } else {
                headerRoleEl.textContent = 'Administrador Central';
                headerRoleEl.className = 'text-emerald-400 font-semibold text-xs';
            }
        }
    }, 300);

    // 3. Bloqueo estricto por CSS para Supervisores (Oculta POS, Escrutinio y Administración)
    if (rol.includes('supervisor')) {
        const styleId = 'supervisor-security-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                a[href*="pos"], [data-target="pos"], .nav-item-pos,
                a[href*="usuarios"], [data-target="usuarios"],
                a[href*="bancas"], [data-target="bancas"],
                a[href*="loterias"], [data-target="loterias"],
                a[href*="riesgo"], [data-target="riesgo"],
                #form-registrar-resultados, .btn-guardar-escrutinio {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
};

document.addEventListener('DOMContentLoaded', window.aplicarPermisosGlobales);
window.addEventListener('hashchange', window.aplicarPermisosGlobales);