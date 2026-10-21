// ==========================================================
// ESCUDO Y CONTROL ESTRICTO DE ROLES (js/roleManager.js)
// ==========================================================
(function() {
    function obtenerSesionSegura() {
        try { return JSON.parse(localStorage.getItem('usuario_sesion') || '{}'); } catch(e) { return {}; }
    }

    window.aplicarRolesSeguridad = function() {
        const loginWrapper = document.getElementById('auth-login-wrapper');
        if (loginWrapper && !loginWrapper.classList.contains('hidden')) return; 

        const sesion = obtenerSesionSegura();
        if (!sesion || Object.keys(sesion).length === 0) return;

        const rol = String(sesion.rol || 'caja').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.nombre_banca || sesion.username || 'Usuario';

        const hashActual = window.location.hash.replace('#', '') || 'dashboard';
        const seccionLimpia = hashActual.replace('section-', '');

        // 🛑 BLOQUEO ABSOLUTO PARA CAJEROS/VENDEDORES
        if (rol.includes('caja') || rol.includes('vendedor') || rol.includes('banca')) {
            const urlTerminalMovil = 'https://tu-enlace-del-terminal-movil.com'; 
            alert("Acceso denegado al Dashboard. Redirigiendo al Terminal Móvil POS...");
            window.location.href = urlTerminalMovil;
            return; 
        }

        // 🛑 BLOQUEO SUPERVISOR: Ya se permite ver "historial-numeros"
        if (rol.includes('supervisor')) {
            const prohibidasSupervisor = ['pos', 'users', 'bancas', 'loterias', 'riesgos', 'ticket-config', 'geo'];
            if (prohibidasSupervisor.includes(seccionLimpia)) {
                window.location.hash = '#dashboard';
                return; 
            }
        }

        // 1. ACTUALIZAR CABECERA
        const nameEl = document.querySelector('#header-user-name');
        const roleEl = document.querySelector('#header-user-role');
        const iconEl = document.querySelector('#user-role-icon');
        const dropNameEl = document.querySelector('#dropdown-user-name');
        const dropRoleEl = document.querySelector('#dropdown-user-role');

        if (nameEl) nameEl.textContent = nombre;
        if (dropNameEl) dropNameEl.textContent = nombre;

        if (roleEl) {
            if (rol.includes('admin')) {
                roleEl.textContent = 'Administrador Central';
                roleEl.className = 'text-[10px] text-emerald-400 leading-tight';
                if (iconEl) iconEl.className = 'fa-solid fa-crown';
                if (dropRoleEl) { dropRoleEl.textContent = 'Administrador Principal'; dropRoleEl.className = 'text-[11px] text-emerald-400 font-medium'; }
            } else if (rol.includes('supervisor')) {
                roleEl.textContent = `Supervisor (${zona})`;
                roleEl.className = 'text-[10px] text-amber-400 leading-tight';
                if (iconEl) iconEl.className = 'fa-solid fa-user-tie';
                if (dropRoleEl) { dropRoleEl.textContent = `Supervisor (${zona})`; dropRoleEl.className = 'text-[11px] text-amber-400 font-medium'; }
            }
        }

        const simuladorRol = document.getElementById('user-role-switch');
        if (simuladorRol) simuladorRol.parentElement.style.display = 'none';

        // 2. OCULTAR MENÚS (Sin romper tu CSS)
        const botonesMenu = document.querySelectorAll('.nav-link');
        botonesMenu.forEach(btn => {
            const target = btn.getAttribute('data-target');
            if (!target) return;
            btn.style.display = ''; // Respeta tu CSS original

            if (rol.includes('supervisor')) {
                const prohibidosMenu = ['section-pos', 'section-users', 'section-bancas', 'section-loterias', 'section-riesgos', 'section-ticket-config', 'section-geo'];
                if (prohibidosMenu.includes(target)) btn.style.display = 'none';
            } 
        });

        // 3. ESCUDO DE ACERO PARA ELEMENTOS .admin-only
        if (!rol.includes('admin')) {
            // Inyectamos CSS global para que nada pueda escapar, ni siquiera lo que carga lento de Supabase
            if (!document.getElementById('escudo-admin-only')) {
                const style = document.createElement('style');
                style.id = 'escudo-admin-only';
                style.innerHTML = '.admin-only { display: none !important; pointer-events: none !important; opacity: 0 !important; visibility: hidden !important; }';
                document.head.appendChild(style);
            }
            
            const formResultados = document.getElementById('form-register-results');
            if (formResultados) formResultados.style.display = 'none';
            const btnProfile = document.getElementById('btn-user-profile');
            if (btnProfile) btnProfile.style.display = 'none';
        }
    };

    document.addEventListener('DOMContentLoaded', window.aplicarRolesSeguridad);
    window.addEventListener('hashchange', window.aplicarRolesSeguridad);
    setTimeout(window.aplicarRolesSeguridad, 800);
})();