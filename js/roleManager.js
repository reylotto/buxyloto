// ==========================================================
// GESTOR CENTRAL DE ROLES, ZONAS Y SEGURIDAD (js/roleManager.js)
// ==========================================================

(function() {
    function obtenerSesionActual() {
        try {
            return JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
        } catch(e) {
            return {};
        }
    }

    window.aplicarControlEstrictoRoles = function() {
        const sesion = obtenerSesionActual();
        const rol = String(sesion.rol || 'admin').toLowerCase().trim();
        const zona = sesion.zona || 'Zona General';
        const nombre = sesion.nombre || sesion.username || 'Usuario';

        console.log(`🛡️ [ROLE MANAGER] Usuario conectado -> [Rol: ${rol}] [Zona: ${zona}]`);

        // 1. Actualizar de forma permanente la cabecera superior derecha
        const actualizarCabecera = () => {
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

            // Ocultar cualquier simulador de roles o selector en el header
            document.querySelectorAll('div, span, button, select, label').forEach(el => {
                if (el.textContent && (el.textContent.includes('CAMBIAR ROL') || el.textContent.includes('SIMULACIÓN'))) {
                    const contenedor = el.closest('div.relative') || el.closest('div');
                    if (contenedor) contenedor.style.display = 'none';
                }
            });
        };

        actualizarCabecera();
        setTimeout(actualizarCabecera, 500);
        setTimeout(actualizarCabecera, 1500);

        // 2. Si es SUPERVISOR, bloquear visualmente y en tiempo real
        if (rol.includes('supervisor')) {
            // Inyectar reglas CSS de seguridad absoluta
            if (!document.getElementById('supervisor-security-css')) {
                const style = document.createElement('style');
                style.id = 'supervisor-security-css';
                style.innerHTML = `
                    /* Ocultar POS, Usuarios, Bancas, Loterías, Riesgo y formularios de escrutinio */
                    a[href*="pos"], [data-target="pos"], .nav-item-pos,
                    a[href*="usuarios"], [data-target="usuarios"],
                    a[href*="bancas"], [data-target="bancas"],
                    a[href*="loterias"], [data-target="loterias"],
                    a[href*="riesgo"], [data-target="riesgo"],
                    a[href*="personalizar"], a[href*="geolocalizacion"],
                    #form-registrar-resultados, .btn-guardar-escrutinio,
                    button[onclick*="guardarLoteria"], button[onclick*="guardarUsuario"] {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // Vigía constante (MutationObserver): Oculta enlaces del menú aunque el DOM se actualice dinámicamente
            const observer = new MutationObserver(() => {
                document.querySelectorAll('aside nav a, nav a, .sidebar a').forEach(link => {
                    const t = link.textContent.toLowerCase().trim();
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

    // 3. Helper global para filtrar consultas de Supabase por la zona exacta del supervisor
    window.filtrarQuerySupabasePorZona = async function(queryBuilder, tabla) {
        const sesion = obtenerSesionActual();
        const rol = String(sesion.rol || '').toLowerCase();
        const supabase = window.supabaseClient || window.supabase;

        if (rol.includes('supervisor') && sesion.zona && supabase) {
            if (tabla === 'bancas') {
                return queryBuilder.eq('zona', sesion.zona);
            } else if (tabla === 'tickets') {
                // Obtener IDs de bancas que pertenecen a la zona del supervisor
                const { data: bancasZona } = await supabase.from('bancas').select('id').eq('zona', sesion.zona);
                if (bancasZona && bancasZona.length > 0) {
                    const idsBancas = bancasZona.map(b => b.id);
                    return queryBuilder.in('banca_id', idsBancas);
                } else {
                    return queryBuilder.eq('banca_id', -999); // Retorna vacío si no hay bancas en su zona
                }
            }
        }
        return queryBuilder; // Si es admin, retorna la consulta completa sin filtros
    };

    document.addEventListener('DOMContentLoaded', window.aplicarControlEstrictoRoles);
    window.addEventListener('hashchange', window.aplicarControlEstrictoRoles);
})();