// ==========================================================
// MÓDULO DE AUTENTICACIÓN HÍBRIDO CON GESTIÓN DE ROLES Y ZONAS (auth.js)
// ==========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. APLICAR RESTRICCIONES VISUALES Y FILTROS SEGÚN EL ROL
function aplicarRestriccionesPorRol(usuario) {
    const rol = String(usuario.rol || 'admin').toLowerCase().trim();
    const zona = usuario.zona || 'Zona General';
    const nombre = usuario.nombre || usuario.nombre_completo || 'Usuario';

    console.log(`🛡️ Aplicando permisos para [Rol: ${rol}] [Zona: ${zona}] [Nombre: ${nombre}]`);
    window.currentUserProfile = usuario;

    // Actualizar el nombre y rol en la esquina superior derecha
    setTimeout(() => {
        const headerNameEl = document.querySelector('#admin-user-name, .user-name-display, [data-user-name]');
        if (headerNameEl) headerNameEl.textContent = nombre;

        const headerRoleEl = document.querySelector('#admin-user-role, .user-role-display, [data-user-role]');
        if (headerRoleEl) {
            headerRoleEl.textContent = rol === 'supervisor' ? `Supervisor (${zona})` : (rol === 'caja' ? 'Banca / Vendedor' : 'Administrador Central');
        }
    }, 400);

    const ocultarPorSelector = (selectores) => {
        selectores.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        });
    };

    if (rol === 'supervisor') {
        // Ocultar POS (no pueden emitir apuestas) y menús exclusivos de administrador central
        ocultarPorSelector([
            '[href="#pos"]', '[data-target="pos"]', '.nav-item-pos',
            '[href="#usuarios"]', '[data-target="usuarios"]', '.nav-item-usuarios',
            '[href="#bancas"]', '[data-target="bancas"]', '.nav-item-bancas',
            '[href="#loterias"]', '[data-target="loterias"]', '.nav-item-loterias',
            '[href="#riesgo"]', '[data-target="riesgo"]', '.nav-item-riesgo',
            '[href="#ticket"]', '[data-target="ticket"]', '.nav-item-ticket'
        ]);

        setTimeout(() => {
            document.querySelectorAll('.btn-guardar-escrutinio, .btn-editar-resultado, .admin-only-btn').forEach(btn => {
                btn.style.display = 'none';
            });
        }, 1000);

    } else if (rol === 'caja' || rol === 'vendedor') {
        ocultarPorSelector([
            'nav a:not([href*="pos"]):not([href*="historial"])',
            '.admin-only', '.supervisor-only'
        ]);
    }
}

// Filtro global de zona para que las consultas a Supabase traigan solo las bancas del supervisor
window.obtenerFiltroZonaSupervisor = function() {
    const user = window.currentUserProfile || JSON.parse(localStorage.getItem('usuario_sesion') || '{}');
    const rol = String(user.rol || '').toLowerCase();
    if (rol === 'supervisor' && user.zona) {
        return { zona: user.zona, supervisor_id: user.id };
    }
    return null; // Admin ve todo
};

// 2. VERIFICAR SESIÓN ACTIVA AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sesionGuardada = localStorage.getItem('usuario_sesion');
        if (sesionGuardada) {
            const user = JSON.parse(sesionGuardada);
            if (user && user.id) {
                aplicarRestriccionesPorRol(user);
                
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

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session) {
            const userId = session.user.id;
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            const profileUser = profileData || { id: userId, email: session.user.email, rol: 'admin', nombre: 'Administrador Maestro' };
            localStorage.setItem('usuario_sesion', JSON.stringify(profileUser));
            aplicarRestriccionesPorRol(profileUser);

            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            iniciarAplicacionPrincipal();
        }
    } catch (err) {
        console.error("Error al comprobar la sesión inicial:", err);
    }
});

// 3. EVENTO DE INICIO DE SESIÓN
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

            if (userInput.includes('@')) {
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: userInput,
                    password: passwordInput
                });

                if (!authError && authData.user) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authData.user.id)
                        .maybeSingle();

                    cuentaUsuario = profileData || {
                        id: authData.user.id,
                        nombre: 'Administrador Maestro',
                        username: 'admin',
                        rol: 'admin',
                        email: authData.user.email,
                        estatus: 'activo'
                    };
                }
            }

            if (!cuentaUsuario) {
                const { data: usuarioData, error: errUsu } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('username', userInput)
                    .eq('password', passwordInput)
                .maybeSingle();

                if (!errUsu && usuarioData) {
                    cuentaUsuario = usuarioData;
                }
            }

            if (!cuentaUsuario) {
                const { data: bancaData, error: errBanca } = await supabase
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

            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));
            aplicarRestriccionesPorRol(cuentaUsuario);

            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            iniciarAplicacionPrincipal();

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