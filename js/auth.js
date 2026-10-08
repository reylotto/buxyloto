// ==========================================================
// MÓDULO DE AUTENTICACIÓN Y GESTIÓN DE SESIÓN (js/auth.js)
// ==========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sesionGuardada = localStorage.getItem('usuario_sesion');
        if (sesionGuardada) {
            const user = JSON.parse(sesionGuardada);
            if (user && user.id) {
                window.currentUserProfile = user;
                const loginWrapper = document.getElementById('auth-login-wrapper');
                const mainContainer = document.getElementById('main-app-container');
                if (loginWrapper) loginWrapper.classList.add('hidden');
                if (mainContainer) mainContainer.classList.remove('hidden');

                // Asegurar vista por defecto si no hay hash
                if (!window.location.hash || window.location.hash === '#') {
                    window.location.hash = '#dashboard';
                }

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
                alert(`⚠️ Esta cuenta se encuentra ${estatus}.`);
                resetBtn();
                return;
            }

            window.currentUserProfile = cuentaUsuario;
            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));

            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');
            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            // Forzar redirección al dashboard al iniciar sesión exitosamente
            window.location.hash = '#dashboard';

            if (typeof iniciarAplicacionPrincipal === 'function') {
                iniciarAplicacionPrincipal();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error('Error en login:', err);
            alert('Error inesperado al iniciar sesión.');
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