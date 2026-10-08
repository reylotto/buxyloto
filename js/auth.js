// ==========================================================
// MÓDULO DE AUTENTICACIÓN Y GESTIÓN DE ROLES (auth.js)
// ==========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función segura para aplicar restricciones visuales según el rol
function aplicarRestriccionesDeRol(usuario) {
    const rol = String(usuario.rol || 'admin').toLowerCase().trim();
    const zona = usuario.zona || 'Zona General';
    const nombre = usuario.nombre || usuario.username || 'Usuario';

    console.log(`🛡️ Rol Activo en Sesión -> [Rol: ${rol}] [Zona: ${zona}] [Nombre: ${nombre}]`);

    // 1. Guardar perfil globalmente
    window.currentUserProfile = usuario;

    // 2. Actualizar la cabecera superior derecha de manera segura
    setTimeout(() => {
        // Buscar el nombre del usuario en el header
        const headerNameEl = document.querySelector('#admin-user-name, .user-name-display, header div.font-bold');
        if (headerNameEl && !headerNameEl.textContent.includes('Plataforma')) {
            headerNameEl.textContent = nombre;
        }

        // Buscar el rol en el header
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

        // Ocultar cualquier selector o menú de "Cambiar Rol / Simulación" en pantalla
        document.querySelectorAll('div, span, button, select, label').forEach(el => {
            if (el.textContent && (el.textContent.includes('CAMBIAR ROL') || el.textContent.includes('SIMULACIÓN') || el.textContent.includes('simulacion'))) {
                const contenedor = el.closest('div.relative') || el.closest('div');
                if (contenedor) contenedor.style.display = 'none';
            }
        });
    }, 400);

    // 3. Inyectar reglas CSS estrictas si es Supervisor o Vendedor
    if (rol.includes('supervisor')) {
        const styleId = 'supervisor-security-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                /* Ocultar POS, Usuarios, Bancas, Loterías, Riesgo para Supervisor */
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
    }
}

// Función global para que las consultas de tablas filtren por la zona del supervisor
window.obtenerFiltroZonaSupervisor = function() {
    const user = window.currentUserProfile || JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
    const rol = String(user.rol || '').toLowerCase().trim();
    if (rol.includes('supervisor') && user.zona) {
        return String(user.zona).trim();
    }
    return null; // Si es admin, retorna null para ver todo
};

// 1. VERIFICAR SESIÓN ACTIVA AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sesionGuardada = localStorage.getItem('usuario_sesion');
        if (sesionGuardada) {
            const user = JSON.parse(sesionGuardada);
            if (user && user.id) {
                aplicarRestriccionesDeRol(user);
                
                const loginWrapper = document.getElementById('auth-login-wrapper');
                const mainContainer = document.getElementById('main-app-container');

                if (loginWrapper) loginWrapper.classList.add('hidden');
                if (mainContainer) mainContainer.classList.remove('hidden');

                if (typeof iniciarAplicacionPrincipal === 'function') {
                    iniciarAplicacionPrincipal();
                }
                return;
            }
        }
    } catch (err) {
        console.error("Error al comprobar la sesión inicial:", err);
    }
});

// 2. EVENTO DE INICIO DE SESIÓN DESDE EL FORMULARIO
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userInput = document.getElementById('login-usuario').value.trim().replace(/^@/, '');
        const passwordInput = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-login-submit');

        if (submitBtn) {
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;
        }

        try {
            let cuentaUsuario = null;

            // A. Si ingresa correo (Admin maestro por Supabase Auth)
            if (userInput.includes('@')) {
                const { data: authData, error: authError } = await window.supabase.auth.signInWithPassword({
                    email: userInput,
                    password: passwordInput
                });

                if (!authError && authData.user) {
                    cuentaUsuario = {
                        id: authData.user.id,
                        nombre: 'Administrador Maestro',
                        username: 'admin',
                        rol: 'admin',
                        email: authData.user.email,
                        estatus: 'activo',
                        zona: 'Zona General'
                    };
                }
            }

            // B. Buscar en tabla 'public.usuarios' (Supervisores y Admins personalizados)
            if (!cuentaUsuario) {
                const { data: usuarioData, error: errUsu } = await window.supabase
                    .from('usuarios')
                    .select('*')
                    .eq('username', userInput)
                    .eq('password', passwordInput)
                    .maybeSingle();

                if (!errUsu && usuarioData) {
                    cuentaUsuario = usuarioData;
                }
            }

            // C. Buscar en tabla 'public.bancas' (Vendedores / Caja)
            if (!cuentaUsuario) {
                const { data: bancaData, error: errBanca } = await window.supabase
                    .from('bancas')
                    .select('*')
                    .eq('username', userInput)
                    .eq('password', passwordInput)
                    .maybeSingle();

                if (!errBanca && bancaData) {
                    cuentaUsuario = {
                        ...bancaData,
                        rol: 'caja',
                        nombre: bancaData.nombre_banca || bancaData.nombre || 'Banca'
                    };
                }
            }

            if (!cuentaUsuario) {
                alert('❌ Usuario o contraseña incorrectos.');
                resetBtn();
                return;
            }

            const estatus = String(cuentaUsuario.estatus || cuentaUsuario.estado || 'activo').toLowerCase();
            if (estatus !== 'activo') {
                alert(`⚠️ Esta cuenta se encuentra ${estatus}. Contacte al administrador.`);
                resetBtn();
                return;
            }

            // Guardar sesión y aplicar restricciones de rol
            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));
            aplicarRestriccionesDeRol(cuentaUsuario);

            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            if (typeof iniciarAplicacionPrincipal === 'function') {
                iniciarAplicacionPrincipal();
            } else {
                window.location.reload();
            }

        } catch (err) {
            console.error('Error en el login:', err);
            alert('Ocurrió un error inesperado al iniciar sesión.');
            resetBtn();
        }
    });
}

function resetBtn() {
    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
        submitBtn.innerHTML = `<span>Entrar al Sistema</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        submitBtn.disabled = false;
    }
}