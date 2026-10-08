// ==========================================================
// MÓDULO CENTRALIZADO DE PERMISOS Y FUNCIONES (js/permissions.js)
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

window.aplicarPermisosSecundarios = function() {
    const user = window.obtenerSesionActual();
    const rol = String(user.rol || 'admin').toLowerCase().trim();

    // Ocultar botones flotantes de edición/creación para quienes no son administradores
    if (!rol.includes('admin') && !rol.includes('administrador')) {
        document.querySelectorAll('.admin-only, #btn-open-usuario-modal, #btn-open-banca-modal, #btn-open-loteria-modal').forEach(el => {
            el.style.display = 'none';
        });
    }

    // Proteger el botón de escrutinio
    if (rol.includes('supervisor')) {
        const formEscrutinio = document.getElementById('form-registrar-resultados');
        if (formEscrutinio) formEscrutinio.style.display = 'none';

        document.querySelectorAll('.btn-guardar-escrutinio, button[type="submit"]').forEach(btn => {
            const txt = btn.textContent.toLowerCase();
            if (txt.includes('escrutinio') || txt.includes('registrar')) {
                btn.style.display = 'none';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', window.aplicarPermisosSecundarios);
window.addEventListener('hashchange', window.aplicarPermisosSecundarios);