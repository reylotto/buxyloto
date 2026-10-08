// ==========================================================
// MÓDULO DE AUTENTICACIÓN HÍBRIDO (auth.js)
// ==========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const supabase = createClient('https://ruruabsbkvfbudnqkjby.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU');

window.supabase = supabase;

// 1. VERIFICAR SESIÓN ACTIVA AL CARGAR LA PÁGINA (Anti-cierre con F5)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sesionGuardada = localStorage.getItem('usuario_sesion');
        if (sesionGuardada) {
            const user = JSON.parse(sesionGuardada);
            if (user && user.id) {
                console.log("🟢 Sesión activa detectada en almacenamiento local.");
                window.currentUserProfile = user;
                
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

        // Verificar sesión activa de Supabase Auth (para admin@buxiloto.com)
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session) {
            const userId = session.user.id;
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            const profileUser = profileData || { email: session.user.email, rol: 'admin', nombre: 'Administrador Maestro' };
            window.currentUserProfile = profileUser;
            localStorage.setItem('usuario_sesion', JSON.stringify(profileUser));

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

            // A. Si ingresa un correo (ej. admin@buxiloto.com), intentar Supabase Auth
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

            // B. Si no es correo, buscar en la tabla 'public.usuarios' (por username y password)
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

            // C. Si no se encuentra, buscar en la tabla 'public.bancas'
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

            // Verificación final de la cuenta
            if (!cuentaUsuario) {
                alert('❌ Usuario o contraseña incorrectos.');
                resetBtn();
                return;
            }

            // Verificar estatus activo
            const estatus = String(cuentaUsuario.estatus || cuentaUsuario.estado || 'activo').toLowerCase();
            if (estatus !== 'activo') {
                alert(`⚠️ Esta cuenta se encuentra ${estatus}. Contacte al administrador.`);
                resetBtn();
                return;
            }

            // Guardar en window y en localStorage
            window.currentUserProfile = cuentaUsuario;
            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));

            // Ocultar login y mostrar app principal
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