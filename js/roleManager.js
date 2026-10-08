// ==========================================================
// ESCUDO Y CONTROL ESTRICTO DE ROLES (js/roleManager.js)
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
        const loginWrapper = document.getElementById('auth-login-wrapper');
        if (loginWrapper && !loginWrapper.classList.contains('hidden')) {
            return; // Si estamos en el login, no hacemos nada
        }

        const sesion = obtenerSesionSegura();
        const rol = String(sesion.rol || 'admin').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.username || 'Usuario';

        // 1. ACTUALIZAR LA CABECERA SUPERIOR DERECHA
        const nameEl = document.querySelector('#admin-user-name, .user-name-display, header div.font-bold');
        if (nameEl && !nameEl.textContent.includes('Plataforma')) {
            nameEl.textContent = nombre;
        }

        const roleEl = document.querySelector('#admin-user-role, .user-role-display, header span.text-xs');
        if (roleEl) {
            if (rol.includes('supervisor')) {
                roleEl.textContent = `Supervisor (${zona})`;
                roleEl.className = 'text-amber-400 font-semibold text-xs';
            } else if (rol.includes('caja') || rol.includes('vendedor')) {
                roleEl.textContent = 'Banca / Vendedor POS';
                roleEl.className = 'text-cyan-400 font-semibold text-xs';
            } else {
                roleEl.textContent = 'Administrador Central';
                roleEl.className = 'text-emerald-400 font-semibold text-xs';
            }
        }

        // 2. OCULTAR SIMULADOR DE ROLES DE FORMA SEGURA (Sin borrar el dashboard)
        const etiquetas = document.querySelectorAll('label, span, p');
        etiquetas.forEach(el => {
            const txt = (el.textContent || '').toUpperCase();
            if (txt.includes('CAMBIAR ROL') || txt.includes('SIMULACIÓN')) {
                // Solo borramos el div pequeñito que envuelve al select
                const contenedor = el.closest('.relative') || el.parentElement;
                if (contenedor) contenedor.style.display = 'none';
            }
        });

        // 3. BLOQUEO ABSOLUTO PARA SUPERVISORES
        if (rol.includes('supervisor')) {
            if (!document.getElementById('css-blindaje-supervisor')) {
                const style = document.createElement('style');
                style.id = 'css-blindaje-supervisor';
                style.innerHTML = `
                    a[href*="pos"], [data-target="pos"], .nav-item-pos,
                    a[href*="usuarios"], [data-target="usuarios"],
                    a[href*="bancas"], [data-target="bancas"],
                    a[href*="loterias"], [data-target="loterias"],
                    a[href*="riesgo"], [data-target="riesgo"],
                    a[href*="personalizar"], a[href*="geolocalizacion"],
                    #form-registrar-resultados, .btn-guardar-escrutinio {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }

            const observer = new MutationObserver(() => {
                const loginW = document.getElementById('auth-login-wrapper');
                if (loginW && !loginW.classList.contains('hidden')) return;

                document.querySelectorAll('aside nav a, nav a, .sidebar a').forEach(link => {
                    const t = (link.textContent || '').toLowerCase().trim();
                    const h = link.getAttribute('href') || '';
                    if (
                        t.includes('punto de venta') || h.includes('pos') ||
                        t.includes('gestión de usuarios') || t.includes('gestion de usuarios') ||
                        t.includes('bancas') || t.includes('vendedores') ||
                        t.includes('loterías') || t.includes('loterias') ||
                        t.includes('control de riesgo') || t.includes('riesgo') ||
                        t.includes('personalizar ticket') ||
                        t.includes('geolocalización') || t.includes('geolocalizacion')
                    ) {
                        const item = link.closest('li') || link.closest('div') || link;
                        if (item) item.style.display = 'none';
                    }
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    document.addEventListener('DOMContentLoaded', window.aplicarBlindajeSupervisor);
    window.addEventListener('hashchange', window.aplicarBlindajeSupervisor);
    window.addEventListener('load', window.aplicarBlindajeSupervisor);
})();