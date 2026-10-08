// ==========================================================
// ESCUDO Y CONTROL DE ROLES (js/roleManager.js) - VERSIÓN SEGURA
// ==========================================================

(function() {
    function obtenerSesionSegura() {
        try {
            return JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        } catch(e) {
            return {};
        }
    }

    window.aplicarBlindajeSupervisor = function() {
        // No hacer nada si estamos en la pantalla de inicio de sesión
        const loginWrapper = document.getElementById('auth-login-wrapper');
        if (loginWrapper && !loginWrapper.classList.contains('hidden')) {
            return;
        }

        const sesion = obtenerSesionSegura();
        const rol = String(sesion.rol || 'admin').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.username || 'Usuario';

        // 1. Mostrar nombre y rol en la cabecera, respetando tu botón de cerrar sesión
        const nameEl = document.querySelector('.user-name-display, #admin-user-name');
        if (nameEl && !nameEl.textContent.includes('Plataforma')) nameEl.textContent = nombre;

        const roleEl = document.querySelector('.user-role-display, #admin-user-role');
        if (roleEl) {
            if (rol.includes('supervisor')) {
                roleEl.textContent = `Supervisor (${zona})`;
                roleEl.className = 'text-amber-400 font-semibold text-xs';
            } else if (rol.includes('caja') || rol.includes('vendedor')) {
                roleEl.textContent = 'Vendedor POS';
                roleEl.className = 'text-cyan-400 font-semibold text-xs';
            } else {
                roleEl.textContent = 'Administrador Central';
                roleEl.className = 'text-emerald-400 font-semibold text-xs';
            }
        }

        // 2. Ocultar de forma segura el menú de cambio de rol sin borrar el DOM
        const selectorDeRol = document.querySelector('select[id*="rol-simulacion"], .cambiar-rol-container');
        if (selectorDeRol) {
            selectorDeRol.style.display = 'none';
        }

        // 3. INYECCIÓN CSS: Oculta secciones de administración SOLO si el usuario es supervisor
        if (rol.includes('supervisor')) {
            if (!document.getElementById('css-blindaje-supervisor')) {
                const style = document.createElement('style');
                style.id = 'css-blindaje-supervisor';
                style.innerHTML = `
                    /* Oculta los enlaces de la barra lateral al supervisor */
                    a[href*="pos"], [data-target="pos"], 
                    a[href*="usuarios"], [data-target="usuarios"],
                    a[href*="bancas"], [data-target="bancas"],
                    a[href*="loterias"], [data-target="loterias"],
                    a[href*="riesgo"], [data-target="riesgo"],
                    a[href*="personalizar"], a[href*="geolocalizacion"],
                    /* Oculta formularios de resultados y botones de guardar escrutinio */
                    #form-registrar-resultados, .btn-guardar-escrutinio {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', window.aplicarBlindajeSupervisor);
    window.addEventListener('hashchange', window.aplicarBlindajeSupervisor);
    setTimeout(window.aplicarBlindajeSupervisor, 800);
})();