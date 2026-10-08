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
        // 1. Evitar bloqueos en la pantalla de login
        const loginWrapper = document.getElementById('auth-login-wrapper');
        if (loginWrapper && !loginWrapper.classList.contains('hidden')) {
            return;
        }

        const sesion = obtenerSesionSegura();
        const rol = String(sesion.rol || 'admin').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.username || 'Usuario';

        // 2. ACTUALIZAR CABECERA (Respetando tu botón de Cerrar Sesión)
        const nameEl = document.querySelector('.user-name-display, #admin-user-name, header .font-bold');
        if (nameEl && !nameEl.textContent.includes('Plataforma')) nameEl.textContent = nombre;

        const roleEl = document.querySelector('.user-role-display, #admin-user-role, header span.text-xs');
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

        // 3. ELIMINAR EL SIMULADOR DE ROLES SOLO EN LA CABECERA (NO EN LOS FORMULARIOS)
        // Buscamos específicamente dentro del "header" o la parte superior
        const selectsHeader = document.querySelectorAll('header select, .top-0 select');
        selectsHeader.forEach(select => {
            select.style.display = 'none'; // Oculta solo la cajita de selección arriba
            const label = select.previousElementSibling;
            if (label && label.tagName === 'LABEL') {
                label.style.display = 'none'; // Oculta el texto "CAMBIAR ROL"
            }
        });

        // 4. OCULTAR MENÚS Y POS PARA SUPERVISORES
        if (rol.includes('supervisor')) {
            const ocultarElementosProhibidos = () => {
                const linksMenu = document.querySelectorAll('aside nav a, nav a, .sidebar a');
                linksMenu.forEach(link => {
                    const texto = (link.textContent || '').toLowerCase().trim();
                    const href = link.getAttribute('href') || '';
                    if (
                        texto.includes('punto de venta') || href.includes('pos') ||
                        texto.includes('gestión de usuarios') || texto.includes('gestion de usuarios') ||
                        texto.includes('bancas') || texto.includes('vendedores') ||
                        texto.includes('loterías') || texto.includes('loterias') ||
                        texto.includes('control de riesgo') || texto.includes('riesgo') ||
                        texto.includes('personalizar ticket') ||
                        texto.includes('geolocalización') || texto.includes('geolocalizacion')
                    ) {
                        const contenedor = link.closest('li') || link;
                        if (contenedor) contenedor.style.display = 'none';
                    }
                });

                // Ocultar formulario de escrutinio
                const formEscrutinio = document.getElementById('form-registrar-resultados');
                if (formEscrutinio) formEscrutinio.style.display = 'none';

                document.querySelectorAll('.btn-guardar-escrutinio, button[type="submit"]').forEach(btn => {
                    const txt = (btn.textContent || '').toLowerCase();
                    if (txt.includes('escrutinio') || txt.includes('registrar')) {
                        btn.style.display = 'none';
                    }
                });
            };

            ocultarElementosProhibidos();
            setTimeout(ocultarElementosProhibidos, 500); 
        }
    };

    document.addEventListener('DOMContentLoaded', window.aplicarBlindajeSupervisor);
    window.addEventListener('hashchange', window.aplicarBlindajeSupervisor);
    setTimeout(window.aplicarBlindajeSupervisor, 800);
})();