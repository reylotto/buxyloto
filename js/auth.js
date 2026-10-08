// ==========================================================
// MÓDULO DE AUTENTICACIÓN Y CONTROL ESTRICTO DE ROLES (auth.js)
// ==========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. RESTRICCIÓN Y OCULTAMIENTO DE MENÚS POR ROL (SUPERVISOR VS ADMIN)
function aplicarRestriccionesPorRol(usuario) {
    const rol = String(usuario.rol || 'admin').toLowerCase().trim();
    const zona = usuario.zona || 'Zona General';
    const nombre = usuario.nombre || usuario.nombre_completo || 'Usuario';

    console.log(`🛡️ Aplicando permisos estrictos -> [Rol: ${rol}] [Zona: ${zona}]`);
    window.currentUserProfile = usuario;

    // Actualizar nombre y rol en la cabecera superior derecha
    setTimeout(() => {
        const headerNameEl = document.querySelector('header .font-bold, #admin-user-name, .user-name-display');
        if (headerNameEl && !headerNameEl.textContent.includes('Plataforma')) {
            headerNameEl.textContent = nombre;
        }
        const headerRoleEl = document.querySelector('header span.text-xs, #admin-user-role');
        if (headerRoleEl) {
            headerRoleEl.textContent = rol === 'supervisor' ? `Supervisor (${zona})` : (rol === 'caja' ? 'Caja / Vendedor' : 'Administrador');
        }
    }, 400);

    // Ocultar elementos del menú lateral basándonos en el texto visible del enlace
    setTimeout(() => {
        const linksMenu = document.querySelectorAll('aside nav a, nav a, .sidebar a, [class*="nav"] a');
        
        linksMenu.forEach(link => {
            const texto = link.textContent.toLowerCase();

            if (rol === 'supervisor') {
                // El supervisor NO debe ver POS, Gestión de Usuarios, Bancas, Loterías, Control de Riesgo
                if (
                    texto.includes('punto de venta') || 
                    texto.includes('pos') || 
                    texto.includes('gestión de usuarios') || 
                    texto.includes('gestion de usuarios') || 
                    texto.includes('bancas') || 
                    texto.includes('vendedores') || 
                    texto.includes('loterías') || 
                    texto.includes('loterias') || 
                    texto.includes('control de riesgo') || 
                    texto.includes('riesgo') || 
                    texto.includes('personalizar ticket') || 
                    texto.includes('geolocalización') || 
                    texto.includes('geolocalizacion')
                ) {
                    const contenedor = link.closest('li') || link.closest('div') || link;
                    if (contenedor) contenedor.style.display = 'none';
                }
            } else if (rol === 'caja' || rol === 'vendedor') {
                // El vendedor solo ve POS e Historial de Tickets
                if (!texto.includes('pos') && !texto.includes('punto de venta') && !texto.includes('historial')) {
                    const contenedor = link.closest('li') || link.closest('div') || link;
                    if (contenedor) contenedor.style.display = 'none';
                }
            }
        });

        // Ocultar botones flotantes de creación/edición de admin si no es admin
        if (rol !== 'admin') {
            document.querySelectorAll('.admin-only, #btn-open-usuario-modal, #btn-open-banca-modal, #btn-open-loteria-modal, .btn-nueva-banca, .btn-nuevo-usuario').forEach(el => {
                el.style.display = 'none';
            });
        }
    }, 300);
}

// 2. VERIFICACIÓN DE SESIÓN ACTIVA AL CARGAR
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
    } catch (err) {
        console.error("Error al comprobar sesión:", err);
    }
});

// 3. INICIO DE SESIÓN
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

            window.currentUserProfile = cuentaUsuario;
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