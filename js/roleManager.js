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

    window.aplicarRolesSeguridad = function() {
        const loginWrapper = document.getElementById('auth-login-wrapper');
        if (loginWrapper && !loginWrapper.classList.contains('hidden')) {
            return; // No aplicar escudo si estamos en el login
        }

        const sesion = obtenerSesionSegura();
        if (!sesion || Object.keys(sesion).length === 0) return;

        const rol = String(sesion.rol || 'caja').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.nombre_banca || sesion.username || 'Usuario';

        // ==========================================
        // 🚨 EL GUARDIA DE SEGURIDAD DE URLs 🚨
        // ==========================================
        // Obtenemos la sección actual de la URL y la limpiamos
        const hashActual = window.location.hash.replace('#', '') || 'dashboard';
        const seccionLimpia = hashActual.replace('section-', '');

        // BLOQUEO CAJERO/VENDEDOR: Solo puede ver POS, Tickets y Resultados
        if (rol.includes('caja') || rol.includes('vendedor') || rol.includes('banca')) {
            const permitidasCajero = ['pos', 'tickets', 'results'];
            if (!permitidasCajero.includes(seccionLimpia) && hashActual !== '') {
                window.location.hash = '#pos'; // Lo devuelve al POS a la fuerza
                return; // Detenemos aquí para que no alcance a cargar la vista prohibida
            }
        }

        // BLOQUEO SUPERVISOR: No ve POS, Usuarios, Configuración, etc.
        if (rol.includes('supervisor')) {
            const prohibidasSupervisor = ['pos', 'users', 'bancas', 'loterias', 'riesgos', 'ticket-config', 'geo', 'historial-numeros'];
            if (prohibidasSupervisor.includes(seccionLimpia)) {
                window.location.hash = '#dashboard'; // Lo devuelve al dashboard a la fuerza
                return; 
            }
        }
        // ==========================================

        // 1. ACTUALIZAR CABECERA DE USUARIO
        const nameEl = document.querySelector('#header-user-name');
        const roleEl = document.querySelector('#header-user-role');
        const iconEl = document.querySelector('#user-role-icon');

        if (nameEl) nameEl.textContent = nombre;
        if (roleEl) {
            if (rol.includes('admin')) {
                roleEl.textContent = 'Administrador Central';
                roleEl.className = 'text-[10px] text-emerald-400 leading-tight';
                if (iconEl) iconEl.className = 'fa-solid fa-crown';
            } else if (rol.includes('supervisor')) {
                roleEl.textContent = `Supervisor (${zona})`;
                roleEl.className = 'text-[10px] text-amber-400 leading-tight';
                if (iconEl) iconEl.className = 'fa-solid fa-user-tie';
            } else {
                roleEl.textContent = 'Operador POS';
                roleEl.className = 'text-[10px] text-cyan-400 leading-tight';
                if (iconEl) iconEl.className = 'fa-solid fa-store';
            }
        }

        // Ocultar selector de simulación de roles de la maqueta
        const simuladorRol = document.getElementById('user-role-switch');
        if (simuladorRol) simuladorRol.parentElement.style.display = 'none';

        // 2. OCULTAR MENÚS SEGÚN EL ROL
        const botonesMenu = document.querySelectorAll('.nav-link');
        
        botonesMenu.forEach(btn => {
            const target = btn.getAttribute('data-target');
            if (!target) return;

            // Restablecemos visibilidad por defecto
            btn.style.display = 'flex';

            if (rol.includes('supervisor')) {
                // SUPERVISOR: No ve POS, Gestión de Usuarios, Bancas, Riesgos, Loterías, Configuración ni Mapa
                const prohibidosSupervisor = [
                    'section-pos', 'section-users', 'section-bancas', 'section-loterias', 
                    'section-riesgos', 'section-ticket-config', 'section-geo', 'section-historial-numeros'
                ];
                if (prohibidosSupervisor.includes(target)) {
                    btn.style.display = 'none';
                }
            } 
            else if (rol.includes('caja') || rol.includes('vendedor') || rol.includes('banca')) {
                // CAJERO/VENDEDOR: Solo ve Punto de Venta (POS) y su Historial de Tickets (y Resultados)
                const permitidosCaja = ['section-pos', 'section-tickets', 'section-results'];
                if (!permitidosCaja.includes(target)) {
                    btn.style.display = 'none';
                }
            }
            // El Admin ve todo, no se oculta nada.
        });

        // 3. OCULTAR ACCIONES Y BOTONES DE ADMINISTRACIÓN
        if (!rol.includes('admin')) {
            // Ocultar cualquier elemento marcado con clase 'admin-only'
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            
            // Ocultar formularios de registrar premios y botones de sincronización masiva
            const formResultados = document.getElementById('form-register-results');
            if (formResultados) formResultados.style.display = 'none';
            
            const btnAutoSync = document.getElementById('btn-auto-sync');
            if (btnAutoSync) btnAutoSync.style.display = 'none';

            // Ocultar opciones del perfil de administrador
            const btnProfile = document.getElementById('btn-user-profile');
            if (btnProfile) btnProfile.style.display = 'none';
        }
    };

    // Inicializar el blindaje en eventos clave
    document.addEventListener('DOMContentLoaded', window.aplicarRolesSeguridad);
    window.addEventListener('hashchange', window.aplicarRolesSeguridad);
    setTimeout(window.aplicarRolesSeguridad, 800);
})();