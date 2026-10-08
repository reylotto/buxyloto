// ==========================================================
// MÓDULO CENTRALIZADO DE PERMISOS, ROLES Y ZONAS (js/permissions.js)
// ==========================================================

window.obtenerSesionActual = function() {
    try {
        const sesion = localStorage.getItem('usuario_sesion');
        return sesion ? JSON.parse(sesion) : { rol: 'admin', zona: 'Zona General' };
    } catch (e) {
        return { rol: 'admin', zona: 'Zona General' };
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
    if (rol.includes('supervisor') && user.zona) {
        return String(user.zona).trim();
    }
    return null;
};

window.aplicarPermisosGlobales = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || 'admin').toLowerCase().trim();
    const zona = user.zona || 'Zona General';
    const nombre = user.nombre || user.nombre_completo || user.username || 'Usuario';

    console.log(`🛡️ [SEGURIDAD] Aplicando permisos estrictos -> [Rol: ${rol}] [Zona: ${zona}]`);

    setTimeout(() => {
        // Búsqueda segura por texto en lugar de usar selectores CSS inválidos (:contains)
        document.querySelectorAll('div, label, select, span').forEach(el => {
            const txt = (el.textContent || '').toUpperCase();
            if (txt.includes('CAMBIAR ROL') || txt.includes('SIMULACIÓN')) {
                const padre = el.closest('div.relative') || el.closest('div') || el;
                if (padre) padre.style.display = 'none';
            }
        });

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

    setTimeout(() => {
        const linksMenu = document.querySelectorAll('aside nav a, nav a, .sidebar a');
        
        linksMenu.forEach(link => {
            const texto = link.textContent.toLowerCase().trim();
            const href = link.getAttribute('href') || '';

            if (rol.includes('supervisor')) {
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
            } else if (rol.includes('caja') || rol.includes('vendedor')) {
                if (!texto.includes('pos') && !texto.includes('punto de venta') && !texto.includes('historial')) {
                    const contenedor = link.closest('li') || link.closest('div') || link;
                    if (contenedor) contenedor.style.display = 'none';
                }
            }
        });

        if (rol.includes('supervisor')) {
            const formEscrutinio = document.getElementById('form-registrar-resultados');
            if (formEscrutinio) {
                formEscrutinio.style.display = 'none';
            }
            document.querySelectorAll('.btn-guardar-escrutinio, button[type="submit"]').forEach(btn => {
                if (btn.textContent.toLowerCase().includes('escrutinio') || btn.textContent.toLowerCase().includes('registrar')) {
                    btn.style.display = 'none';
                }
            });
        }

        if (!rol.includes('admin') && !rol.includes('administrador')) {
            document.querySelectorAll('.admin-only, #btn-open-usuario-modal, #btn-open-banca-modal, #btn-open-loteria-modal').forEach(el => {
                el.style.display = 'none';
            });
        }
    }, 250);
};

document.addEventListener('DOMContentLoaded', window.aplicarPermisosGlobales);
window.addEventListener('hashchange', window.aplicarPermisosGlobales);